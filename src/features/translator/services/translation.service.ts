import { getTranslationLanguageShortLabel } from '@/constants/app.constants'
import type {
  OcrTextBlock,
  TranslationLanguage,
} from '@/features/translator/types'

export type BlockTranslation = {
  id: string
  translatedText: string
}

export type TranslationTextRequest = {
  text: string
  sourceLanguage: TranslationLanguage
  targetLanguage: TranslationLanguage
}

export type TranslationBlocksRequest = {
  blocks: OcrTextBlock[]
  sourceLanguage: TranslationLanguage
  targetLanguage: TranslationLanguage
}

export type TranslationAdapter = {
  translateText: (request: TranslationTextRequest) => Promise<string>
  translateBlocks: (request: TranslationBlocksRequest) => Promise<BlockTranslation[]>
}

class PlaceholderTranslationAdapter implements TranslationAdapter {
  async translateText(request: TranslationTextRequest): Promise<string> {
    const normalized = request.text.trim()

    if (!normalized) {
      return ''
    }

    if (request.sourceLanguage === request.targetLanguage) {
      return normalized
    }

    return [
      'Demo translation adapter is active.',
      'Connect your preferred translation API inside `src/features/translator/services/translation.service.ts`.',
      '',
      `Source language: ${request.sourceLanguage}`,
      `Target language: ${request.targetLanguage}`,
      '',
      'Input payload:',
      normalized,
    ].join('\n')
  }

  async translateBlocks(request: TranslationBlocksRequest): Promise<BlockTranslation[]> {
    const targetLabel = getTranslationLanguageShortLabel(request.targetLanguage)

    return request.blocks.map((block) => ({
      id: block.id,
      translatedText:
        request.sourceLanguage === request.targetLanguage
          ? block.sourceText
          : `[${targetLabel}] ${block.sourceText}`,
    }))
  }
}

const translationAdapter: TranslationAdapter = new PlaceholderTranslationAdapter()

export const translateText = (request: TranslationTextRequest): Promise<string> => {
  return translationAdapter.translateText(request)
}

export const translateBlocks = (
  request: TranslationBlocksRequest,
): Promise<BlockTranslation[]> => {
  return translationAdapter.translateBlocks(request)
}

export const translateToEnglish = (japaneseText: string): Promise<string> => {
  return translateText({
    text: japaneseText,
    sourceLanguage: 'japanese',
    targetLanguage: 'english',
  })
}

export const translateBlocksToEnglish = (
  blocks: OcrTextBlock[],
): Promise<BlockTranslation[]> => {
  return translateBlocks({
    blocks,
    sourceLanguage: 'japanese',
    targetLanguage: 'english',
  })
}
