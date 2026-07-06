import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

const ThemeValueContext = createContext<Theme>('light')
const ThemeToggleContext = createContext<() => void>(() => {})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = useCallback(() => setTheme(t => (t === 'light' ? 'dark' : 'light')), [])

  return (
    <ThemeValueContext.Provider value={theme}>
      <ThemeToggleContext.Provider value={toggle}>
        {children}
      </ThemeToggleContext.Provider>
    </ThemeValueContext.Provider>
  )
}

export const useThemeValue = () => useContext(ThemeValueContext)
export const useThemeToggle = () => useContext(ThemeToggleContext)
export const useTheme = () => {
  const theme = useContext(ThemeValueContext)
  const toggle = useContext(ThemeToggleContext)
  return { theme, toggle }
}
