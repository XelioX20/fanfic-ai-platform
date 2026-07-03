import {
  Merriweather,
  Lora,
  PT_Serif,
  Roboto_Slab,
  Source_Serif_4,
  Inter,
  Roboto,
  Open_Sans,
  Nunito,
  PT_Sans,
  Literata,
  EB_Garamond,
} from 'next/font/google'

// next/font requires each option to be a literal expression, not a variable.
export const merriweather = Merriweather({ subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-merriweather', display: 'swap' })
export const lora         = Lora({         subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-lora',         display: 'swap' })
export const ptSerif      = PT_Serif({     subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-pt-serif',     display: 'swap' })
export const robotoSlab   = Roboto_Slab({  subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-roboto-slab',  display: 'swap' })
export const sourceSerif  = Source_Serif_4({subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-source-serif', display: 'swap' })
export const literata     = Literata({     subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-literata',     display: 'swap' })
export const garamond     = EB_Garamond({  subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-garamond',     display: 'swap' })

export const inter    = Inter({    subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-inter',    display: 'swap' })
export const roboto   = Roboto({   subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-roboto',   display: 'swap' })
export const openSans = Open_Sans({subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-open-sans',display: 'swap' })
export const nunito   = Nunito({   subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-nunito',   display: 'swap' })
export const ptSans   = PT_Sans({  subsets: ['cyrillic', 'latin'], weight: ['400', '700'], variable: '--font-pt-sans',  display: 'swap' })

export const allFontVariables = [
  merriweather.variable, lora.variable, ptSerif.variable, robotoSlab.variable, sourceSerif.variable, literata.variable, garamond.variable,
  inter.variable, roboto.variable, openSans.variable, nunito.variable, ptSans.variable,
].join(' ')

export type FontFamily =
  | 'system-serif' | 'system-sans'
  | 'merriweather' | 'lora' | 'pt-serif' | 'roboto-slab' | 'source-serif' | 'literata' | 'garamond'
  | 'inter' | 'roboto' | 'open-sans' | 'nunito' | 'pt-sans'

export const FONT_OPTIONS: { value: FontFamily; label: string; category: 'serif' | 'sans'; cssVar: string }[] = [
  // Serif (classic reading)
  { value: 'system-serif',  label: 'System Serif',   category: 'serif', cssVar: 'Georgia, Cambria, "Times New Roman", serif' },
  { value: 'merriweather',  label: 'Merriweather',   category: 'serif', cssVar: 'var(--font-merriweather), serif' },
  { value: 'lora',          label: 'Lora',           category: 'serif', cssVar: 'var(--font-lora), serif' },
  { value: 'pt-serif',      label: 'PT Serif',       category: 'serif', cssVar: 'var(--font-pt-serif), serif' },
  { value: 'literata',      label: 'Literata',       category: 'serif', cssVar: 'var(--font-literata), serif' },
  { value: 'source-serif',  label: 'Source Serif',   category: 'serif', cssVar: 'var(--font-source-serif), serif' },
  { value: 'roboto-slab',   label: 'Roboto Slab',    category: 'serif', cssVar: 'var(--font-roboto-slab), serif' },
  { value: 'garamond',      label: 'EB Garamond',    category: 'serif', cssVar: 'var(--font-garamond), serif' },
  // Sans (modern)
  { value: 'system-sans',   label: 'System Sans',    category: 'sans',  cssVar: 'system-ui, -apple-system, sans-serif' },
  { value: 'inter',         label: 'Inter',          category: 'sans',  cssVar: 'var(--font-inter), sans-serif' },
  { value: 'roboto',        label: 'Roboto',         category: 'sans',  cssVar: 'var(--font-roboto), sans-serif' },
  { value: 'open-sans',     label: 'Open Sans',      category: 'sans',  cssVar: 'var(--font-open-sans), sans-serif' },
  { value: 'pt-sans',       label: 'PT Sans',        category: 'sans',  cssVar: 'var(--font-pt-sans), sans-serif' },
  { value: 'nunito',        label: 'Nunito',         category: 'sans',  cssVar: 'var(--font-nunito), sans-serif' },
]

export function getFontCssVar(family: FontFamily): string {
  return FONT_OPTIONS.find(f => f.value === family)?.cssVar ?? 'Georgia, serif'
}
