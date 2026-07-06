import { useState, useEffect, useRef, useCallback } from 'react'

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay = 300
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const fnRef = useRef(fn)
  fnRef.current = fn

  return useCallback(
    ((...args: any[]) => {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => fnRef.current(...args), delay)
    }) as T,
    [delay]
  )
}
