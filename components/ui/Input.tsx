import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', leftIcon, rightIcon, ...props }, ref) => {
    if (leftIcon || rightIcon) {
      return (
        <div className={cn(
          'flex items-center gap-2.5 h-12 px-5 rounded-pill bg-white border border-ink-100',
          'shadow-[0_1px_2px_rgba(20,20,30,0.04)]',
          'focus-within:border-primary-400 focus-within:shadow-[0_0_0_4px_rgba(111,207,151,0.12)]',
          'transition-all duration-150',
          className
        )}>
          {leftIcon && <span className="text-ink-400 flex-shrink-0">{leftIcon}</span>}
          <input
            ref={ref}
            type={type}
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink-700 placeholder:text-ink-300"
            {...props}
          />
          {rightIcon && <span className="text-ink-400 flex-shrink-0">{rightIcon}</span>}
        </div>
      )
    }
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'w-full h-12 px-5 rounded-pill bg-white border border-ink-100',
          'shadow-[0_1px_2px_rgba(20,20,30,0.04)]',
          'text-sm text-ink-700 placeholder:text-ink-300',
          'focus:border-primary-400 focus:shadow-[0_0_0_4px_rgba(111,207,151,0.12)] focus:outline-none',
          'transition-all duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-xs font-medium text-ink-500 mb-1.5 ml-1', className)}
      {...props}
    />
  )
)
Label.displayName = 'Label'
