'use client'
import Image from 'next/image'
import { User } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: number
  className?: string
  fallbackIconSize?: number
  /** Extra class on the fallback disc — controls the gradient/color when
   *  the image is missing or fails to load. */
  fallbackClassName?: string
}

/**
 * Avatar with graceful degradation.
 *
 * Common failure modes we ran into repeatedly:
 * - R2 URL points to an object that no longer exists (404)
 * - CDN misbehaves and returns 0-byte body (naturalWidth=0)
 * - Cache-persisted store has a URL from a previous bucket / user
 *
 * Instead of showing a broken image icon, we onError-switch to a
 * User-icon placeholder disc. This is the single place all avatar
 * renders in the app should go through.
 */
export function Avatar({
  src,
  alt = '',
  size = 40,
  className,
  fallbackIconSize,
  fallbackClassName = 'bg-gradient-to-br from-purple-700 to-purple-900',
}: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const iconSize = fallbackIconSize ?? Math.round(size * 0.5)

  if (!src || broken) {
    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center shrink-0',
          fallbackClassName,
          className,
        )}
        style={{ width: size, height: size }}
      >
        <User size={iconSize} className="text-white" />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full object-cover shrink-0', className)}
      // Avatar URLs come from R2 (which serves a custom domain we don't
      // ship through the Vercel optimizer) and ficbook. Both are already
      // right-sized; skip the /_next/image transform to avoid a 404 hop.
      unoptimized
      onError={() => setBroken(true)}
    />
  )
}
