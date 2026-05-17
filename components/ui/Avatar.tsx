import * as React from 'react'
import { cn } from '@/lib/utils'

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
} as const

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: keyof typeof sizes
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', ...props }, ref) => {
    const initials = fallback
      ? fallback.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()
      : '?'

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-800 font-medium flex-shrink-0 overflow-hidden',
          sizes[size],
          className
        )}
        {...props}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? ''} className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number
}

export function AvatarGroup({ className, children, max = 4, ...props }: AvatarGroupProps) {
  const arr = React.Children.toArray(children)
  const visible = arr.slice(0, max)
  const remaining = arr.length - visible.length

  return (
    <div className={cn('flex items-center -space-x-2', className)} {...props}>
      {visible.map((child, i) => (
        <div key={i} className="ring-2 ring-surface rounded-full">
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div className="ring-2 ring-surface rounded-full w-8 h-8 bg-cream-200 text-ink-600 text-xs font-medium flex items-center justify-center">
          +{remaining}
        </div>
      )}
    </div>
  )
}
