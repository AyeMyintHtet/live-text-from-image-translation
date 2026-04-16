import { createWorker, OEM, type Worker } from 'tesseract.js'

import { OCR_LANGUAGE } from '@/constants/app.constants'
import type {
  BoundingBox,
  ImageDimensions,
  OcrBlocksByGranularity,
  OcrExtractionResult,
  OcrGranularity,
  OcrTextBlock,
} from '@/features/translator/types'

let workerPromise: Promise<Worker> | null = null

type OcrCandidate = {
  label: string
  file: File
  preprocessingScale: number
  originalImageSize: ImageDimensions
}

type OcrCandidateResult = {
  label: string
  text: string
  confidence: number
  blocksByGranularity: OcrBlocksByGranularity
  imageSize: ImageDimensions
}

type TesseractBbox = {
  x0: number
  y0: number
  x1: number
  y1: number
}

type TesseractLine = {
  text: string
  confidence: number
  bbox: TesseractBbox
  words?: TesseractWord[]
}

type TesseractWord = {
  text: string
  confidence: number
  bbox: TesseractBbox
}

type TesseractParagraph = {
  text: string
  confidence: number
  bbox: TesseractBbox
  lines: TesseractLine[]
}

type TesseractBlock = {
  text: string
  confidence: number
  bbox: TesseractBbox
  paragraphs: TesseractParagraph[]
}

type RawOcrTextBlock = Omit<OcrTextBlock, 'id' | 'translatedText'>

const MIN_OCR_WIDTH = 1600
const MIN_OCR_HEIGHT = 1200
const MAX_SCALE_FACTOR = 5
const MIN_BLOCK_WIDTH = 12
const MIN_BLOCK_HEIGHT = 12
const MIN_WORD_COUNT_FOR_CLUSTERING = 2

const OCR_OUTPUT_OPTIONS = {
  text: true,
  blocks: true,
} as const

const OCR_WORKER_OPTIONS = {
  // Use full core to avoid noisy "Parameter not found" warnings emitted by LSTM-only core.
  // OCR mode remains LSTM_ONLY for speed/accuracy balance.
  legacyCore: true,
} as const

const getWorker = (): Promise<Worker> => {
  workerPromise ??= createWorker(OCR_LANGUAGE, OEM.LSTM_ONLY, OCR_WORKER_OPTIONS)
  return workerPromise
}

const normalizeExtractedText = (text: string): string => {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

const toOtsuThreshold = (histogram: number[], pixelCount: number): number => {
  let weightedTotal = 0
  for (let value = 0; value < histogram.length; value += 1) {
    weightedTotal += value * histogram[value]
  }

  let sumBackground = 0
  let weightBackground = 0
  let bestThreshold = 127
  let maxVariance = 0

  for (let threshold = 0; threshold < histogram.length; threshold += 1) {
    weightBackground += histogram[threshold]
    if (weightBackground === 0) {
      continue
    }

    const weightForeground = pixelCount - weightBackground
    if (weightForeground === 0) {
      break
    }

    sumBackground += threshold * histogram[threshold]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (weightedTotal - sumBackground) / weightForeground
    const varianceBetween =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) *
      (meanBackground - meanForeground)

    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween
      bestThreshold = threshold
    }
  }

  return bestThreshold
}

const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to load source image for OCR preprocessing.'))
    }

    image.src = objectUrl
  })
}

const createUpscaledCanvas = (
  image: HTMLImageElement,
): {
  canvas: HTMLCanvasElement
  scaleFactor: number
} => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas context is not available in this browser.')
  }

  const widthScale = MIN_OCR_WIDTH / image.width
  const heightScale = MIN_OCR_HEIGHT / image.height
  const scaleFactor = Math.min(Math.max(widthScale, heightScale, 1), MAX_SCALE_FACTOR)

  canvas.width = Math.max(1, Math.round(image.width * scaleFactor))
  canvas.height = Math.max(1, Math.round(image.height * scaleFactor))

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return {
    canvas,
    scaleFactor,
  }
}

const toHighContrast = (
  baseCanvas: HTMLCanvasElement,
  invert: boolean,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = baseCanvas.width
  canvas.height = baseCanvas.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas context is not available in this browser.')
  }

  context.drawImage(baseCanvas, 0, 0)

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const pixelCount = pixels.length / 4

  const histogram = new Array<number>(256).fill(0)
  const luminance = new Uint8Array(pixelCount)
  let min = 255
  let max = 0

  for (let index = 0; index < pixelCount; index += 1) {
    const baseOffset = index * 4
    const red = pixels[baseOffset]
    const green = pixels[baseOffset + 1]
    const blue = pixels[baseOffset + 2]
    const luma = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue)

    luminance[index] = luma
    min = Math.min(min, luma)
    max = Math.max(max, luma)
  }

  const range = Math.max(1, max - min)
  const normalized = new Uint8Array(pixelCount)

  for (let index = 0; index < pixelCount; index += 1) {
    const stretched = Math.round(((luminance[index] - min) * 255) / range)
    normalized[index] = stretched
    histogram[stretched] += 1
  }

  const threshold = toOtsuThreshold(histogram, pixelCount)

  for (let index = 0; index < pixelCount; index += 1) {
    const pixelOffset = index * 4
    let value = normalized[index] > threshold ? 255 : 0
    if (invert) {
      value = 255 - value
    }

    pixels[pixelOffset] = value
    pixels[pixelOffset + 1] = value
    pixels[pixelOffset + 2] = value
    pixels[pixelOffset + 3] = 255
  }

  context.putImageData(imageData, 0, 0)
  return canvas
}

const canvasToFile = (
  canvas: HTMLCanvasElement,
  name: string,
): Promise<File> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to build preprocessed image for OCR.'))
          return
        }

        resolve(new File([blob], name, { type: 'image/png' }))
      },
      'image/png',
      1,
    )
  })
}

const toOriginalCoordinate = (value: number, scaleFactor: number): number => {
  return Math.round(value / scaleFactor)
}

const toOriginalBbox = (
  bbox: TesseractBbox,
  scaleFactor: number,
  imageSize: ImageDimensions,
): BoundingBox => {
  return {
    x0: clamp(toOriginalCoordinate(bbox.x0, scaleFactor), 0, imageSize.width),
    y0: clamp(toOriginalCoordinate(bbox.y0, scaleFactor), 0, imageSize.height),
    x1: clamp(toOriginalCoordinate(bbox.x1, scaleFactor), 0, imageSize.width),
    y1: clamp(toOriginalCoordinate(bbox.y1, scaleFactor), 0, imageSize.height),
  }
}

const toBlockArea = (bbox: BoundingBox): number => {
  return Math.max(0, bbox.x1 - bbox.x0) * Math.max(0, bbox.y1 - bbox.y0)
}

const toUnionBbox = (bboxes: BoundingBox[]): BoundingBox => {
  const initial = bboxes[0]

  if (!initial) {
    return { x0: 0, y0: 0, x1: 0, y1: 0 }
  }

  return bboxes.slice(1).reduce(
    (merged, bbox) => ({
      x0: Math.min(merged.x0, bbox.x0),
      y0: Math.min(merged.y0, bbox.y0),
      x1: Math.max(merged.x1, bbox.x1),
      y1: Math.max(merged.y1, bbox.y1),
    }),
    initial,
  )
}

const isViableBlock = (bbox: BoundingBox): boolean => {
  const width = bbox.x1 - bbox.x0
  const height = bbox.y1 - bbox.y0
  return width >= MIN_BLOCK_WIDTH && height >= MIN_BLOCK_HEIGHT
}

const toMedian = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const center = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[center - 1] + sorted[center]) / 2
  }

  return sorted[center]
}

const toRawBlock = (
  sourceText: string,
  confidence: number,
  bbox: BoundingBox,
  unitLevel: OcrGranularity,
): RawOcrTextBlock | null => {
  const normalizedText = normalizeExtractedText(sourceText)

  if (!normalizedText || !isViableBlock(bbox)) {
    return null
  }

  return {
    sourceText: normalizedText,
    confidence,
    bbox,
    unitLevel,
  }
}

const toLineBlocks = (
  blocks: TesseractBlock[],
  preprocessingScale: number,
  imageSize: ImageDimensions,
): RawOcrTextBlock[] => {
  const extractedBlocks: RawOcrTextBlock[] = []

  const pushWordClusterBlocks = (
    line: TesseractLine,
    words: TesseractWord[],
  ): boolean => {
    if (words.length < MIN_WORD_COUNT_FOR_CLUSTERING) {
      return false
    }

    const originalLineBbox = toOriginalBbox(line.bbox, preprocessingScale, imageSize)
    const isVerticalLine =
      originalLineBbox.y1 - originalLineBbox.y0 > originalLineBbox.x1 - originalLineBbox.x0

    const sortedWords = [...words].sort((first, second) =>
      isVerticalLine
        ? first.bbox.y0 - second.bbox.y0
        : first.bbox.x0 - second.bbox.x0,
    )

    const gaps: number[] = []
    for (let index = 0; index < sortedWords.length - 1; index += 1) {
      const current = sortedWords[index]
      const next = sortedWords[index + 1]

      const gap = isVerticalLine
        ? next.bbox.y0 - current.bbox.y1
        : next.bbox.x0 - current.bbox.x1

      gaps.push(Math.max(0, gap))
    }

    const medianGap = toMedian(gaps)
    const splitGapThreshold = Math.max(10, medianGap * 2.7)
    const clusters: TesseractWord[][] = []
    let currentCluster: TesseractWord[] = []

    sortedWords.forEach((word, index) => {
      if (index === 0) {
        currentCluster = [word]
        return
      }

      const previous = sortedWords[index - 1]
      const gap = isVerticalLine
        ? word.bbox.y0 - previous.bbox.y1
        : word.bbox.x0 - previous.bbox.x1

      if (gap > splitGapThreshold) {
        clusters.push(currentCluster)
        currentCluster = [word]
        return
      }

      currentCluster.push(word)
    })

    if (currentCluster.length > 0) {
      clusters.push(currentCluster)
    }

    let created = false

    clusters.forEach((cluster) => {
      const clusterWords = cluster.filter((word) => normalizeExtractedText(word.text))
      if (clusterWords.length === 0) {
        return
      }

      const clusterBbox = toUnionBbox(
        clusterWords.map((word) =>
          toOriginalBbox(word.bbox, preprocessingScale, imageSize),
        ),
      )
      const clusterText = clusterWords.map((word) => word.text).join('')
      const clusterConfidence = toMedian(clusterWords.map((word) => word.confidence))

      const rawBlock = toRawBlock(
        clusterText,
        clusterConfidence,
        clusterBbox,
        'line',
      )

      if (rawBlock) {
        extractedBlocks.push(rawBlock)
        created = true
      }
    })

    return created
  }

  blocks.forEach((block) => {
    block.paragraphs.forEach((paragraph) => {
      const lines = paragraph.lines ?? []

      lines.forEach((line) => {
        const words = (line.words ?? []).filter((word) =>
          normalizeExtractedText(word.text),
        )

        if (pushWordClusterBlocks(line, words)) {
          return
        }

        const rawBlock = toRawBlock(
          line.text,
          line.confidence,
          toOriginalBbox(line.bbox, preprocessingScale, imageSize),
          'line',
        )

        if (rawBlock) {
          extractedBlocks.push(rawBlock)
        }
      })
    })
  })

  return extractedBlocks
}

const toGroupBlocks = (
  blocks: TesseractBlock[],
  preprocessingScale: number,
  imageSize: ImageDimensions,
): RawOcrTextBlock[] => {
  const extractedBlocks: RawOcrTextBlock[] = []

  blocks.forEach((block) => {
    block.paragraphs.forEach((paragraph) => {
      const lineBboxes = (paragraph.lines ?? [])
        .map((line) =>
          toOriginalBbox(line.bbox, preprocessingScale, imageSize),
        )
        .filter((bbox) => isViableBlock(bbox))

      const paragraphBbox =
        lineBboxes.length > 0
          ? toUnionBbox(lineBboxes)
          : toOriginalBbox(paragraph.bbox, preprocessingScale, imageSize)

      const rawBlock = toRawBlock(
        paragraph.text,
        paragraph.confidence,
        paragraphBbox,
        'group',
      )

      if (rawBlock) {
        extractedBlocks.push(rawBlock)
      }
    })
  })

  return extractedBlocks
}

const toFallbackBlockLevelBlocks = (
  blocks: TesseractBlock[],
  preprocessingScale: number,
  imageSize: ImageDimensions,
  unitLevel: OcrGranularity,
): RawOcrTextBlock[] => {
  return blocks
    .map((block) => {
      return toRawBlock(
        block.text,
        block.confidence,
        toOriginalBbox(block.bbox, preprocessingScale, imageSize),
        unitLevel,
      )
    })
    .filter((block): block is RawOcrTextBlock => Boolean(block))
}

const normalizeBlocks = (
  blocks: RawOcrTextBlock[],
  unitLevel: OcrGranularity,
): OcrTextBlock[] => {
  return blocks
    .sort((first, second) => {
      if (first.bbox.y0 !== second.bbox.y0) {
        return first.bbox.y0 - second.bbox.y0
      }

      return first.bbox.x0 - second.bbox.x0
    })
    .map((block, index) => ({
      ...block,
      id: `${unitLevel}-${index + 1}`,
      translatedText: '',
      unitLevel,
    }))
}

const toCandidateScore = (result: OcrCandidateResult): number => {
  const representativeBlocks =
    result.blocksByGranularity.group.length > 0
      ? result.blocksByGranularity.group
      : result.blocksByGranularity.line

  const textLengthBoost = Math.min(result.text.length, 160) * 0.35
  const japaneseScriptBoost = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]/.test(result.text)
    ? 20
    : 0
  const blockCountBoost = Math.min(representativeBlocks.length, 20) * 4
  const blockCoverageBoost = Math.min(
    representativeBlocks.reduce((total, block) => total + toBlockArea(block.bbox), 0) /
      (result.imageSize.width * result.imageSize.height || 1),
    0.55,
  ) * 100

  return (
    result.confidence +
    textLengthBoost +
    japaneseScriptBoost +
    blockCountBoost +
    blockCoverageBoost
  )
}

const buildOcrCandidates = async (file: File): Promise<OcrCandidate[]> => {
  const image = await loadImageFromFile(file)
  const originalImageSize: ImageDimensions = {
    width: image.width,
    height: image.height,
  }

  const { canvas: upscaled, scaleFactor } = createUpscaledCanvas(image)
  const highContrast = toHighContrast(upscaled, false)
  const invertedContrast = toHighContrast(upscaled, true)

  const [upscaledFile, highContrastFile, invertedFile] = await Promise.all([
    canvasToFile(upscaled, `${file.name}-upscaled.png`),
    canvasToFile(highContrast, `${file.name}-high-contrast.png`),
    canvasToFile(invertedContrast, `${file.name}-high-contrast-inverted.png`),
  ])

  return [
    {
      label: 'original',
      file,
      preprocessingScale: 1,
      originalImageSize,
    },
    {
      label: 'upscaled',
      file: upscaledFile,
      preprocessingScale: scaleFactor,
      originalImageSize,
    },
    {
      label: 'high-contrast',
      file: highContrastFile,
      preprocessingScale: scaleFactor,
      originalImageSize,
    },
    {
      label: 'high-contrast-inverted',
      file: invertedFile,
      preprocessingScale: scaleFactor,
      originalImageSize,
    },
  ]
}

export const extractJapaneseText = async (
  file: File,
): Promise<OcrExtractionResult> => {
  const worker = await getWorker()
  const candidates = await buildOcrCandidates(file)

  const results: OcrCandidateResult[] = []

  for (const candidate of candidates) {
    const { data } = await worker.recognize(candidate.file, {}, OCR_OUTPUT_OPTIONS)
    const blocks = (data.blocks ?? []) as TesseractBlock[]

    const rawGroupBlocks = toGroupBlocks(
      blocks,
      candidate.preprocessingScale,
      candidate.originalImageSize,
    )

    const rawLineBlocks = toLineBlocks(
      blocks,
      candidate.preprocessingScale,
      candidate.originalImageSize,
    )

    const resolvedGroupBlocks =
      rawGroupBlocks.length > 0
        ? rawGroupBlocks
        : toFallbackBlockLevelBlocks(
            blocks,
            candidate.preprocessingScale,
            candidate.originalImageSize,
            'group',
          )

    const resolvedLineBlocks =
      rawLineBlocks.length > 0
        ? rawLineBlocks
        : toFallbackBlockLevelBlocks(
            blocks,
            candidate.preprocessingScale,
            candidate.originalImageSize,
            'line',
          )

    results.push({
      label: candidate.label,
      text: normalizeExtractedText(data.text),
      confidence: data.confidence ?? 0,
      blocksByGranularity: {
        group: normalizeBlocks(resolvedGroupBlocks, 'group'),
        line: normalizeBlocks(resolvedLineBlocks, 'line'),
      },
      imageSize: candidate.originalImageSize,
    })
  }

  results.sort((first, second) => toCandidateScore(second) - toCandidateScore(first))

  const bestResult = results[0]

  if (!bestResult) {
    return {
      text: '',
      blocksByGranularity: {
        group: [],
        line: [],
      },
      imageSize: { width: 0, height: 0 },
    }
  }

  return {
    text: bestResult.text,
    blocksByGranularity: bestResult.blocksByGranularity,
    imageSize: bestResult.imageSize,
  }
}

export const terminateOcrWorker = async (): Promise<void> => {
  if (!workerPromise) {
    return
  }

  const worker = await workerPromise
  await worker.terminate()
  workerPromise = null
}
