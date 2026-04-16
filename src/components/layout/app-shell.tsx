import type { CSSProperties, PropsWithChildren } from 'react'

import { ThemeToggle } from '@/components/ui/theme-toggle'
import { APP_COPY } from '@/constants/app.constants'
import { THEME_STATIC_TOKENS } from '@/constants/theme.constants'

export const AppShell = ({ children }: PropsWithChildren) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-120px] h-72 w-72 rounded-full bg-[var(--color-bg-overlay)] blur-3xl" />
        <div className="absolute right-[-110px] top-24 h-80 w-80 rounded-full bg-[var(--color-bg-overlay)] blur-3xl" />
      </div>

      <div
        className="relative mx-auto w-full px-4 py-6 sm:px-6 lg:px-8"
        style={{ maxWidth: THEME_STATIC_TOKENS.layoutMaxWidth } as CSSProperties}
      >
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-canvas)] p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">
              {APP_COPY.productName}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
              {APP_COPY.heroTitle}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
              {APP_COPY.heroDescription}
            </p>
          </div>
          <ThemeToggle />
        </header>

        <main>{children}</main>
      </div>
    </div>
  )
}
