import { MANGA_OCR_DEFAULT_ENDPOINT } from '@/constants/app.constants'

const toConfiguredEndpoint = (): string | null => {
  const configured = import.meta.env.VITE_MANGA_OCR_ENDPOINT
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim()
  }

  return null
}

export const resolveMangaOcrEndpoint = (): string => {
  return toConfiguredEndpoint() ?? MANGA_OCR_DEFAULT_ENDPOINT
}

export const isMangaOcrExplicitlyConfigured = (): boolean => {
  return Boolean(toConfiguredEndpoint())
}

export const isMangaOcrDisabledInCurrentEnv = (): boolean => {
  return false
}
