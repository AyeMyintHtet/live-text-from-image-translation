import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'

const MANGA_OCR_ENDPOINT_PATH = '/api/manga-ocr'

const SUPPORTED_OCR_LANGUAGES = ['japanese', 'english'] as const
type SupportedOcrLanguage = (typeof SUPPORTED_OCR_LANGUAGES)[number]

const TESSERACT_LANGUAGE_BY_OCR_LANGUAGE: Record<SupportedOcrLanguage, string> = {
  japanese: 'jpn+jpn_vert',
  english: 'eng',
}

const ENGLISH_CHAR_WHITELIST =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?':;\"()-"

const TESSERACT_OPTIONS = {
  // Load core from local node_modules to avoid remote fetches in dev.
  corePath: path.resolve(process.cwd(), 'node_modules/tesseract.js-core'),
  // `.traineddata` files are stored at repository root.
  langPath: process.cwd(),
  cachePath: path.resolve(process.cwd(), '.cache', 'tesseract'),
  gzip: false,
  errorHandler: (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[manga-ocr-local-api] worker error: ${message}`)
  },
} as const

const OCR_OUTPUT_OPTIONS = {
  text: true,
  blocks: true,
} as const

const workerPromisesByLanguage = new Map<SupportedOcrLanguage, Promise<Worker>>()

const isSupportedOcrLanguage = (value: string): value is SupportedOcrLanguage => {
  return SUPPORTED_OCR_LANGUAGES.includes(value as SupportedOcrLanguage)
}

const toOcrLanguage = (value: unknown): SupportedOcrLanguage => {
  if (typeof value !== 'string') {
    return 'japanese'
  }

  const normalized = value.trim().toLowerCase()
  return isSupportedOcrLanguage(normalized) ? normalized : 'japanese'
}

const normalizeExtractedText = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const readRequestBody = async (request: IncomingMessage): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })

    request.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    request.on('error', reject)
  })
}

const extractBase64Payload = (value: string): string => {
  const [metadata, payload] = value.split(',', 2)
  if (metadata.includes('base64') && payload) {
    return payload
  }

  return value
}

const toImageBufferFromJson = (value: unknown): Buffer | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  try {
    return Buffer.from(extractBase64Payload(value.trim()), 'base64')
  } catch {
    return null
  }
}

const parseMultipartRequestBody = async (
  body: Buffer,
  contentType: string,
): Promise<{
  imageBuffer: Buffer | null
  language: SupportedOcrLanguage
}> => {
  const request = new Request('http://localhost/api/manga-ocr', {
    method: 'POST',
    headers: {
      'content-type': contentType,
    },
    body,
  })

  const formData = await request.formData()
  const language = toOcrLanguage(formData.get('language') ?? formData.get('ocrLanguage'))
  const uploadedFile = formData.get('file')

  if (!(uploadedFile instanceof File)) {
    return {
      imageBuffer: null,
      language,
    }
  }

  return {
    imageBuffer: Buffer.from(await uploadedFile.arrayBuffer()),
    language,
  }
}

const parseJsonRequestBody = (
  body: Buffer,
): {
  imageBuffer: Buffer | null
  language: SupportedOcrLanguage
} => {
  const parsed = JSON.parse(body.toString('utf-8')) as Record<string, unknown>

  return {
    imageBuffer: toImageBufferFromJson(parsed.imageBase64 ?? parsed.image ?? parsed.file),
    language: toOcrLanguage(parsed.language ?? parsed.ocrLanguage),
  }
}

const parseOcrRequest = async (
  request: IncomingMessage,
): Promise<{
  imageBuffer: Buffer | null
  language: SupportedOcrLanguage
}> => {
  const contentType = request.headers['content-type'] ?? ''
  const rawBody = await readRequestBody(request)

  if (contentType.includes('multipart/form-data')) {
    return parseMultipartRequestBody(rawBody, contentType)
  }

  if (contentType.includes('application/json')) {
    return parseJsonRequestBody(rawBody)
  }

  return {
    imageBuffer: null,
    language: 'japanese',
  }
}

const getWorker = (language: SupportedOcrLanguage): Promise<Worker> => {
  const existing = workerPromisesByLanguage.get(language)
  if (existing) {
    return existing
  }

  const created = createWorker(TESSERACT_LANGUAGE_BY_OCR_LANGUAGE[language], OEM.LSTM_ONLY, {
    ...TESSERACT_OPTIONS,
  })
    .then(async (worker) => {
      await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        ...(language === 'english'
          ? {
              tessedit_char_whitelist: ENGLISH_CHAR_WHITELIST,
            }
          : {}),
      })

      return worker
    })
    .catch((error) => {
      workerPromisesByLanguage.delete(language)
      throw error
    })

  workerPromisesByLanguage.set(language, created)
  return created
}

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('access-control-allow-origin', '*')
  response.setHeader('access-control-allow-methods', 'POST, OPTIONS')
  response.setHeader('access-control-allow-headers', 'Content-Type')
  response.end(JSON.stringify(payload))
}

const toRecognizedLines = (normalizedText: string): string[] => {
  if (!normalizedText) {
    return []
  }

  return normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const handleMangaOcrRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, {
      error: 'Method not allowed. Use POST /api/manga-ocr.',
    })
    return
  }

  const { imageBuffer, language } = await parseOcrRequest(request)
  if (!imageBuffer || imageBuffer.byteLength === 0) {
    sendJson(response, 400, {
      error:
        'No image payload was provided. Send multipart/form-data with a "file" field or JSON with "imageBase64".',
    })
    return
  }

  const worker = await getWorker(language)
  const recognition = await worker.recognize(imageBuffer, {}, OCR_OUTPUT_OPTIONS)
  const text = normalizeExtractedText(recognition.data.text ?? '')
  const lines = toRecognizedLines(text)

  sendJson(response, 200, {
    text,
    lines,
    language,
    provider: 'local-tesseract-dev',
    confidence:
      typeof recognition.data.confidence === 'number'
        ? Math.round(recognition.data.confidence * 100) / 100
        : null,
  })
}

const isMangaOcrApiPath = (url: string | undefined): boolean => {
  if (!url) {
    return false
  }

  try {
    return new URL(url, 'http://localhost').pathname === MANGA_OCR_ENDPOINT_PATH
  } catch {
    return false
  }
}

const registerMangaOcrMiddleware = (
  server: Pick<ViteDevServer, 'middlewares' | 'httpServer'> | Pick<PreviewServer, 'middlewares' | 'httpServer'>,
) => {
  server.middlewares.use((request, response, next) => {
    if (!isMangaOcrApiPath(request.url)) {
      next()
      return
    }

    void handleMangaOcrRequest(request, response).catch((error: unknown) => {
      const message = (() => {
        if (error instanceof Error && error.message) {
          return error.message
        }
        if (typeof error === 'string' && error.trim()) {
          return error.trim()
        }
        return 'Unexpected Manga OCR processing failure.'
      })()

      sendJson(response, 500, {
        error: `Local Manga OCR endpoint failed: ${message}`,
      })
    })
  })

  server.httpServer?.once('close', () => {
    const workers = [...workerPromisesByLanguage.values()]
    if (workers.length === 0) {
      return
    }

    void Promise.allSettled(
      workers.map(async (workerPromise) => {
        const worker = await workerPromise
        await worker.terminate()
      }),
    )
  })
}

export const mangaOcrVitePlugin = (): Plugin => {
  return {
    name: 'manga-ocr-local-api',
    configureServer(server) {
      registerMangaOcrMiddleware(server)
    },
    configurePreviewServer(server) {
      registerMangaOcrMiddleware(server)
    },
  }
}
