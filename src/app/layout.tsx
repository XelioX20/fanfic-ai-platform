import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { allFontVariables } from '@/lib/fonts'

export const metadata: Metadata = {
  title: 'Fanfic AI Platform',
  description: 'AI-powered fanfic recommendation and reading platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`dark ${allFontVariables}`}>
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  )
}
