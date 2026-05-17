import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-soft',
        dark:
          'bg-ink-700 text-white hover:bg-ink-600 active:bg-ink-800 shadow-soft',
        secondary:
          'bg-surface text-ink-700 border border-ink-100 hover:bg-cream-100 hover:border-ink-200',
        ghost:
          'text-ink-600 hover:bg-cream-200/60 hover:text-ink-800',
        outline:
          'border border-ink-200 text-ink-700 hover:bg-cream-100 bg-transparent',
        destructive:
          'bg-error text-white hover:bg-error/90 active:bg-error/80 shadow-soft',
        link:
          'text-primary-700 underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm:  'h-9  px-4 text-sm rounded-pill',
        md:  'h-11 px-6 text-sm rounded-pill',
        lg:  'h-12 px-8 text-base rounded-pill',
        icon: 'h-10 w-10 rounded-pill',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
)
Button.displayName = 'Button'

export { buttonVariants }
