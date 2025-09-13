import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; message?: string; stack?: string }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, message: error?.message || String(error), stack: error?.stack }
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('UI ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
          <h2>Ошибка в приложении</h2>
          {this.state.message && <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>}
          {this.state.stack && (
            <details>
              <summary>Stack</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.stack}</pre>
            </details>
          )}
          <p>Откройте Console в DevTools и пришлите ошибку — быстро починим.</p>
        </div>
      )
    }
    return this.props.children
  }
}
