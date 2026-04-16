import { AppShell } from '@/components/layout/app-shell'
import { TranslatorWorkspace } from '@/features/translator/components/translator-workspace'
import { ThemeProvider } from '@/theme/theme-provider'

function App() {
  return (
    <ThemeProvider>
      <AppShell>
        <TranslatorWorkspace />
      </AppShell>
    </ThemeProvider>
  )
}

export default App
