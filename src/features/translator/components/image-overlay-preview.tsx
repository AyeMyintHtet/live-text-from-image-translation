import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  calculateScaleRatio,
  scaleBoundingBox,
} from '@/features/translator/lib/overlay-scaling'
import type {
  ImageDimensions,
  OcrTextBlock,
} from '@/features/translator/types'

type ImageOverlayPreviewProps = {
  imageSrc: string
  alt: string
  originalImageSize: ImageDimensions | null
  blocks: OcrTextBlock[]
}

const getResponsiveFontSize = (height: number): number => {
  const scaled = Math.round(height * 0.18)
  return Math.min(Math.max(scaled, 10), 22)
}

const getRoundedBubbleRadius = (width: number, height: number): number => {
  const shortSide = Math.max(1, Math.min(width, height))
  return Math.max(12, Math.round(shortSide * 0.45))
}

const toRenderedText = (block: OcrTextBlock): string => {
  return block.translatedText.trim() || block.sourceText
}

const isValidImageSize = (size: ImageDimensions | null): size is ImageDimensions => {
  return Boolean(size && size.width > 0 && size.height > 0)
}

export const ImageOverlayPreview = ({
  imageSrc,
  alt,
  originalImageSize,
  blocks,
}: ImageOverlayPreviewProps) => {
  const imageRef = useRef<HTMLImageElement>(null)
  const [displayedImageSize, setDisplayedImageSize] = useState<ImageDimensions>({
    width: 0,
    height: 0,
  })
  const [naturalImageSize, setNaturalImageSize] = useState<ImageDimensions | null>(null)

  const updateDisplayedImageSize = useCallback(() => {
    if (!imageRef.current) {
      return
    }

    const rect = imageRef.current.getBoundingClientRect()
    setDisplayedImageSize({
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    })
  }, [])

  useEffect(() => {
    if (!imageRef.current) {
      return
    }

    updateDisplayedImageSize()

    const observer = new ResizeObserver(() => {
      updateDisplayedImageSize()
    })

    observer.observe(imageRef.current)

    return () => {
      observer.disconnect()
    }
  }, [updateDisplayedImageSize])

  const resolvedOriginalSize = isValidImageSize(originalImageSize)
    ? originalImageSize
    : naturalImageSize

  const scaleRatio = useMemo(() => {
    if (!resolvedOriginalSize || displayedImageSize.width === 0 || displayedImageSize.height === 0) {
      return null
    }

    return calculateScaleRatio(resolvedOriginalSize, displayedImageSize)
  }, [displayedImageSize, resolvedOriginalSize])

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]">
      <img
        ref={imageRef}
        src={imageSrc}
        alt={alt}
        className="h-auto w-full object-contain"
        onLoad={(event) => {
          const target = event.currentTarget
          setNaturalImageSize({
            width: target.naturalWidth,
            height: target.naturalHeight,
          })
          updateDisplayedImageSize()
        }}
      />

      {scaleRatio
        ? blocks.map((block) => {
            const scaledBbox = scaleBoundingBox(block.bbox, scaleRatio)
            const width = Math.max(0, scaledBbox.x1 - scaledBbox.x0)
            const height = Math.max(0, scaledBbox.y1 - scaledBbox.y0)
            const renderedText = toRenderedText(block)

            if (width === 0 || height === 0 || !renderedText) {
              return null
            }

            return (
              <div
                key={block.id}
                className="pointer-events-none absolute flex items-center justify-center overflow-hidden border border-black/20 bg-white text-center text-slate-900 shadow-sm"
                style={{
                  left: scaledBbox.x0,
                  top: scaledBbox.y0,
                  width,
                  height,
                  fontSize: `${getResponsiveFontSize(height)}px`,
                  lineHeight: 1.2,
                  padding: '6px 8px',
                  borderRadius: `${getRoundedBubbleRadius(width, height)}px`,
                }}
                title={block.sourceText}
              >
                <span className="block w-full overflow-hidden break-words font-medium leading-tight">
                  {renderedText}
                </span>
              </div>
            )
          })
        : null}
    </div>
  )
}
