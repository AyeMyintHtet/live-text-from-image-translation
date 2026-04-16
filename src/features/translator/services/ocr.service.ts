import { createWorker, type Worker } from 'tesseract.js'

import { OCR_LANGUAGE } from '@/constants/app.constants'

let workerPromise: Promise<Worker> | null = null

type OcrCandidate = {
  label: string
  file: File
}

type OcrResult = {
  label: string
  text: string
  confidence: number
}

const MIN_OCR_WIDTH = 1600
const MIN_OCR_HEIGHT = 1200
const MAX_SCALE_FACTOR = 5

const getWorker = (): Promise<Worker> => {
  workerPromise ??= createWorker(OCR_LANGUAGE)
  return workerPromise
}

const normalizeExtractedText = (text: string): string => {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
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

const createUpscaledCanvas = (image: HTMLImageElement): HTMLCanvasElement => {
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

  return canvas
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

const buildOcrCandidates = async (file: File): Promise<OcrCandidate[]> => {
  const image = await loadImageFromFile(file)
  const upscaled = createUpscaledCanvas(image)
  const highContrast = toHighContrast(upscaled, false)
  const invertedContrast = toHighContrast(upscaled, true)

  const [highContrastFile, invertedFile, upscaledFile] = await Promise.all([
    canvasToFile(highContrast, `${file.name}-high-contrast.png`),
    canvasToFile(invertedContrast, `${file.name}-high-contrast-inverted.png`),
    canvasToFile(upscaled, `${file.name}-upscaled.png`),
  ])

  return [
    { label: 'original', file },
    { label: 'upscaled', file: upscaledFile },
    { label: 'high-contrast', file: highContrastFile },
    { label: 'high-contrast-inverted', file: invertedFile },
  ]
}

const containsJapaneseScript = (value: string): boolean => {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]/.test(value)
}

const toResultScore = (result: OcrResult): number => {
  const textLengthBoost = Math.min(result.text.length, 120) * 0.35
  const japaneseScriptBoost = containsJapaneseScript(result.text) ? 20 : 0
  const emptyPenalty = result.text.trim() ? 0 : 120

  return result.confidence + textLengthBoost + japaneseScriptBoost - emptyPenalty
}

export const extractJapaneseText = async (file: File): Promise<string> => {
  const worker = await getWorker()
  const candidates = await buildOcrCandidates(file)
  const results: OcrResult[] = []

  for (const candidate of candidates) {
    const { data } = await worker.recognize(candidate.file)
    results.push({
      label: candidate.label,
      text: normalizeExtractedText(data.text),
      confidence: data.confidence ?? 0,
    })
  }

  results.sort((first, second) => toResultScore(second) - toResultScore(first))
  return results[0]?.text ?? ''
}

export const terminateOcrWorker = async (): Promise<void> => {
  if (!workerPromise) {
    return
  }

  const worker = await workerPromise
  await worker.terminate()
  workerPromise = null
}
