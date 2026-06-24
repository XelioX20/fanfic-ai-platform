import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full px-4 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500',
        'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
