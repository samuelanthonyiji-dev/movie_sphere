/**
 * Single source of truth for branding. Rename the platform by editing this file
 * (and `public/manifest.webmanifest`, `index.html` title, and server BRAND_NAME env).
 */
export const BRAND = {
  name: 'CineVault',
  wordmark: ['CINE', 'VAULT'] as const,
  tagline: 'Authorized films. Beautifully delivered.',
  description:
    'Discover, stream and download public-domain classics, licensed films and creator-authorized originals.',
  supportEmail: 'support@cinevault.example',
  copyrightEmail: 'copyright@cinevault.example',
  privacyEmail: 'privacy@cinevault.example',
} as const
