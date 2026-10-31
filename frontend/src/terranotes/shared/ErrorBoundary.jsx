import React from 'react';
import { withBase } from '../lib/base.js';
import { FONT } from '../styles/fonts.js';

// Wraps the routes (App.jsx). If a page crashes (say, a typo in a data file), shows a "The line broke." card with
// Try again / Home instead of a blank screen, and logs the error. resetKey = the address: another page clears it.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Aquaterra: this page crashed.', error, info.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const btn = { minHeight: "44px", padding: "0 18px", display: "inline-flex", alignItems: "center", border: "2px solid var(--ink)", fontFamily: FONT.mono, fontWeight: "700", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", textDecoration: "none", cursor: "pointer" };
    return (
      <div role="alert" style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "var(--page)", color: "var(--ink)" }}>
        <div className="card-drop" style={{ width: "340px", boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: "8px 8px 0 var(--red)", padding: "22px", transform: "rotate(-1.5deg)" }}>
          <div style={{ fontFamily: FONT.mono, fontSize: "10px", letterSpacing: "1.4px" }}>SOMETHING SNAPPED</div>
          <h1 style={{ margin: "10px 0 8px", fontFamily: FONT.head, fontWeight: "400", fontSize: "30px", lineHeight: "0.95", textTransform: "uppercase" }}>The line broke.</h1>
          <p style={{ margin: "0 0 18px", fontFamily: FONT.hand, fontSize: "21px", lineHeight: "1.15", color: "var(--hand)" }}>this page tripped over itself. try again, or head home while we tie it back together.</p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => location.reload()} style={{ ...btn, background: "var(--ink)", color: "var(--card)" }}>Try again</button>
            <a href={withBase('/')} style={{ ...btn, background: "var(--card)", color: "var(--ink)" }}>Home</a>
          </div>
        </div>
      </div>
    );
  }
}
