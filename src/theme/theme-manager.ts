import {
  THEME_STORAGE_KEY,
  type ThemeMode,
  resolveThemeVariables,
} from '@/constants/theme.constants'

const isThemeMode = (value: string | null): value is ThemeMode => {
  return value === 'light' || value === 'dark'
}

export const getSystemTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export const getStoredTheme = (): ThemeMode | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeMode(storedTheme) ? storedTheme : null
}

export const getInitialTheme = (): ThemeMode => {
  return getStoredTheme() ?? getSystemTheme()
}

export const applyTheme = (mode: ThemeMode): void => {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  const variables = resolveThemeVariables(mode)

  root.classList.toggle('dark', mode === 'dark')
  root.style.colorScheme = mode

  Object.entries(variables).forEach(([token, value]) => {
    root.style.setProperty(token, value)
  })
}

export const persistTheme = (mode: ThemeMode): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, mode)
}

export const initializeTheme = (): ThemeMode => {
  const theme = getInitialTheme()
  applyTheme(theme)
  return theme
}
