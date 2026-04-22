import { Component } from "react";

/**
 * Global ErrorBoundary
 *
 * Catches any synchronous render / lifecycle error from its descendants
 * and shows a visible fallback instead of leaving a blank page.
 *
 * This is critical for the PWA: a silent JS crash (e.g. a bad chunk load,
 * a third-party library failing on an old WebView, a null dereference)
 * used to produce a completely white screen with no hint for the user.
 * With this boundary in place we show a friendly message and a reload
 * button, and log the error to the console so it shows up in remote
 * devtools / `chrome://inspect`.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught render error:", error, info);
  }

  handleReload = () => {
    // Best-effort: unregister the service worker so a broken / contaminated
    // cache doesn't keep the app stuck in the same crash after reload.
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
          if (window.caches && window.caches.keys) {
            window.caches.keys().then((keys) =>
              Promise.all(keys.map((k) => window.caches.delete(k)))
            ).finally(() => window.location.reload());
            return;
          }
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    } catch (e) {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      (this.state.error && (this.state.error.message || String(this.state.error))) ||
      "Error desconocido";

    return (
      <div
        data-testid="global-error-boundary"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f8fafc",
          fontFamily: "Manrope, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "28px 24px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fee2e2",
              color: "#b91c1c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 28,
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            !
          </div>
          <h2 style={{ color: "#0f172a", margin: "0 0 8px", fontSize: 20 }}>
            Ocurrió un error al cargar
          </h2>
          <p style={{ color: "#475569", margin: "0 0 16px", fontSize: 14, lineHeight: 1.5 }}>
            La aplicación se detuvo inesperadamente. Esto puede ocurrir después
            de una actualización con conexión inestable. Recarga para volver a
            intentarlo.
          </p>
          <details
            style={{
              textAlign: "left",
              background: "#f1f5f9",
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 16,
              fontSize: 12,
              color: "#334155",
              wordBreak: "break-word",
            }}
          >
            <summary style={{ cursor: "pointer", color: "#64748b" }}>Detalle técnico</summary>
            <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{message}</pre>
          </details>
          <button
            onClick={this.handleReload}
            data-testid="error-boundary-reload-btn"
            style={{
              width: "100%",
              padding: "12px 18px",
              background: "#0B2C5F",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recargar aplicación
          </button>
        </div>
      </div>
    );
  }
}
