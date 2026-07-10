import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { allFontVariables } from '@/lib/fonts'

export const metadata: Metadata = {
  title: {
    default: 'Fanfic AI — читалка фанфиков',
    template: '%s · Fanfic AI',
  },
  description: 'Читай фанфики с ficbook.net с якорями и синхронизацией между устройствами',
  applicationName: 'Fanfic AI',
  authors: [{ name: 'Fanfic AI' }],
  keywords: ['фанфики', 'ficbook', 'reader', 'читалка', 'fanfic'],
  // Explicit Open Graph so shared links render nicely in Telegram/VK/etc.
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Fanfic AI',
    title: 'Fanfic AI — читалка фанфиков',
    description: 'Читай фанфики с ficbook.net с якорями и синхронизацией между устройствами',
  },
  // Tells iOS Safari to render the site full-screen when saved to home screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Fanfic AI',
  },
  // Prevents automatic phone-number detection on Safari mobile.
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Allow user zoom — accessibility requirement. Reader has its own font
  // size controls so most users won't need pinch-zoom but locking it out
  // is hostile.
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`fable ${allFontVariables}`}>
      <body className="pb-16 md:pb-0">
        <Providers>
          <Header />
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
