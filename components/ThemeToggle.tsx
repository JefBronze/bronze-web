'use client'

// The only client component on the page. The label is chosen in CSS from the effective theme,
// so server and client render the same markup.
export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const current = root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    const next = current === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* private mode: the choice just won't persist */
    }
  }
  return (
    <button type="button" className="tog" onClick={toggle}>
      <span className="to-dark">Escuro</span>
      <span className="to-light">Claro</span>
    </button>
  )
}
