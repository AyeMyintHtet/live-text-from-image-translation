import type {
  OcrEngine,
  OcrExtractionResult,
  OcrLanguage,
} from '@/features/translator/types'

export type OcrProcessingOptions = {
  engine: OcrEngine
  language: OcrLanguage
  useHighContrastPreprocessing: boolean
}

export type OcrAdapter = {
  engine: OcrEngine
  extractText: (file: File, options: OcrProcessingOptions) => Promise<OcrExtractionResult>
  terminate: () => Promise<void>
}
