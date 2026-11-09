import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('[MovieSphere] UI error', error)
  }
  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback
    const chunk = /dynamically imported module|Loading chunk|Failed to fetch/i.test(this.state.error.message)
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <h1 className="text-2xl font-bold">{chunk ? 'This page isn’t available offline' : 'Something went wrong'}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{chunk ? 'Reconnect to load this part of the app.' : 'An unexpected error occurred while showing this page.'}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-primary" onClick={() => location.reload()}>Reload</button>
          <a className="btn-dark" href="/">Go home</a>
        </div>
      </div>
    )
  }
}
