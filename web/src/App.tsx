import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Footer } from './components/Footer'
import { InstallPWA } from './components/InstallPWA'
import { BrandLoader } from './components/Logo'
import { MobileNavigation } from './components/MobileNavigation'
import { Navbar } from './components/Navbar'
import { OfflineIndicator } from './components/OfflineIndicator'
import { useNewTitleNotifier } from './state/newTitles'
import { useAuth } from './state/auth'
import Home from './pages/Home'

const Browse = lazy(() => import('./pages/Browse'))
const Categories = lazy(() => import('./pages/Categories'))
const Collections = lazy(() => import('./pages/Collections'))
const CollectionPage = lazy(() => import('./pages/CollectionPage'))
const MovieDetails = lazy(() => import('./pages/MovieDetails'))
const Watch = lazy(() => import('./pages/Watch'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const MyList = lazy(() => import('./pages/MyList'))
const Downloads = lazy(() => import('./pages/Downloads'))
const Profile = lazy(() => import('./pages/Profile'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const Legal = lazy(() => import('./pages/legal/Legal'))
const ContactPage = lazy(() => import('./pages/legal/ContactPage'))
const Admin = lazy(() => import('./pages/admin/Admin'))
const NotFound = lazy(() => import('./pages/NotFound'))

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0 })
  }, [pathname, hash])
  return null
}

function Shell() {
  const { pathname } = useLocation()
  return (
    <>
      <Navbar />
      <OfflineIndicator />
      <main id="main" tabIndex={-1} className="min-h-[70vh] outline-none">
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<BrandLoader className="min-h-[70vh]" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <MobileNavigation />
      <InstallPWA />
    </>
  )
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <BrandLoader className="min-h-[70vh]" />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (user.role !== 'ADMIN') return <NotFound />
  return <>{children}</>
}

export default function App() {
  useNewTitleNotifier()
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          path="/watch/:slug"
          element={
            <ErrorBoundary>
              <Suspense fallback={<BrandLoader className="min-h-dvh" />}>
                <Watch />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="movies" element={<Browse mode="movies" />} />
          <Route path="movies/:facet" element={<Browse mode="movies" />} />
          <Route path="series" element={<Browse mode="series" />} />
          <Route path="latest" element={<Browse mode="latest" />} />
          <Route path="trending" element={<Browse mode="trending" />} />
          <Route path="categories" element={<Categories />} />
          <Route path="collections" element={<Collections />} />
          <Route path="collections/:slug" element={<CollectionPage />} />
          <Route path="movie/:slug" element={<MovieDetails />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="my-list" element={<MyList />} />
          <Route path="downloads" element={<Downloads />} />
          <Route path="profile" element={<Profile />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="copyright" element={<Legal page="copyright" />} />
          <Route path="privacy" element={<Legal page="privacy" />} />
          <Route path="terms" element={<Legal page="terms" />} />
          <Route path="contact" element={<ContactPage mode="contact" />} />
          <Route path="report" element={<ContactPage mode="report" />} />
          <Route path="admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
