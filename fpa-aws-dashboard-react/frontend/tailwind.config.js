/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: { DEFAULT: 'rgb(var(--card) / <alpha-value>)', foreground: 'rgb(var(--card-foreground) / <alpha-value>)' },
        primary: { DEFAULT: 'rgb(var(--primary) / <alpha-value>)', foreground: 'rgb(var(--primary-foreground) / <alpha-value>)' },
        accent: { DEFAULT: 'rgb(var(--accent) / <alpha-value>)', foreground: 'rgb(var(--accent-foreground) / <alpha-value>)' },
        muted: { DEFAULT: 'rgb(var(--muted) / <alpha-value>)', foreground: 'rgb(var(--muted-foreground) / <alpha-value>)' },
        border: 'rgb(var(--border) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
