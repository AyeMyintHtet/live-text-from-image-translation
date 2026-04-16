export type TranslationAdapter = {
  translateToEnglish: (japaneseText: string) => Promise<string>
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
}

const translationAdapter: TranslationAdapter = new PlaceholderTranslationAdapter()

export const translateToEnglish = (japaneseText: string): Promise<string> => {
  return translationAdapter.translateToEnglish(japaneseText)
}
