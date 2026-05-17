import { cn } from '@/lib/utils'

export interface StripePatternProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'light' | 'dark'
}

export function StripePattern({ className, variant = 'light', children, ...props }: StripePatternProps) {
  return (
    <div
      className={cn(
        variant === 'light' ? 'stripe-pattern' : 'stripe-pattern-dark',
        'rounded-pill',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
