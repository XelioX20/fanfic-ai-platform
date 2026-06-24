import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        amoled: {
          bg: '#000000',
          surface: '#0a0a0a',
          border: '#1a1a1a',
        },
        dark: {
          bg: '#0f0f0f',
          surface: '#1a1a1a',
          border: '#2a2a2a',
        },
      },
      fontFamily: {
        reading: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
