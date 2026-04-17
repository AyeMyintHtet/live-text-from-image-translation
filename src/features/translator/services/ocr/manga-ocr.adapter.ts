import {
  MANGA_OCR_DEFAULT_ENDPOINT,
  MANGA_OCR_ENDPOINT_ENV_KEY,
} from '@/constants/app.constants'
import { resolveMangaOcrEndpoint } from '@/features/translator/services/ocr/manga-ocr.config'
import type { OcrProcessingOptions } from '@/features/translator/services/ocr/ocr-adapter.types'
import type {
  ImageDimensions,
  OcrExtractionResult,
} from '@/features/translator/types'

const normalizeExtractedText = (text: string): string => {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

const toTextFromPayload = (payload: unknown): string => {
  if (typeof payload === 'string') {
    return payload
  }

  if (Array.isArray(payload)) {
    return payload.filter((item): item is string => typeof item === 'string').join('\n')
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const text =
      typeof record.text === 'string'
        ? record.text
        : typeof record.result === 'string'
          ? record.result
          : typeof record.ocr === 'string'
            ? record.ocr
            : ''

    if (text) {
      return text
    }

    if (Array.isArray(record.lines)) {
      return record.lines
        .filter((line): line is string => typeof line === 'string')
        .join('\n')
    }

    if (record.result && typeof record.result === 'object') {
      const nested = record.result as Record<string, unknown>
      if (typeof nested.text === 'string') {
        return nested.text
      }
      if (Array.isArray(nested.lines)) {
        return nested.lines
          .filter((line): line is string => typeof line === 'string')
          .join('\n')
      }
    }
  }

  return ''
}

const loadImageDimensions = async (file: File): Promise<ImageDimensions> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({
        width: image.width,
        height: image.height,
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to load source image for Manga OCR processing.'))
    }

    image.src = objectUrl
  })
}

const createMangaOcrRequestBody = (
  file: File,
  options: OcrProcessingOptions,
): FormData => {
  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('language', options.language)
  return formData
}

const requestMangaOcr = async (
  endpoint: string,
  file: File,
  options: OcrProcessingOptions,
): Promise<Response> => {
  return fetch(endpoint, {
    method: 'POST',
    body: createMangaOcrRequestBody(file, options),
  })
}

export const extractTextWithMangaOcr = async (
  file: File,
  options: OcrProcessingOptions,
): Promise<OcrExtractionResult> => {
  if (options.language !== 'japanese') {
    throw new Error('Manga OCR currently supports Japanese OCR only.')
  }

  const imageSizePromise = loadImageDimensions(file)
  const configuredEndpoint = resolveMangaOcrEndpoint()
  const canFallbackToLocalDevEndpoint =
    import.meta.env.DEV && configuredEndpoint !== MANGA_OCR_DEFAULT_ENDPOINT

  let response: Response | null = null
  let resolvedEndpoint = configuredEndpoint

  try {
    response = await requestMangaOcr(configuredEndpoint, file, options)
  } catch (error) {
    if (canFallbackToLocalDevEndpoint) {
      try {
        response = await requestMangaOcr(MANGA_OCR_DEFAULT_ENDPOINT, file, options)
        resolvedEndpoint = MANGA_OCR_DEFAULT_ENDPOINT
      } catch {
        // Keep original network error context below.
      }
    }

    if (!response) {
      const reason =
        error instanceof Error && error.message ? error.message : 'Unknown network error.'
      const fallbackHint = canFallbackToLocalDevEndpoint
        ? ` Remove ${MANGA_OCR_ENDPOINT_ENV_KEY} to use the built-in local endpoint at ${MANGA_OCR_DEFAULT_ENDPOINT}.`
        : ''

      throw new Error(
        `Manga OCR request could not reach ${configuredEndpoint}. Ensure your Manga OCR server is running, reachable from the browser, and allows CORS from this app origin.${fallbackHint} (${reason})`,
      )
    }
  }

  if (!response) {
    throw new Error('Manga OCR request failed before a response was received.')
  }

  if (canFallbackToLocalDevEndpoint && response.status === 404) {
    const fallbackResponse = await requestMangaOcr(MANGA_OCR_DEFAULT_ENDPOINT, file, options)
    if (fallbackResponse.ok) {
      response = fallbackResponse
      resolvedEndpoint = MANGA_OCR_DEFAULT_ENDPOINT
    }
  }

  if (!response.ok) {
    let responseSummary = ''
    try {
      responseSummary = (await response.text()).trim()
    } catch {
      responseSummary = ''
    }

    const setupHint =
      resolvedEndpoint === MANGA_OCR_DEFAULT_ENDPOINT
        ? `Set ${MANGA_OCR_ENDPOINT_ENV_KEY} to your Manga OCR endpoint if it is not hosted at ${MANGA_OCR_DEFAULT_ENDPOINT}.`
        : `Check that your Manga OCR endpoint is reachable at ${resolvedEndpoint}.`

    throw new Error(
      `Manga OCR request failed with status ${response.status}. ${setupHint}${
        responseSummary ? ` Response: ${responseSummary.slice(0, 180)}` : ''
      }`,
    )
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    payload = await response.text()
  }

  const text = normalizeExtractedText(toTextFromPayload(payload))
  const imageSize = await imageSizePromise

  return {
    text,
    blocksByGranularity: {
      group: [],
      line: [],
    },
    imageSize,
  }
}

export const terminateMangaOcr = async (): Promise<void> => {
  // No long-lived Manga OCR resources exist in the browser adapter.
}
