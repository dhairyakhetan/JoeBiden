// ──────────────────────────────────────────────────────────────────────────
// ErrorBoundary - single global wrap around <App />
// ──────────────────────────────────────────────────────────────────────────
// Catches synchronous errors thrown during render / commit phase of any
// component below it. Without this, an unexpected null-access or thrown
// error anywhere in the React tree crashes the entire app with a white
// screen and no way for the user to recover except a hard refresh.
//
// What this DOES catch:
//   - Errors thrown in render of any component below
//   - Errors thrown in lifecycle methods (componentDidMount, etc.)
//   - Errors thrown in useEffect setup (NOT cleanup - those need .catch)
//
// What this does NOT catch (per React's docs):
//   - Errors in async code (setTimeout, fetch.then, etc.) - those are
//     "global" rejections and bubble to window.onerror /
//     window.onunhandledrejection. installGlobalErrorTracking() in main.tsx
//     listens for those instead and logs them the same way.
//   - Errors in the ErrorBoundary itself
//   - Server-rendered errors (we don't SSR)
//
// React Router can show its own error overlay in dev - but in prod a
// raw crash without this boundary = white screen.
// ──────────────────────────────────────────────────────────────────────────

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logClientError } from '../lib/errorTracking'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console + client_error_logs (lib/errorTracking.ts). componentStack
    // is the React render tree at the crash site - invaluable for debugging.
    console.error('[ErrorBoundary] uncaught render error:', error, info.componentStack)
    logClientError('render', error, { componentStack: info.componentStack ?? undefined })
  }

  handleReload = () => {
    // Hard reload - resets module cache, route state, everything.
    // Cheaper than trying to recover with `this.setState({ hasError: false })`
    // because the underlying bad state probably persists otherwise.
    window.location.reload()
  }

  handleGoHome = () => {
    // Soft fallback - try the home route. If the error was on a
    // sub-route, going home often clears it.
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const message = this.state.error?.message ?? 'Something unexpected happened.'
    // Show stack only in dev; production users don't need (or want) to
    // see a stack trace.
    const isDev = import.meta.env?.DEV ?? false

    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(24px, 6vw, 64px)',
          background: 'var(--bg, #F4EFE0)',
          color: 'var(--ink, #0A0A0A)',
          fontFamily: 'var(--sans, system-ui)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <div
            style={{
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-3, #5A5A55)',
              marginBottom: 12,
            }}
          >
            ★ Unexpected error
          </div>
          <h1
            style={{
              fontFamily: 'var(--display, var(--sans, system-ui))',
              fontWeight: 800,
              fontSize: 'clamp(32px, 6vw, 56px)',
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
              margin: '0 0 16px',
              textWrap: 'balance',
            }}
          >
            something <span style={{ color: 'var(--pink, #FF4D8C)' }}>broke.</span>
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: 'var(--ink-2, #2A2A28)',
              marginBottom: 24,
              textWrap: 'pretty',
            }}
          >
            The page hit an unexpected error and stopped rendering. Try a
            refresh - if it keeps happening, send us a screenshot of what
            you were doing.
          </p>

          {isDev && (
            <pre
              style={{
                textAlign: 'left',
                background: 'rgba(224,92,92,0.08)',
                border: '1.5px solid rgba(224,92,92,0.3)',
                // 12 -> --r-tight. Dev-only, but DESIGN.md §1's scale has no
                // "only developers see it" exemption.
                borderRadius: 'var(--r-tight)',
                padding: 14,
                fontSize: 12,
                fontFamily: 'var(--mono, ui-monospace)',
                color: 'var(--danger)',
                overflow: 'auto',
                maxHeight: 240,
                marginBottom: 24,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message}
              {this.state.error?.stack && '\n\n' + this.state.error.stack}
            </pre>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReload}
              style={{
                minHeight: 48,
                padding: '12px 22px',
                borderRadius: 999,
                border: '1.5px solid var(--ink, #0A0A0A)',
                background: 'var(--ink, #0A0A0A)',
                color: 'var(--bg, #F4EFE0)',
                fontFamily: 'var(--display, var(--sans, system-ui))',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'background-color 150ms var(--ease-out), transform 120ms',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = '')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
            >
              reload page
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                minHeight: 48,
                padding: '12px 22px',
                borderRadius: 999,
                border: '1.5px solid var(--line, rgba(0,0,0,0.18))',
                background: 'transparent',
                color: 'var(--ink, #0A0A0A)',
                fontFamily: 'var(--display, var(--sans, system-ui))',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'border-color 150ms var(--ease-out), transform 120ms',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = '')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
            >
              go home
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
