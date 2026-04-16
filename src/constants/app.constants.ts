export const APP_COPY = {
  productName: 'Live Text From Image Translation',
  productTagline: 'Extract Japanese webtoon dialogue and prepare it for English translation.',
  heroTitle: 'OCR + Translation Workspace',
  heroDescription:
    'Upload a webtoon panel, run Japanese OCR, and generate an English draft. This foundation is built to plug in stronger translation providers later.',
  sourcePanelTitle: 'Source Image',
  sourcePanelDescription:
    'Drop a screenshot or page crop. After OCR and translation, overlay text is anchored to detected bbox coordinates.',
  ocrPanelTitle: 'Japanese OCR Result',
  ocrPanelDescription:
    'Tesseract.js reads horizontal and vertical Japanese text (`jpn + jpn_vert`).',
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

export const OCR_LANGUAGE = 'jpn+jpn_vert'

export const STATUS_LABELS = {
  idle: 'Idle',
  runningOcr: 'Running OCR',
  runningTranslation: 'Translating',
  completed: 'Ready',
  failed: 'Needs Attention',
} as const
