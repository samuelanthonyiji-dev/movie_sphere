/**
 * Single source of truth for branding. Rename the platform by editing this file
 * (and `public/manifest.webmanifest`, `index.html` title, and server BRAND_NAME env).
 */
export const BRAND = {
  name: 'MovieSphere',
  wordmark: ['MOVIE', 'SPHERE'] as const,
  tagline: 'Free, legal films. Beautifully delivered.',
  description:
    'Stream and download free, legal movies — public-domain classics and openly licensed films.',
  supportEmail: 'support@moviesphere.example',
  copyrightEmail: 'copyright@moviesphere.example',
  privacyEmail: 'privacy@moviesphere.example',
} as const
