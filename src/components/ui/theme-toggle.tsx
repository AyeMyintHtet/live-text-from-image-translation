import { MoonStar, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/theme/use-theme'

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <MoonStar size={16} /> : <Sun size={16} />}
      <span>{theme === 'light' ? 'Dark' : 'Light'} Mode</span>
    </Button>
  )
}
