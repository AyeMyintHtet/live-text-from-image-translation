import type {
  OcrEngine,
  OcrLanguage,
  TranslationLanguage,
} from '@/features/translator/types'

type OcrLanguageOption = {
  value: OcrLanguage
  label: string
  tesseractLanguage: string
}

type OcrEngineOption = {
  value: OcrEngine
  label: string
  description: string
  supportedLanguages: ReadonlyArray<OcrLanguage>
  supportsHighContrastPreprocessing: boolean
}

type TranslationLanguageOption = {
  value: TranslationLanguage
  label: string
  shortLabel: string
}

export const APP_COPY = {
  productName: 'Live Text From Image Translation',
  productTagline:
    'Extract dialogue from images, then translate it to the target language you choose.',
  heroTitle: 'OCR + Translation Workspace',
  heroDescription:
    'Upload a manga panel or screenshot, choose OCR engine/language settings, and generate translated output.',
  sourcePanelTitle: 'Source Image',
  sourcePanelDescription:
    'Drop a screenshot or panel crop. OCR and translation output are generated from this image.',
  ocrPanelTitle: 'OCR Result',
  ocrPanelDescription:
    'OCR output is grouped by detected text region when the selected engine provides block-level data.',
  translationPanelTitle: 'Translated Output',
  translationPanelDescription:
    'Current build uses a placeholder translation adapter. Replace it with your real provider when ready.',
  overlayPanelTitle: 'Overlay Output',
  overlayPanelDescription:
    'Render translated text boxes on top of the source image using detected OCR bounding boxes.',
} as const

export const ACCEPTED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const ACCEPTED_IMAGE_EXTENSIONS_LABEL = '.png, .jpg, .jpeg, .webp'

export const MAX_IMAGE_SIZE_MB = 12

export const OCR_LANGUAGE_OPTIONS: ReadonlyArray<OcrLanguageOption> = [
  {
    value: 'english',
    label: 'English',
    tesseractLanguage: 'eng',
  },
  {
    value: 'japanese',
    label: 'Japanese',
    tesseractLanguage: 'jpn+jpn_vert',
  },
] as const

export const OCR_ENGINE_OPTIONS: ReadonlyArray<OcrEngineOption> = [
  {
    value: 'tesseract',
    label: 'Tesseract (Browser)',
    description: 'Runs OCR fully in the browser with block-level box data.',
    supportedLanguages: ['english', 'japanese'],
    supportsHighContrastPreprocessing: true,
  },
  {
    value: 'mangaOcr',
    label: 'Manga OCR (Server)',
    description:
      'Uses a server-side Manga OCR endpoint optimized for Japanese manga text extraction.',
    supportedLanguages: ['japanese'],
    supportsHighContrastPreprocessing: false,
  },
] as const

export const TRANSLATION_LANGUAGE_OPTIONS: ReadonlyArray<TranslationLanguageOption> = [
  { value: 'english', label: 'English', shortLabel: 'EN' },
  { value: 'japanese', label: 'Japanese', shortLabel: 'JA' },
  { value: 'korean', label: 'Korean', shortLabel: 'KO' },
  { value: 'spanish', label: 'Spanish', shortLabel: 'ES' },
  { value: 'french', label: 'French', shortLabel: 'FR' },
  { value: 'german', label: 'German', shortLabel: 'DE' },
] as const

export const DEFAULT_OCR_ENGINE: OcrEngine = 'tesseract'
export const DEFAULT_OCR_LANGUAGE: OcrLanguage = 'english'
export const DEFAULT_USE_HIGH_CONTRAST_PREPROCESSING = true
export const DEFAULT_TRANSLATION_TARGET_LANGUAGE: TranslationLanguage = 'english'

export const OCR_ENGINE_LANGUAGE_FALLBACKS: Record<OcrEngine, OcrLanguage> = {
  tesseract: 'english',
  mangaOcr: 'japanese',
}

export const OCR_LANGUAGE_TO_TRANSLATION_LANGUAGE: Record<OcrLanguage, TranslationLanguage> = {
  english: 'english',
  japanese: 'japanese',
}

export const MANGA_OCR_DEFAULT_ENDPOINT = '/api/manga-ocr'
export const MANGA_OCR_ENDPOINT_ENV_KEY = 'VITE_MANGA_OCR_ENDPOINT'

export const isOcrEngineLanguageSupported = (
  engine: OcrEngine,
  language: OcrLanguage,
): boolean => {
  return OCR_ENGINE_OPTIONS.find((candidate) => candidate.value === engine)?.supportedLanguages.includes(
    language,
  ) ?? false
}

export const isOcrEngineSupportsHighContrastPreprocessing = (
  engine: OcrEngine,
): boolean => {
  return (
    OCR_ENGINE_OPTIONS.find((candidate) => candidate.value === engine)
      ?.supportsHighContrastPreprocessing ?? false
  )
}

export const getTesseractLanguageCode = (language: OcrLanguage): string => {
  return (
    OCR_LANGUAGE_OPTIONS.find((candidate) => candidate.value === language)?.tesseractLanguage ?? 'eng'
  )
}

export const getTranslationLanguageShortLabel = (
  language: TranslationLanguage,
): string => {
  return (
    TRANSLATION_LANGUAGE_OPTIONS.find((candidate) => candidate.value === language)?.shortLabel ??
    language.slice(0, 2).toUpperCase()
  )
}

export const STATUS_LABELS = {
  idle: 'Idle',
  runningOcr: 'Running OCR',
  runningTranslation: 'Translating',
  completed: 'Ready',
  failed: 'Needs Attention',
} as const
