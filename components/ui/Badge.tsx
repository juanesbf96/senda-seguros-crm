import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-primary-100 text-primary-800',
        success: 'bg-primary-100 text-primary-800',
        warning: 'bg-warning-soft text-ink-700',
        error:   'bg-error-soft text-ink-700',
        neutral: 'bg-cream-200 text-ink-600',
        dark:    'bg-ink-700 text-white',
        outline: 'border border-ink-200 text-ink-600 bg-transparent',
      },
      size: {
        sm: 'px-2.5 py-0.5 text-xs',
        md: 'px-3   py-1   text-xs',
        lg: 'px-3.5 py-1.5 text-sm',
      },
      dot: {
        true:  '',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
      dot: false,
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dotColor?: string
}

export function Badge({ className, variant, size, dot, dotColor, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, dot, className }))} {...props}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: dotColor ?? 'currentColor' }}
        />
      )}
      {children}
    </span>
  )
}
