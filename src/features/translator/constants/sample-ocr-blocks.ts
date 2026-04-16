import type {
  ImageDimensions,
  OcrTextBlock,
} from '@/features/translator/types'

export const SAMPLE_OVERLAY_IMAGE_SIZE: ImageDimensions = {
  width: 1200,
  height: 800,
}

export const SAMPLE_OVERLAY_BLOCKS: OcrTextBlock[] = [
  {
    id: '1',
    bbox: { x0: 120, y0: 80, x1: 390, y1: 220 },
    sourceText: '…え?',
    translatedText: '...Huh?',
    confidence: 91,
    unitLevel: 'group',
  },
  {
    id: '2',
    bbox: { x0: 460, y0: 110, x1: 760, y1: 290 },
    sourceText: '大丈夫?',
    translatedText: 'Are you okay?',
    confidence: 88,
    unitLevel: 'group',
  },
  {
    id: '3',
    bbox: { x0: 820, y0: 60, x1: 1110, y1: 230 },
    sourceText: 'ごめんね',
    translatedText: 'I am sorry.',
    confidence: 86,
    unitLevel: 'group',
  },
]
