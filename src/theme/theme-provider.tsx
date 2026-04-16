import {
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import type { ThemeMode } from '@/constants/theme.constants'
import { ThemeContext } from '@/theme/theme-context'
import { applyTheme, getInitialTheme, persistTheme } from '@/theme/theme-manager'

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())

  useEffect(() => {
    applyTheme(theme)
    persistTheme(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
