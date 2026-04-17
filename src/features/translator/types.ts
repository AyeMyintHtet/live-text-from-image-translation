export type WorkflowStatus =
  | 'idle'
  | 'running-ocr'
  | 'running-translation'
  | 'completed'
  | 'failed'

export type PerformanceMetrics = {
  ocrDurationMs: number | null
  translationDurationMs: number | null
}

export type BoundingBox = {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type ImageDimensions = {
  width: number
  height: number
}

export type OcrLanguage = 'english' | 'japanese'
export type OcrEngine = 'tesseract' | 'mangaOcr'
export type TranslationLanguage =
  | 'english'
  | 'japanese'
  | 'korean'
  | 'spanish'
  | 'french'
  | 'german'

export type OcrGranularity = 'group' | 'line'

export type OcrTextBlock = {
  id: string
  bbox: BoundingBox
  sourceText: string
  translatedText: string
  confidence: number
  unitLevel: OcrGranularity
}

export type OcrBlocksByGranularity = {
  group: OcrTextBlock[]
  line: OcrTextBlock[]
}

export type OcrExtractionResult = {
  text: string
  blocksByGranularity: OcrBlocksByGranularity
  imageSize: ImageDimensions
}
