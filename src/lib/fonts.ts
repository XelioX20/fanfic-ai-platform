import {
  Merriweather,
  Lora,
  PT_Serif,
  Roboto_Slab,
  Inter,
  Roboto,
  PT_Sans,
  Literata,
} from 'next/font/google'

// next/font requires each option to be a literal expression, not a variable.
// All fonts include 'cyrillic' subset — Russian text is fully supported.
export const merriweather = Merriweather({ subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-merriweather', display: 'swap' })
export const lora         = Lora({         subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-lora',         display: 'swap' })
export const ptSerif      = PT_Serif({     subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-pt-serif',     display: 'swap' })
export const robotoSlab   = Roboto_Slab({  subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-roboto-slab',  display: 'swap' })
export const literata     = Literata({     subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-literata',     display: 'swap' })

export const inter    = Inter({    subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-inter',    display: 'swap' })
export const roboto   = Roboto({   subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-roboto',   display: 'swap' })
export const ptSans   = PT_Sans({  subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-pt-sans',  display: 'swap' })

export const allFontVariables = [
  merriweather.variable, lora.variable, ptSerif.variable, robotoSlab.variable, literata.variable,
  inter.variable, roboto.variable, ptSans.variable,
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
