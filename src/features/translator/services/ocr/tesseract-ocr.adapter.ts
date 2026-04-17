import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'

import { getTesseractLanguageCode } from '@/constants/app.constants'
import type { OcrProcessingOptions } from '@/features/translator/services/ocr/ocr-adapter.types'
import type {
  BoundingBox,
  ImageDimensions,
  OcrBlocksByGranularity,
  OcrExtractionResult,
  OcrGranularity,
  OcrLanguage,
  OcrTextBlock,
} from '@/features/translator/types'

const workerPromisesByLanguage = new Map<string, Promise<Worker>>()

type OcrCandidate = {
  label: string
  file: File
  preprocessingScale: number
  originalImageSize: ImageDimensions
}

type OcrCandidateResult = {
  label: string
  presetLabel: string
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

type RecognizePreset = {
  label: string
  options: Record<string, string>
}

type OcrLanguageProfile = {
  tesseractLanguage: string
  usesEnglish: boolean
  usesJapanese: boolean
  recognizePresets: RecognizePreset[]
}

const MIN_OCR_WIDTH = 1600
const MIN_OCR_HEIGHT = 1200
const MAX_SCALE_FACTOR = 9
const MIN_BLOCK_WIDTH = 12
const MIN_BLOCK_HEIGHT = 12
const MIN_WORD_COUNT_FOR_CLUSTERING = 2

const ENGLISH_CHAR_WHITELIST =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?':;\"()-"

const toLanguageCodes = (languageCode: string): string[] => {
  return languageCode
    .split('+')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean)
}

const hasLanguageCode = (languageCode: string, code: string): boolean => {
  return toLanguageCodes(languageCode).includes(code)
}

const resolveTesseractLanguage = (language: OcrLanguage): string => {
  return getTesseractLanguageCode(language)
}

const toLanguageProfile = (language: OcrLanguage): OcrLanguageProfile => {
  const tesseractLanguage = resolveTesseractLanguage(language)
  const usesEnglish = hasLanguageCode(tesseractLanguage, 'eng')
  const baseOptions: Record<string, string> = {
    preserve_interword_spaces: '1',
    ...(usesEnglish
      ? {
          tessedit_char_whitelist: ENGLISH_CHAR_WHITELIST,
        }
      : {}),
  }

  return {
    tesseractLanguage,
    usesEnglish,
    usesJapanese:
      hasLanguageCode(tesseractLanguage, 'jpn') || hasLanguageCode(tesseractLanguage, 'jpn_vert'),
    recognizePresets: [
      {
        label: 'sparse',
        options: {
          ...baseOptions,
          tessedit_pageseg_mode: String(PSM.SPARSE_TEXT),
        },
      },
      {
        label: 'auto',
        options: {
          ...baseOptions,
          tessedit_pageseg_mode: String(PSM.AUTO),
        },
      },
      ...(usesEnglish
        ? [
            {
              label: 'single-column',
              options: {
                ...baseOptions,
                tessedit_pageseg_mode: String(PSM.SINGLE_COLUMN),
              },
            },
          ]
        : []),
    ],
  }
}

const OCR_OUTPUT_OPTIONS = {
  text: true,
  blocks: true,
} as const

const getWorker = (tesseractLanguage: string): Promise<Worker> => {
  const existingWorkerPromise = workerPromisesByLanguage.get(tesseractLanguage)
  if (existingWorkerPromise) {
    return existingWorkerPromise
  }

  const createdWorkerPromise = createWorker(tesseractLanguage, OEM.LSTM_ONLY).catch((error) => {
    workerPromisesByLanguage.delete(tesseractLanguage)
    throw error
  })
  workerPromisesByLanguage.set(tesseractLanguage, createdWorkerPromise)
  return createdWorkerPromise
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
  smoothUpscale: boolean,
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

  context.imageSmoothingEnabled = smoothUpscale
  context.imageSmoothingQuality = smoothUpscale ? 'high' : 'low'
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

const toEnglishTokens = (text: string): string[] => {
  return text
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .filter(Boolean)
}

const isEnglishLexicalToken = (token: string): boolean => {
  return /^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(token)
}

const isConsonantOnlyToken = (token: string): boolean => {
  return /^[BCDFGHJKLMNPQRSTVWXYZ]{3,}$/i.test(token)
}

const toEnglishLetterCount = (text: string): number => {
  return (text.match(/[A-Za-z]/g) ?? []).length
}

const toEnglishNoiseSymbolCount = (text: string): number => {
  return (text.match(/[^A-Za-z0-9\s.,!?'"():;-]/g) ?? []).length
}

const hasSuspiciousCharacterRepeat = (text: string): boolean => {
  const compact = text.replace(/[^A-Za-z0-9]/g, '')
  return compact.length >= 3 && /(.)\1{2,}/i.test(compact)
}

const toEnglishTextQualityScore = (text: string): number => {
  const normalizedText = normalizeExtractedText(text)
  if (!normalizedText) {
    return -120
  }

  const compactLength = toCompactTextLength(normalizedText)
  if (compactLength === 0) {
    return -120
  }

  const letterCount = toEnglishLetterCount(normalizedText)
  const noiseSymbolCount = toEnglishNoiseSymbolCount(normalizedText)
  const letterRatio = letterCount / compactLength
  const noiseRatio = noiseSymbolCount / compactLength
  const tokens = toEnglishTokens(normalizedText)
  const lexicalTokens = tokens.filter((token) => /[A-Za-z]/.test(token))
  const readableTokens = lexicalTokens.filter((token) => isEnglishLexicalToken(token))
  const readableRatio =
    lexicalTokens.length > 0 ? readableTokens.length / lexicalTokens.length : 0
  const shortTokenCount = lexicalTokens.filter((token) => token.length === 1).length
  const longTokenCount = lexicalTokens.filter((token) => token.length >= 15).length
  const consonantOnlyPenalty = lexicalTokens.filter((token) => isConsonantOnlyToken(token))
    .length

  return (
    letterRatio * 95 +
    readableRatio * 85 +
    Math.min(readableTokens.length, 28) * 2 -
    noiseRatio * 150 -
    shortTokenCount * 1.2 -
    longTokenCount * 4 -
    consonantOnlyPenalty * 3
  )
}

const toSingleCharacterTokenCount = (text: string): number => {
  return toEnglishTokens(text).filter((token) => /^[A-Za-z]$/.test(token)).length
}

const isLikelyEnglishTextBlock = (text: string, confidence: number): boolean => {
  const normalizedText = normalizeExtractedText(text)
  if (!normalizedText) {
    return false
  }

  const compactLength = toCompactTextLength(normalizedText)
  if (compactLength <= 2) {
    return /^[A-Za-z0-9]{1,2}$/.test(normalizedText)
  }

  const letterCount = toEnglishLetterCount(normalizedText)
  const noiseSymbolCount = toEnglishNoiseSymbolCount(normalizedText)
  const letterRatio = letterCount / compactLength
  const noiseRatio = noiseSymbolCount / compactLength
  const tokens = toEnglishTokens(normalizedText)
  const lexicalTokens = tokens.filter((token) => /[A-Za-z]/.test(token))
  const readableTokens = lexicalTokens.filter((token) => isEnglishLexicalToken(token))
  const readableRatio =
    lexicalTokens.length > 0 ? readableTokens.length / lexicalTokens.length : 1

  if (confidence < 20 && compactLength < 6) {
    return false
  }

  if (hasSuspiciousCharacterRepeat(normalizedText) && compactLength <= 8) {
    return false
  }

  if (letterRatio < 0.35 || noiseRatio > 0.2) {
    return false
  }

  if (lexicalTokens.length === 1 && isConsonantOnlyToken(lexicalTokens[0])) {
    return false
  }

  if (lexicalTokens.length >= 3 && readableRatio < 0.45) {
    return false
  }

  return toEnglishTextQualityScore(normalizedText) > 10
}

const toRawBlock = (
  sourceText: string,
  confidence: number,
  bbox: BoundingBox,
  unitLevel: OcrGranularity,
  languageProfile: OcrLanguageProfile,
): RawOcrTextBlock | null => {
  const normalizedText = normalizeExtractedText(sourceText)

  if (!normalizedText || !isViableBlock(bbox)) {
    return null
  }

  if (languageProfile.usesEnglish && !isLikelyEnglishTextBlock(normalizedText, confidence)) {
    return null
  }

  return {
    sourceText: normalizedText,
    confidence: clamp(confidence, 0, 100),
    bbox,
    unitLevel,
  }
}

const toLineBlocks = (
  blocks: TesseractBlock[],
  preprocessingScale: number,
  imageSize: ImageDimensions,
  languageProfile: OcrLanguageProfile,
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
      const clusterText = clusterWords
        .map((word) => word.text)
        .join(languageProfile.usesEnglish ? ' ' : '')
      const clusterConfidence = toMedian(clusterWords.map((word) => word.confidence))

      const rawBlock = toRawBlock(
        clusterText,
        clusterConfidence,
        clusterBbox,
        'line',
        languageProfile,
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
          languageProfile,
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
  languageProfile: OcrLanguageProfile,
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
        languageProfile,
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
  languageProfile: OcrLanguageProfile,
): RawOcrTextBlock[] => {
  return blocks
    .map((block) => {
      return toRawBlock(
        block.text,
        block.confidence,
        toOriginalBbox(block.bbox, preprocessingScale, imageSize),
        unitLevel,
        languageProfile,
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

const toAverageBlockConfidence = (blocks: OcrTextBlock[]): number => {
  if (blocks.length === 0) {
    return 0
  }

  const totalConfidence = blocks.reduce((sum, block) => sum + block.confidence, 0)
  return totalConfidence / blocks.length
}

const toEnglishGroupedDisplayText = (text: string): string => {
  const normalized = normalizeExtractedText(text)
  if (!normalized) {
    return ''
  }

  return normalized.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

const toDisplayText = (
  blocksByGranularity: OcrBlocksByGranularity,
  fallbackText: string,
  languageProfile: OcrLanguageProfile,
): string => {
  const groupText = normalizeExtractedText(
    blocksByGranularity.group
      .map((block) =>
        languageProfile.usesEnglish
          ? toEnglishGroupedDisplayText(block.sourceText)
          : normalizeExtractedText(block.sourceText),
      )
      .filter(Boolean)
      .join(languageProfile.usesEnglish ? '\n\n' : '\n'),
  )
  const lineText = normalizeExtractedText(
    blocksByGranularity.line.map((block) => block.sourceText).join('\n'),
  )

  if (languageProfile.usesEnglish) {
    if (groupText) {
      return groupText
    }

    if (lineText) {
      return lineText
    }
  } else {
    const prioritizedText = groupText || lineText
    if (prioritizedText) {
      return prioritizedText
    }
  }

  const normalizedFallbackText = normalizeExtractedText(fallbackText)

  if (languageProfile.usesEnglish && normalizedFallbackText) {
    const filteredFallback = normalizeExtractedText(
      normalizedFallbackText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => isLikelyEnglishTextBlock(line, 100))
        .join('\n'),
    )

    if (filteredFallback) {
      return filteredFallback
    }
  }

  return normalizedFallbackText
}

const toCompactTextLength = (text: string): number => {
  return text.replace(/\s+/g, '').length
}

const toJapaneseCharacterCount = (text: string): number => {
  return (text.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]/g) ?? []).length
}

const toCandidateSourceBoost = (
  label: string,
  languageProfile: OcrLanguageProfile,
): number => {
  if (languageProfile.usesEnglish) {
    switch (label) {
      case 'upscaled-crisp':
        return 4
      case 'original':
        return 2
      case 'high-contrast':
        return -4
      default:
        return 0
    }
  }

  switch (label) {
    case 'high-contrast':
      return 6
    case 'upscaled-crisp':
      return 2
    case 'original':
      return 1
    default:
      return 0
  }
}

const toPresetScoreBoost = (presetLabel: string): number => {
  switch (presetLabel) {
    case 'sparse':
      return 4
    case 'auto':
      return 2
    default:
      return 0
  }
}

const toCandidateScore = (
  result: OcrCandidateResult,
  languageProfile: OcrLanguageProfile,
): number => {
  const representativeBlocks =
    result.blocksByGranularity.group.length > 0
      ? result.blocksByGranularity.group
      : result.blocksByGranularity.line

  const compactLength = toCompactTextLength(result.text)
  const languageTextBoost = languageProfile.usesEnglish
    ? toEnglishTextQualityScore(result.text)
    : languageProfile.usesJapanese
      ? toJapaneseCharacterCount(result.text) * 2
      : 0
  const textLengthBoost = Math.min(compactLength, 280) * 0.45
  const blockCountBoost =
    Math.min(representativeBlocks.length, 24) * (languageProfile.usesEnglish ? 2.2 : 4)
  const averageBlockConfidenceBoost = toAverageBlockConfidence(representativeBlocks) * 0.5
  const blockCoverageBoost = Math.min(
    representativeBlocks.reduce((total, block) => total + toBlockArea(block.bbox), 0) /
      (result.imageSize.width * result.imageSize.height || 1),
    languageProfile.usesEnglish ? 0.5 : 0.6,
  ) * (languageProfile.usesEnglish ? 24 : 70)
  const blockQualityBoost = languageProfile.usesEnglish
    ? representativeBlocks.reduce(
        (sum, block) => sum + Math.max(0, toEnglishTextQualityScore(block.sourceText)),
        0,
      ) /
      (representativeBlocks.length || 1) *
      0.35
    : 0
  const presetBoost = toPresetScoreBoost(result.presetLabel)
  const candidateSourceBoost = toCandidateSourceBoost(result.label, languageProfile)
  const emptyTextPenalty = compactLength === 0 ? 120 : 0
  const singleCharacterPenalty = languageProfile.usesEnglish
    ? representativeBlocks.reduce(
        (sum, block) => sum + toSingleCharacterTokenCount(block.sourceText),
        0,
      ) * 2.8
    : 0

  return (
    result.confidence +
    textLengthBoost +
    languageTextBoost +
    blockCountBoost +
    averageBlockConfidenceBoost +
    blockCoverageBoost +
    blockQualityBoost +
    presetBoost +
    candidateSourceBoost -
    singleCharacterPenalty -
    emptyTextPenalty
  )
}

const buildOcrCandidates = async (
  file: File,
  useHighContrastPreprocessing: boolean,
): Promise<OcrCandidate[]> => {
  const image = await loadImageFromFile(file)
  const originalImageSize: ImageDimensions = {
    width: image.width,
    height: image.height,
  }

  const { canvas: upscaledCrisp, scaleFactor } = createUpscaledCanvas(image, false)
  const upscaledCrispFile = await canvasToFile(upscaledCrisp, `${file.name}-upscaled-crisp.png`)

  const candidates: OcrCandidate[] = [
    {
      label: 'original',
      file,
      preprocessingScale: 1,
      originalImageSize,
    },
    {
      label: 'upscaled-crisp',
      file: upscaledCrispFile,
      preprocessingScale: scaleFactor,
      originalImageSize,
    },
  ]

  if (!useHighContrastPreprocessing) {
    return candidates
  }

  const highContrast = toHighContrast(upscaledCrisp, false)
  const highContrastFile = await canvasToFile(highContrast, `${file.name}-high-contrast.png`)

  return [
    ...candidates,
    {
      label: 'high-contrast',
      file: highContrastFile,
      preprocessingScale: scaleFactor,
      originalImageSize,
    },
  ]
}

export const extractTextWithTesseract = async (
  file: File,
  options: OcrProcessingOptions,
): Promise<OcrExtractionResult> => {
  const languageProfile = toLanguageProfile(options.language)
  const worker = await getWorker(languageProfile.tesseractLanguage)
  const candidates = await buildOcrCandidates(file, options.useHighContrastPreprocessing)

  const results: OcrCandidateResult[] = []

  for (const candidate of candidates) {
    for (const preset of languageProfile.recognizePresets) {
      const { data } = await worker.recognize(candidate.file, preset.options, OCR_OUTPUT_OPTIONS)
      const blocks = (data.blocks ?? []) as TesseractBlock[]

      const rawGroupBlocks = toGroupBlocks(
        blocks,
        candidate.preprocessingScale,
        candidate.originalImageSize,
        languageProfile,
      )

      const rawLineBlocks = toLineBlocks(
        blocks,
        candidate.preprocessingScale,
        candidate.originalImageSize,
        languageProfile,
      )

      const resolvedGroupBlocks =
        rawGroupBlocks.length > 0
          ? rawGroupBlocks
          : toFallbackBlockLevelBlocks(
              blocks,
              candidate.preprocessingScale,
              candidate.originalImageSize,
              'group',
              languageProfile,
            )

      const resolvedLineBlocks =
        rawLineBlocks.length > 0
          ? rawLineBlocks
          : toFallbackBlockLevelBlocks(
              blocks,
              candidate.preprocessingScale,
              candidate.originalImageSize,
              'line',
              languageProfile,
            )

      const blocksByGranularity: OcrBlocksByGranularity = {
        group: normalizeBlocks(resolvedGroupBlocks, 'group'),
        line: normalizeBlocks(resolvedLineBlocks, 'line'),
      }

      results.push({
        label: candidate.label,
        presetLabel: preset.label,
        text: toDisplayText(blocksByGranularity, data.text, languageProfile),
        confidence: clamp(data.confidence ?? 0, 0, 100),
        blocksByGranularity,
        imageSize: candidate.originalImageSize,
      })
    }
  }

  results.sort(
    (first, second) =>
      toCandidateScore(second, languageProfile) - toCandidateScore(first, languageProfile),
  )

  const bestResult = results[0]
  const fallbackImageSize = candidates[0]?.originalImageSize ?? { width: 0, height: 0 }

  if (!bestResult) {
    return {
      text: '',
      blocksByGranularity: {
        group: [],
        line: [],
      },
      imageSize: fallbackImageSize,
    }
  }

  return {
    text: bestResult.text,
    blocksByGranularity: bestResult.blocksByGranularity,
    imageSize: bestResult.imageSize,
  }
}

export const terminateTesseractOcrWorkers = async (): Promise<void> => {
  const workerPromises = [...workerPromisesByLanguage.values()]
  workerPromisesByLanguage.clear()

  if (workerPromises.length === 0) {
    return
  }

  await Promise.allSettled(
    workerPromises.map(async (workerPromise) => {
      const worker = await workerPromise
      await worker.terminate()
    }),
  )
}
