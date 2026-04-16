import { createContext } from 'react'

import type { ThemeMode } from '@/constants/theme.constants'

export type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
