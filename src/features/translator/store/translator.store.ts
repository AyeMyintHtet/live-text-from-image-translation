import { create } from 'zustand'

import { extractJapaneseText } from '@/features/translator/services/ocr.service'
import { translateToEnglish } from '@/features/translator/services/translation.service'
import type {
  PerformanceMetrics,
  WorkflowStatus,
} from '@/features/translator/types'

type TranslatorStore = {
  sourceFile: File | null
  ocrText: string
  translatedText: string
  status: WorkflowStatus
  errorMessage: string | null
  metrics: PerformanceMetrics
  setSourceFile: (file: File | null) => void
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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unexpected processing error. Please try again.'
}

export const useTranslatorStore = create<TranslatorStore>((set, get) => ({
  sourceFile: null,
  ocrText: '',
  translatedText: '',
  status: 'idle',
  errorMessage: null,
  metrics: createInitialMetrics(),
  setSourceFile: (file) => {
    set({
      sourceFile: file,
      ocrText: '',
      translatedText: '',
      status: 'idle',
      errorMessage: null,
      metrics: createInitialMetrics(),
    })
  },
  setWorkflowError: (message) => {
    set({
      status: 'failed',
      errorMessage: message,
    })
  },
  runOcr: async () => {
    const sourceFile = get().sourceFile

    if (!sourceFile) {
      set({
        status: 'failed',
        errorMessage: 'Upload a source image before running OCR.',
      })
      return
    }

    set({
      status: 'running-ocr',
      errorMessage: null,
      ocrText: '',
      translatedText: '',
      metrics: createInitialMetrics(),
    })

    const startedAt = performance.now()

    try {
      const ocrText = await extractJapaneseText(sourceFile)
      if (!ocrText.trim()) {
        set({
          status: 'failed',
          errorMessage:
            'No text detected. Try cropping tighter around speech bubbles or use a higher-resolution image.',
        })
        return
      }

      set({
        ocrText,
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

    if (!sourceText.trim()) {
      set({
        status: 'failed',
        errorMessage: 'Run OCR first to produce Japanese text before translation.',
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
      const translatedText = await translateToEnglish(sourceText)

      set({
        translatedText,
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
      ocrText: '',
      translatedText: '',
      status: 'idle',
      errorMessage: null,
      metrics: createInitialMetrics(),
    })
  },
  clearError: () => {
    set({ errorMessage: null })
  },
}))
