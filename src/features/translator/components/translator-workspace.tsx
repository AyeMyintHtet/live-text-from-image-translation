import {
  AlertTriangle,
  Clock3,
  Languages,
  ScanText,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { SettingsSelect, SettingsToggle } from '@/components/ui/settings-controls'
import { SectionHeading } from '@/components/ui/section-heading'
import {
  APP_COPY,
  OCR_ENGINE_OPTIONS,
  OCR_LANGUAGE_OPTIONS,
  STATUS_LABELS,
  TRANSLATION_LANGUAGE_OPTIONS,
  isOcrEngineLanguageSupported,
  isOcrEngineSupportsHighContrastPreprocessing,
} from '@/constants/app.constants'
import { ImageOverlayPreview } from '@/features/translator/components/image-overlay-preview'
import { isMangaOcrDisabledInCurrentEnv } from '@/features/translator/services/ocr/manga-ocr.config'
import { terminateOcrWorker } from '@/features/translator/services/ocr.service'
import { useTranslatorStore } from '@/features/translator/store/translator.store'
import type {
  OcrEngine,
  OcrGranularity,
  OcrLanguage,
  TranslationLanguage,
  WorkflowStatus,
} from '@/features/translator/types'
import { cn } from '@/lib/cn'

const statusLabelMap: Record<WorkflowStatus, string> = {
  idle: STATUS_LABELS.idle,
  'running-ocr': STATUS_LABELS.runningOcr,
  'running-translation': STATUS_LABELS.runningTranslation,
  completed: STATUS_LABELS.completed,
  failed: STATUS_LABELS.failed,
}

const statusToneMap: Record<WorkflowStatus, string> = {
  idle: 'border-[var(--color-border-default)] bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]',
  'running-ocr': 'border-[var(--color-status-info)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)]',
  'running-translation': 'border-[var(--color-status-info)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)]',
  completed: 'border-[var(--color-status-success)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)]',
  failed: 'border-[var(--color-status-error)] bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)]',
}

type OutputPanelProps = {
  title: string
  description: string
  content: string
  placeholder: string
}

const OutputPanel = ({
  title,
  description,
  content,
  placeholder,
}: OutputPanelProps) => {
  return (
    <Card className="h-full">
      <SectionHeading description={description}>{title}</SectionHeading>
      <div className="mt-4 min-h-[300px] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] p-4">
        {content.trim() ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
            {content}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">{placeholder}</p>
        )}
      </div>
    </Card>
  )
}

export const TranslatorWorkspace = () => {
  const {
    sourceFile,
    sourceImageSize,
    ocrText,
    translatedText,
    ocrBlocksByGranularity,
    ocrEngine,
    ocrLanguage,
    translationTargetLanguage,
    useHighContrastPreprocessing,
    overlayGranularity,
    status,
    errorMessage,
    metrics,
    setSourceFile,
    setOcrEngine,
    setOcrLanguage,
    setTranslationTargetLanguage,
    setUseHighContrastPreprocessing,
    setOverlayGranularity,
    runOcr,
    runTranslation,
    clearAll,
    setWorkflowError,
    clearError,
  } = useTranslatorStore((state) => state)

  const previewUrl = useMemo(() => {
    return sourceFile ? URL.createObjectURL(sourceFile) : null
  }, [sourceFile])

  const activeOverlayBlocks = useMemo(() => {
    return ocrBlocksByGranularity[overlayGranularity]
  }, [ocrBlocksByGranularity, overlayGranularity])

  const translatedOverlayBlocks = useMemo(() => {
    return activeOverlayBlocks.filter((block) => block.translatedText.trim())
  }, [activeOverlayBlocks])

  const selectedEngineLabel = useMemo(() => {
    return OCR_ENGINE_OPTIONS.find((option) => option.value === ocrEngine)?.label ?? 'OCR'
  }, [ocrEngine])

  const selectedLanguageLabel = useMemo(() => {
    return OCR_LANGUAGE_OPTIONS.find((option) => option.value === ocrLanguage)?.label ?? 'OCR'
  }, [ocrLanguage])

  const selectedTargetLanguageLabel = useMemo(() => {
    return (
      TRANSLATION_LANGUAGE_OPTIONS.find((option) => option.value === translationTargetLanguage)
        ?.label ?? 'Target'
    )
  }, [translationTargetLanguage])

  const ocrLanguageSelectOptions = useMemo(() => {
    return OCR_LANGUAGE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      disabled: !isOcrEngineLanguageSupported(ocrEngine, option.value),
    }))
  }, [ocrEngine])

  const isMangaOcrUnavailable = useMemo(() => {
    return isMangaOcrDisabledInCurrentEnv()
  }, [])

  const selectedEngineDescription = useMemo(() => {
    const base =
      OCR_ENGINE_OPTIONS.find((option) => option.value === ocrEngine)?.description ?? ''

    if (ocrEngine === 'mangaOcr' && isMangaOcrUnavailable) {
      return `${base} Configure VITE_MANGA_OCR_ENDPOINT to enable this engine in local development.`
    }

    return base
  }, [ocrEngine, isMangaOcrUnavailable])

  const supportsHighContrast = useMemo(() => {
    return isOcrEngineSupportsHighContrastPreprocessing(ocrEngine)
  }, [ocrEngine])

  const totalOcrBlockCount = useMemo(() => {
    return ocrBlocksByGranularity.group.length + ocrBlocksByGranularity.line.length
  }, [ocrBlocksByGranularity])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const isRunning = status === 'running-ocr' || status === 'running-translation'
  const canRunTranslation = ocrText.trim().length > 0 || totalOcrBlockCount > 0

  useEffect(() => {
    return () => {
      void terminateOcrWorker()
    }
  }, [])

  return (
    <div className="space-y-6">
      <Card tone="muted" className="border-[var(--color-border-strong)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">{APP_COPY.productTagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                  statusToneMap[status],
                )}
              >
                {statusLabelMap[status]}
              </span>
              {metrics.ocrDurationMs ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
                  <Clock3 size={13} /> OCR {metrics.ocrDurationMs} ms
                </span>
              ) : null}
              {metrics.translationDurationMs ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
                  <Clock3 size={13} /> Translation {metrics.translationDurationMs} ms
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingsSelect
                id="ocr-engine"
                label="OCR Engine"
                value={ocrEngine}
                options={OCR_ENGINE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                  disabled: option.value === 'mangaOcr' && isMangaOcrUnavailable,
                }))}
                helperText={selectedEngineDescription}
                disabled={isRunning}
                onChange={(value) => {
                  setOcrEngine(value as OcrEngine)
                }}
              />
              <SettingsSelect
                id="ocr-language"
                label="OCR Language"
                value={ocrLanguage}
                options={ocrLanguageSelectOptions}
                disabled={isRunning}
                onChange={(value) => {
                  setOcrLanguage(value as OcrLanguage)
                }}
              />
              <SettingsSelect
                id="translation-target-language"
                label="Translation Target"
                value={translationTargetLanguage}
                options={TRANSLATION_LANGUAGE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                disabled={isRunning}
                onChange={(value) => {
                  setTranslationTargetLanguage(value as TranslationLanguage)
                }}
              />
              <SettingsToggle
                id="ocr-high-contrast"
                label="High Contrast Preprocess"
                checked={useHighContrastPreprocessing}
                disabled={isRunning || !supportsHighContrast}
                helperText={
                  supportsHighContrast
                    ? 'Applies image contrast enhancement before OCR.'
                    : 'This OCR engine does not use local high-contrast preprocessing.'
                }
                onChange={(checked) => {
                  setUseHighContrastPreprocessing(checked)
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  void runOcr()
                }}
                disabled={isRunning || !sourceFile}
              >
                <ScanText size={16} /> Run OCR
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void runTranslation()
                }}
                disabled={isRunning || !canRunTranslation}
              >
                <Languages size={16} /> Translate
              </Button>
              <Button variant="ghost" onClick={clearAll} disabled={isRunning}>
                <Trash2 size={16} /> Reset
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {errorMessage ? (
        <Card className="border-[var(--color-status-error)] bg-[var(--color-bg-overlay)]">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
              <AlertTriangle size={16} className="mt-0.5 text-[var(--color-status-error)]" />
              <span>{errorMessage}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr_1fr]">
        <Card className="h-full">
          <SectionHeading description={APP_COPY.sourcePanelDescription}>
            {APP_COPY.sourcePanelTitle}
          </SectionHeading>
          <div className="mt-4 space-y-4">
            <FileDropzone
              selectedFile={sourceFile}
              onFileSelected={(file) => {
                setSourceFile(file)
              }}
              onValidationError={(message) => {
                setSourceFile(null)
                setWorkflowError(message)
              }}
              disabled={isRunning}
            />

            {previewUrl ? (
              <div className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]">
                <img
                  src={previewUrl}
                  alt="Selected source"
                  className="h-auto w-full object-contain"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                Preview appears here after selecting an image.
              </div>
            )}
          </div>
        </Card>

        <OutputPanel
          title={APP_COPY.ocrPanelTitle}
          description={`${APP_COPY.ocrPanelDescription} Current: ${selectedEngineLabel} + ${selectedLanguageLabel}.`}
          content={ocrText}
          placeholder="Run OCR to see extracted text here."
        />

        <OutputPanel
          title={APP_COPY.translationPanelTitle}
          description={`${APP_COPY.translationPanelDescription} Target: ${selectedTargetLanguageLabel}.`}
          content={translatedText}
          placeholder="Run translation to see translated output here."
        />
      </div>

      <Card>
        <SectionHeading description={APP_COPY.overlayPanelDescription}>
          {APP_COPY.overlayPanelTitle}
        </SectionHeading>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['line', 'group'] as OcrGranularity[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={overlayGranularity === mode ? 'primary' : 'secondary'}
                onClick={() => {
                  setOverlayGranularity(mode)
                }}
                disabled={isRunning}
              >
                {mode === 'line' ? 'Line Split Overlay' : 'Grouped Overlay'}
              </Button>
            ))}
          </div>

          {previewUrl ? (
            translatedOverlayBlocks.length > 0 ? (
              <ImageOverlayPreview
                imageSrc={previewUrl}
                alt="Overlay output preview"
                originalImageSize={sourceImageSize}
                blocks={translatedOverlayBlocks}
              />
            ) : (
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                Run <strong>Translate</strong> to render translated overlay boxes on the image.
              </div>
            )
          ) : (
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
              Upload an image, run OCR, then run translation to preview the final overlay result.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
