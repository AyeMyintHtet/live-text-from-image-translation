import type { OcrLanguage } from '@/features/translator/types'

export const APP_COPY = {
  productName: 'Live Text From Image Translation',
  productTagline: 'Extract dialogue from images and prepare it for English translation.',
  heroTitle: 'OCR + Translation Workspace',
  heroDescription:
    'Upload a webtoon panel, run OCR with your selected language profile, and generate an English draft. This foundation is built to plug in stronger translation providers later.',
  sourcePanelTitle: 'Source Image',
  sourcePanelDescription:
    'Drop a screenshot or page crop. After OCR and translation, overlay text is anchored to detected bbox coordinates.',
  ocrPanelTitle: 'OCR Result',
  ocrPanelDescription:
    'Tesseract.js runs with the selected OCR language profile.',
  translationPanelTitle: 'English Output',
  translationPanelDescription:
    'Current build uses a safe placeholder translation adapter. Swap it with your real provider when ready.',
  overlayPanelTitle: 'Overlay Output',
  overlayPanelDescription:
    'Final result preview: choose line-split or grouped overlays and render translated text at OCR bbox locations.',
} as const

export const ACCEPTED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const ACCEPTED_IMAGE_EXTENSIONS_LABEL = '.png, .jpg, .jpeg, .webp'

export const MAX_IMAGE_SIZE_MB = 12

export const OCR_LANGUAGE_OPTIONS: ReadonlyArray<{
  value: OcrLanguage
  label: string
  tesseractLanguage: string
}> = [
  {
    value: 'english',
    label: 'English (eng)',
    tesseractLanguage: 'eng',
  },
  {
    value: 'japanese',
    label: 'Japanese (jpn + jpn_vert)',
    tesseractLanguage: 'jpn+jpn_vert',
  },
] as const

export const DEFAULT_OCR_LANGUAGE: OcrLanguage = 'english'
export const DEFAULT_USE_HIGH_CONTRAST_PREPROCESSING = true

export const STATUS_LABELS = {
  idle: 'Idle',
  runningOcr: 'Running OCR',
  runningTranslation: 'Translating',
  completed: 'Ready',
  failed: 'Needs Attention',
} as const
