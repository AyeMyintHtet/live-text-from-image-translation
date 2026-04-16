import { cva, type VariantProps } from 'class-variance-authority'
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type PropsWithChildren,
} from 'react'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)] disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] hover:bg-[var(--color-button-primary-hover)] active:bg-[var(--color-button-primary-active)]',
        secondary:
          'border-[var(--color-border-default)] bg-[var(--color-button-secondary-bg)] text-[var(--color-button-secondary-text)] hover:bg-[var(--color-button-secondary-hover)] active:bg-[var(--color-button-secondary-active)]',
        ghost:
          'border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-button-ghost-hover)]',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-10 px-4',
        lg: 'h-11 px-5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>
>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, size, variant, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ size, variant }), className)}
        type="button"
        {...rest}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
