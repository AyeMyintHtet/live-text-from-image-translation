import type { BoundingBox, ImageDimensions } from '@/features/translator/types'

export type ScaleRatio = {
  x: number
  y: number
}

export const calculateScaleRatio = (
  originalImageSize: ImageDimensions,
  displayedImageSize: ImageDimensions,
): ScaleRatio => {
  const safeOriginalWidth = Math.max(originalImageSize.width, 1)
  const safeOriginalHeight = Math.max(originalImageSize.height, 1)

  return {
    x: displayedImageSize.width / safeOriginalWidth,
    y: displayedImageSize.height / safeOriginalHeight,
  }
}

export const scaleBoundingBox = (
  bbox: BoundingBox,
  ratio: ScaleRatio,
): BoundingBox => {
  return {
    x0: Math.round(bbox.x0 * ratio.x),
    y0: Math.round(bbox.y0 * ratio.y),
    x1: Math.round(bbox.x1 * ratio.x),
    y1: Math.round(bbox.y1 * ratio.y),
  }
}
