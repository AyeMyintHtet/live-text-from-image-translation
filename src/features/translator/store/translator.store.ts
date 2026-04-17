import { create } from 'zustand'

import {
  DEFAULT_OCR_LANGUAGE,
  DEFAULT_USE_HIGH_CONTRAST_PREPROCESSING,
} from '@/constants/app.constants'
import { extractTextFromImage } from '@/features/translator/services/ocr.service'
import {
  translateBlocksToEnglish,
  translateToEnglish,
} from '@/features/translator/services/translation.service'
import type {
  ImageDimensions,
  OcrBlocksByGranularity,
  OcrGranularity,
  OcrLanguage,
  OcrTextBlock,
  PerformanceMetrics,
  WorkflowStatus,
} from '@/features/translator/types'

type TranslatorStore = {
  sourceFile: File | null
  sourceImageSize: ImageDimensions | null
  ocrText: string
  translatedText: string
  ocrBlocksByGranularity: OcrBlocksByGranularity
  ocrLanguage: OcrLanguage
  useHighContrastPreprocessing: boolean
  overlayGranularity: OcrGranularity
  status: WorkflowStatus
  errorMessage: string | null
  metrics: PerformanceMetrics
  setSourceFile: (file: File | null) => void
  setOcrLanguage: (language: OcrLanguage) => void
  setUseHighContrastPreprocessing: (enabled: boolean) => void
  setOverlayGranularity: (granularity: OcrGranularity) => void
  setWorkflowError: (message: string) => void
  runOcr: () => Promise<void>
  runTranslation: () => Promise<void>
  clearAll: () => void
  clearError: () => void
}

const createInitialMetrics = (): PerformanceMetrics => ({
  ocrDurationMs: null,
  translationDurationMs: null,
})

const createInitialBlocksByGranularity = (): OcrBlocksByGranularity => ({
  group: [],
  line: [],
})

const flattenBlocks = (blocksByGranularity: OcrBlocksByGranularity): OcrTextBlock[] => {
  return [...blocksByGranularity.group, ...blocksByGranularity.line]
}

const createInitialState = () => ({
  sourceImageSize: null as ImageDimensions | null,
  ocrText: '',
  translatedText: '',
  ocrBlocksByGranularity: createInitialBlocksByGranularity(),
  overlayGranularity: 'line' as OcrGranularity,
  status: 'idle' as WorkflowStatus,
  errorMessage: null as string | null,
  metrics: createInitialMetrics(),
})

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unexpected processing error. Please try again.'
}

const mergeTranslatedBlocks = (
  blocks: OcrTextBlock[],
  translatedById: Map<string, string>,
): OcrTextBlock[] => {
  return blocks.map((block) => ({
    ...block,
    translatedText: translatedById.get(block.id) ?? '',
  }))
}

export const useTranslatorStore = create<TranslatorStore>((set, get) => ({
  sourceFile: null,
  ocrLanguage: DEFAULT_OCR_LANGUAGE,
  useHighContrastPreprocessing: DEFAULT_USE_HIGH_CONTRAST_PREPROCESSING,
  ...createInitialState(),
  setSourceFile: (file) => {
    set({
      sourceFile: file,
      ...createInitialState(),
    })
  },
  setOcrLanguage: (language) => {
    set({
      ocrLanguage: language,
      ...createInitialState(),
      sourceFile: get().sourceFile,
    })
  },
  setUseHighContrastPreprocessing: (enabled) => {
    set({
      useHighContrastPreprocessing: enabled,
      ...createInitialState(),
      sourceFile: get().sourceFile,
    })
  },
  setOverlayGranularity: (granularity) => {
    set({ overlayGranularity: granularity })
  },
  setWorkflowError: (message) => {
    set({
      status: 'failed',
      errorMessage: message,
    })
  },
  runOcr: async () => {
    const sourceFile = get().sourceFile
    const ocrLanguage = get().ocrLanguage
    const useHighContrastPreprocessing = get().useHighContrastPreprocessing

    if (!sourceFile) {
      set({
        status: 'failed',
        errorMessage: 'Upload a source image before running OCR.',
      })
      return
    }

    set({
      ...createInitialState(),
      status: 'running-ocr',
      sourceFile,
    })

    const startedAt = performance.now()

    try {
      const extraction = await extractTextFromImage(sourceFile, {
        language: ocrLanguage,
        useHighContrastPreprocessing,
      })
      const extractedBlocks = flattenBlocks(extraction.blocksByGranularity)

      if (!extraction.text.trim() && extractedBlocks.length === 0) {
        set({
          status: 'failed',
          errorMessage:
            'No text detected. Try cropping tighter around speech bubbles or use a higher-resolution image.',
        })
        return
      }

      set({
        sourceImageSize: extraction.imageSize,
        ocrText: extraction.text,
        ocrBlocksByGranularity: extraction.blocksByGranularity,
        status: 'completed',
        metrics: {
          ...get().metrics,
          ocrDurationMs: Math.round(performance.now() - startedAt),
        },
      })
    } catch (error) {
      set({
        status: 'failed',
        errorMessage: getErrorMessage(error),
      })
    }
  },
  runTranslation: async () => {
    const sourceText = get().ocrText
    const sourceBlocksByGranularity = get().ocrBlocksByGranularity
    const sourceBlocks = flattenBlocks(sourceBlocksByGranularity)
    const fallbackBlockText = sourceBlocks
      .map((block) => block.sourceText)
      .join('\n')
    const sourceTextForTranslation = sourceText.trim() || fallbackBlockText.trim()

    if (!sourceTextForTranslation && sourceBlocks.length === 0) {
      set({
        status: 'failed',
        errorMessage: 'Run OCR first to produce source text before translation.',
      })
      return
    }

    set({
      status: 'running-translation',
      errorMessage: null,
      translatedText: '',
    })

    const startedAt = performance.now()

    try {
      const [translatedText, translatedBlocks] = await Promise.all([
        translateToEnglish(sourceTextForTranslation),
        translateBlocksToEnglish(sourceBlocks),
      ])

      const translatedTextById = new Map(
        translatedBlocks.map((translatedBlock) => [
          translatedBlock.id,
          translatedBlock.translatedText,
        ]),
      )

      set({
        translatedText,
        ocrBlocksByGranularity: {
          group: mergeTranslatedBlocks(sourceBlocksByGranularity.group, translatedTextById),
          line: mergeTranslatedBlocks(sourceBlocksByGranularity.line, translatedTextById),
        },
        status: 'completed',
        metrics: {
          ...get().metrics,
          translationDurationMs: Math.round(performance.now() - startedAt),
        },
      })
    } catch (error) {
      set({
        status: 'failed',
        errorMessage: getErrorMessage(error),
      })
    }
  },
  clearAll: () => {
    set({
      sourceFile: null,
      ...createInitialState(),
    })
  },
  clearError: () => {
    set({ errorMessage: null })
  },
}))
