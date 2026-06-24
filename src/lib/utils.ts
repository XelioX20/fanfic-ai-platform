import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWordCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}М`
  if (count >= 1000) return `${(count / 1000).toFixed(0)}К`
  return count.toString()
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}М`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}К`
  return n.toString()
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
