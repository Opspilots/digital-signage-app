import { createContext, useCallback, useContext, useState } from 'react'

export type ToastKind = 'success' | 'warn' | 'info' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toasts: Toast[]
  show: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  warn:    (message: string) => void
  info:    (message: string) => void
  error:   (message: string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 5000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  const value: ToastContextValue = {
    toasts,
    show,
    success: (m) => show(m, 'success'),
    warn:    (m) => show(m, 'warn'),
    info:    (m) => show(m, 'info'),
    error:   (m) => show(m, 'error'),
    dismiss,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

function ToastStack() {
  const { toasts, dismiss } = useToast()
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
      {toasts.map((t) => {
        const styles = t.kind === 'success'
          ? { background: 'var(--green-muted)', border: '1px solid rgba(52,211,153,0.3)', color: 'var(--green)' }
          : t.kind === 'warn'
          ? { background: 'var(--amber-muted)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--amber)' }
          : t.kind === 'error'
          ? { background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--red)' }
          : { background: 'var(--cyan-muted)', border: '1px solid var(--cyan-dim)', color: 'var(--cyan)' }

        const icon = t.kind === 'success' ? '✓' : t.kind === 'warn' ? '⚠' : t.kind === 'error' ? '✕' : '·'

        return (
          <div key={t.id} className="animate-slide-up rounded-lg pl-4 pr-2 py-2.5 text-sm shadow-lg pointer-events-auto flex items-center gap-2"
            style={styles}
          >
            <span className="flex-shrink-0">{icon}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Cerrar"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
