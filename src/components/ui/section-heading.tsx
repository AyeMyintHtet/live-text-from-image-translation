import type { PropsWithChildren } from 'react'

import { cn } from '@/lib/cn'

type SectionHeadingProps = PropsWithChildren<{
  description?: string
  className?: string
}>

export const SectionHeading = ({
  children,
  description,
  className,
}: SectionHeadingProps) => {
  return (
    <header className={cn('space-y-1', className)}>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{children}</h2>
      {description ? (
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{description}</p>
      ) : null}
    </header>
  )
}
