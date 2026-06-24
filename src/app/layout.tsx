import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Fanfic AI Platform',
  description: 'AI-powered fanfic recommendation and reading platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
