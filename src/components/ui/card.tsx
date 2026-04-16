import { cva, type VariantProps } from 'class-variance-authority'
import { type HTMLAttributes, type PropsWithChildren } from 'react'

import { cn } from '@/lib/cn'

const cardVariants = cva('rounded-2xl border p-5 shadow-[var(--shadow-soft)] sm:p-6', {
  variants: {
    tone: {
      default: 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]',
      muted: 'border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]',
      elevated:
        'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-medium)]',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
})

type CardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>

export const Card = ({ children, className, tone, ...rest }: CardProps) => {
  return (
    <section className={cn(cardVariants({ tone }), className)} {...rest}>
      {children}
    </section>
  )
}
