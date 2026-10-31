// @ts-nocheck
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ──────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export type Toast = {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number // ms, default 4000. 0 = persist until dismissed
}

type ToastContextValue = {
  toast: (opts: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

// ── Context ────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>): string => {
    const id = `toast-${++counterRef.current}`
    const duration = opts.duration ?? 4000
    setToasts(prev => [...prev, { ...opts, id }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const success = useCallback((title: string, message?: string) =>
    toast({ type: 'success', title, message }) && '', [toast])
  const error = useCallback((title: string, message?: string) =>
    toast({ type: 'error', title, message, duration: 6000 }) && '', [toast])
  const warning = useCallback((title: string, message?: string) =>
    toast({ type: 'warning', title, message }) && '', [toast])
  const info = useCallback((title: string, message?: string) =>
    toast({ type: 'info', title, message }) && '', [toast])

  return (
    <ToastContext.Provider value={{ toast, dismiss, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ── Per-toast icon + color mapping ─────────────────────────────────────────
const TOAST_CONFIG: Record<ToastType, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  success: {
    bg: '#181818', border: 'var(--c2)',
    label: 'success',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" fill="var(--c2)" stroke="var(--c2)" strokeWidth="1.5"/>
        <path d="M5.5 9.5l2.5 2.5 4.5-5" stroke="#181818" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  error: {
    bg: '#181818', border: 'var(--c1)',
    label: 'error',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" fill="var(--c1)" stroke="var(--c1)" strokeWidth="1.5"/>
        <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  warning: {
    bg: '#181818', border: 'var(--c3)',
    label: 'warning',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2L16.5 15H1.5z" fill="var(--c3)" stroke="var(--c3)" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M9 7.5v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="9" cy="13" r="1" fill="white"/>
      </svg>
    ),
  },
  info: {
    bg: '#181818', border: 'var(--c3)',
    label: 'info',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" fill="var(--c3)" stroke="var(--c3)" strokeWidth="1.5"/>
        <circle cx="9" cy="6" r="1" fill="white"/>
        <path d="M9 8.5v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
}

// ── Individual toast ────────────────────────────────────────────────────────
function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const cfg = TOAST_CONFIG[t.type]
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [progress, setProgress] = useState(100)
  const duration = t.duration ?? 4000

  // Progress bar
  useEffect(() => {
    if (duration === 0) return
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100))
    }
    const interval = setInterval(tick, 50)
    return () => clearInterval(interval)
  }, [duration])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
      className="relative overflow-hidden rounded-2xl border-[1.5px] flex gap-3 p-4 max-w-[380px] w-full"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
        boxShadow: `4px 4px 0 ${cfg.border}`,
        color: '#FBF5E6',
      }}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">{cfg.icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] tracking-[0.12em] uppercase opacity-55 mb-0.5">{cfg.label}</div>
        <div className="font-body font-semibold text-[14px] leading-snug" style={{ color: '#FBF5E6' }}>
          {t.title}
        </div>
        {t.message && (
          <div className="font-body text-[13px] leading-relaxed mt-0.5 opacity-70">
            {t.message}
          </div>
        )}
      </div>

      {/* Dismiss — 40×40 hit area via padding (the visible glyph stays
          small so the toast remains compact; the tap target extends
          out via negative margin to keep layout flush). */}
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
        style={{ color: '#FBF5E6', minWidth: 40, minHeight: 40, padding: 8, margin: -8 }}
        aria-label="Dismiss"
        title="Dismiss"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 h-[2px] transition-none"
          style={{ width: `${progress}%`, background: cfg.border }} />
      )}
    </motion.div>
  )
}

// ── Container ───────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed z-[9999] flex flex-col gap-2.5 pointer-events-none"
      style={{
        bottom: '20px',
        right: '16px',
        left: 'auto',
        zIndex: 99999,
        maxWidth: 'min(380px, calc(100vw - 32px))',
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={() => onDismiss(t.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
