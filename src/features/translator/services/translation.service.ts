import type { OcrTextBlock } from '@/features/translator/types'

export type BlockTranslation = {
  id: string
  translatedText: string
}

export type TranslationAdapter = {
  translateToEnglish: (japaneseText: string) => Promise<string>
  translateBlocksToEnglish: (blocks: OcrTextBlock[]) => Promise<BlockTranslation[]>
}

class PlaceholderTranslationAdapter implements TranslationAdapter {
  async translateToEnglish(japaneseText: string): Promise<string> {
    const normalized = japaneseText.trim()

    if (!normalized) {
      return ''
    }

    return [
      'Demo translation adapter is active.',
      'Connect your preferred translation API inside `src/features/translator/services/translation.service.ts`.',
      '',
      'Input payload:',
      normalized,
    ].join('\n')
  }

  async translateBlocksToEnglish(blocks: OcrTextBlock[]): Promise<BlockTranslation[]> {
    return blocks.map((block) => ({
      id: block.id,
      translatedText: `[EN] ${block.sourceText}`,
    }))
  }
}

const translationAdapter: TranslationAdapter = new PlaceholderTranslationAdapter()

export const translateToEnglish = (japaneseText: string): Promise<string> => {
  return translationAdapter.translateToEnglish(japaneseText)
}

export const translateBlocksToEnglish = (
  blocks: OcrTextBlock[],
): Promise<BlockTranslation[]> => {
  return translationAdapter.translateBlocksToEnglish(blocks)
}
