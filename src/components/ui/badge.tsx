import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'direction' | 'rating' | 'status' | 'hot'
  className?: string
}

const variants = {
  default: 'bg-zinc-800 text-zinc-300',
  direction: 'bg-purple-900/50 text-purple-300 border border-purple-700/30',
  rating: 'bg-orange-900/50 text-orange-300 border border-orange-700/30',
  status: 'bg-blue-900/50 text-blue-300 border border-blue-700/30',
  hot: 'bg-red-900/50 text-red-300 border border-red-700/30',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
