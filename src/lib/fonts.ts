import {
  Merriweather,
  Lora,
  PT_Serif,
  Roboto_Slab,
  Inter,
  Roboto,
  PT_Sans,
  Literata,
  Playfair_Display,
} from 'next/font/google'

// next/font requires each option to be a literal expression, not a variable.
// All fonts include 'cyrillic' subset — Russian text is fully supported.
//
// Preload policy: only preload the default UI font (PT Sans). Every other
// family is a reader-only choice — most users never see them, and preloading
// all 8 previously downloaded ~0.6-1MB of WOFF2 files on every visit even
// though only one is rendered at a time. `preload: false` still lets
// next/font serve the CSS variable and swap in the font when the reader
// picks it — just without the render-blocking <link rel="preload"> header.
export const ptSans       = PT_Sans({      subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-pt-sans',     display: 'swap' })

export const merriweather = Merriweather({ subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-merriweather', display: 'swap', preload: false })
export const lora         = Lora({         subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-lora',         display: 'swap', preload: false })
export const ptSerif      = PT_Serif({     subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-pt-serif',     display: 'swap', preload: false })
export const robotoSlab   = Roboto_Slab({  subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-roboto-slab',  display: 'swap', preload: false })
export const literata     = Literata({     subsets: ['cyrillic', 'latin'], weight: ['400', '500', '700'], variable: '--font-literata',     display: 'swap', preload: false })
export const inter        = Inter({        subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-inter',        display: 'swap', preload: false })
export const roboto       = Roboto({       subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-roboto',       display: 'swap', preload: false })

// Fable theme display font — high-contrast literary serif, free Heldane
// stand-in. Cyrillic subset so Russian headlines render. Weights 400/500
// (Fable uses 400 for headlines, 500 for subtitles).
export const playfair     = Playfair_Display({ subsets: ['cyrillic', 'latin'], weight: ['400', '500', '600'], variable: '--font-playfair', display: 'swap', preload: false })

export const allFontVariables = [
  ptSans.variable, merriweather.variable, lora.variable, ptSerif.variable, robotoSlab.variable, literata.variable,
  inter.variable, roboto.variable, playfair.variable,
].join(' ')

export type FontFamily =
  | 'system-serif' | 'system-sans'
  | 'merriweather' | 'lora' | 'pt-serif' | 'roboto-slab' | 'literata'
  | 'inter' | 'roboto' | 'pt-sans'

export const FONT_OPTIONS: { value: FontFamily; label: string; category: 'serif' | 'sans'; hint: string; cssVar: string }[] = [
  // Serif — для художественного чтения, все с кириллицей
  { value: 'pt-serif',      label: 'PT Serif',       category: 'serif', hint: 'рекомендован для русского',   cssVar: 'var(--font-pt-serif), serif' },
  { value: 'lora',          label: 'Lora',           category: 'serif', hint: 'чистый, для длинных текстов', cssVar: 'var(--font-lora), serif' },
  { value: 'literata',      label: 'Literata',       category: 'serif', hint: 'экранная читалка',            cssVar: 'var(--font-literata), serif' },
  { value: 'merriweather',  label: 'Merriweather',   category: 'serif', hint: 'плотный, газетный стиль',     cssVar: 'var(--font-merriweather), serif' },
  { value: 'roboto-slab',   label: 'Roboto Slab',    category: 'serif', hint: 'современная антиква',         cssVar: 'var(--font-roboto-slab), serif' },
  { value: 'system-serif',  label: 'Системный Serif',category: 'serif', hint: 'Georgia / Times',             cssVar: 'Georgia, Cambria, "Times New Roman", serif' },
  // Sans — для контрастного чтения
  { value: 'pt-sans',       label: 'PT Sans',        category: 'sans',  hint: 'рекомендован для русского',   cssVar: 'var(--font-pt-sans), sans-serif' },
  { value: 'roboto',        label: 'Roboto',         category: 'sans',  hint: 'современный, нейтральный',    cssVar: 'var(--font-roboto), sans-serif' },
  { value: 'inter',         label: 'Inter',          category: 'sans',  hint: 'экранный, высокая чёткость',  cssVar: 'var(--font-inter), sans-serif' },
  { value: 'system-sans',   label: 'Системный Sans', category: 'sans',  hint: 'нативный шрифт устройства',   cssVar: 'system-ui, -apple-system, sans-serif' },
]

export function getFontCssVar(family: FontFamily): string {
  return FONT_OPTIONS.find(f => f.value === family)?.cssVar ?? 'Georgia, serif'
}
