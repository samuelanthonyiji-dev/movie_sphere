import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AuthProvider } from './state/auth'
import { DownloadsProvider } from './state/downloads'
import { LibraryProvider } from './state/library'
import { PwaProvider } from './state/pwa'
import { UIProvider } from './state/ui'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: (n, e) => (e as { status?: number }).status !== 404 && (e as { status?: number }).status !== 401 && n < 2,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst', // let the service worker answer from cache while offline
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UIProvider>
          <AuthProvider>
            <LibraryProvider>
              <DownloadsProvider>
                <PwaProvider>
                  <App />
                </PwaProvider>
              </DownloadsProvider>
            </LibraryProvider>
          </AuthProvider>
        </UIProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
