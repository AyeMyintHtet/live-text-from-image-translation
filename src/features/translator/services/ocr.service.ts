import {
  DEFAULT_OCR_ENGINE,
  DEFAULT_OCR_LANGUAGE,
  DEFAULT_USE_HIGH_CONTRAST_PREPROCESSING,
  OCR_ENGINE_LANGUAGE_FALLBACKS,
  isOcrEngineLanguageSupported,
  isOcrEngineSupportsHighContrastPreprocessing,
} from '@/constants/app.constants'
import { extractTextWithMangaOcr, terminateMangaOcr } from '@/features/translator/services/ocr/manga-ocr.adapter'
import type {
  OcrAdapter,
  OcrProcessingOptions,
} from '@/features/translator/services/ocr/ocr-adapter.types'
import {
  extractTextWithTesseract,
  terminateTesseractOcrWorkers,
} from '@/features/translator/services/ocr/tesseract-ocr.adapter'
import type { OcrEngine, OcrExtractionResult } from '@/features/translator/types'

const OCR_ADAPTERS: Record<OcrEngine, OcrAdapter> = {
  tesseract: {
    engine: 'tesseract',
    extractText: extractTextWithTesseract,
    terminate: terminateTesseractOcrWorkers,
  },
  mangaOcr: {
    engine: 'mangaOcr',
    extractText: extractTextWithMangaOcr,
    terminate: terminateMangaOcr,
  },
}

const resolveProcessingOptions = (
  options?: Partial<OcrProcessingOptions>,
): OcrProcessingOptions => {
  const engine = options?.engine ?? DEFAULT_OCR_ENGINE
  const requestedLanguage = options?.language ?? DEFAULT_OCR_LANGUAGE
  const language = isOcrEngineLanguageSupported(engine, requestedLanguage)
    ? requestedLanguage
    : OCR_ENGINE_LANGUAGE_FALLBACKS[engine]
  const requestedHighContrast =
    options?.useHighContrastPreprocessing ?? DEFAULT_USE_HIGH_CONTRAST_PREPROCESSING
  const useHighContrastPreprocessing = isOcrEngineSupportsHighContrastPreprocessing(engine)
    ? requestedHighContrast
    : false

  return {
    engine,
    language,
    useHighContrastPreprocessing,
  }
}

export const extractTextFromImage = async (
  file: File,
  options?: Partial<OcrProcessingOptions>,
): Promise<OcrExtractionResult> => {
  const resolved = resolveProcessingOptions(options)
  const adapter = OCR_ADAPTERS[resolved.engine]
  return adapter.extractText(file, resolved)
}

export const extractJapaneseText = async (
  file: File,
): Promise<OcrExtractionResult> => {
  return extractTextFromImage(file, {
    engine: 'tesseract',
    language: 'japanese',
  })
}

export const terminateOcrWorker = async (): Promise<void> => {
  await Promise.allSettled(Object.values(OCR_ADAPTERS).map((adapter) => adapter.terminate()))
}

export type { OcrProcessingOptions } from '@/features/translator/services/ocr/ocr-adapter.types'
