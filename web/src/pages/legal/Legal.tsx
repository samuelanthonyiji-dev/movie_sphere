import { Link } from 'react-router-dom'
import { BRAND } from '@/config/brand'
import { useDocumentTitle } from '@/lib/hooks'

const UPDATED = 'November 2026'

/**
 * Template policies. These are a starting point written for this codebase’s actual behaviour and
 * must be reviewed by a qualified lawyer for your jurisdiction before launch.
 */
export default function Legal({ page }: { page: 'copyright' | 'privacy' | 'terms' }) {
  const title = { copyright: 'Copyright & Takedown Policy', privacy: 'Privacy Policy', terms: 'Terms of Service' }[page]
  useDocumentTitle(title)
  return (
    <div className="container-page max-w-3xl pt-24 lg:pt-28">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-xs text-subtle">Last updated {UPDATED}. Template text — have it reviewed by counsel before production use.</p>
      <div className="prose-legal mt-8">
        {page === 'copyright' && <Copyright />}
        {page === 'privacy' && <Privacy />}
        {page === 'terms' && <Terms />}
      </div>
    </div>
  )
}

function Copyright() {
  return (
    <>
      <p>{BRAND.name} only distributes films that are in the public domain, licensed to us, uploaded by their rights holders, or that we otherwise have permission to distribute. Every downloadable file carries an internal authorization record, and files without an approved record are never served.</p>
      <h2>Public-domain status</h2>
      <p>Public-domain status differs between countries. Titles labelled “Public domain (US)” are believed to be in the public domain in the United States. If you are outside the US, check your local law before downloading.</p>
      <h2>Reporting infringement (takedown requests)</h2>
      <p>If you believe material on {BRAND.name} infringes your copyright, send a notice to our designated agent at <a href={`mailto:${BRAND.copyrightEmail}`}>{BRAND.copyrightEmail}</a> or use the <Link to="/report">content report form</Link>. Please include:</p>
      <ul>
        <li>Your name, address, telephone number and email address.</li>
        <li>Identification of the copyrighted work you claim is infringed.</li>
        <li>The URL of the title page on {BRAND.name} (e.g. /movie/example-title).</li>
        <li>A statement that you have a good-faith belief the use is not authorized by the owner, its agent or the law.</li>
        <li>A statement, under penalty of perjury, that the information is accurate and that you are the owner or authorized to act for the owner.</li>
        <li>Your physical or electronic signature.</li>
      </ul>
      <p>We review notices promptly, disable access to the files concerned while we investigate, and notify the uploader where applicable. Repeat infringers’ accounts are terminated.</p>
      <h2>Counter-notices</h2>
      <p>If your content was removed by mistake, you may send a counter-notice to the same address with the information required by applicable law.</p>
    </>
  )
}

function Privacy() {
  return (
    <>
      <p>This policy explains what {BRAND.name} stores and why. We collect the minimum needed to run the service.</p>
      <h2>Guests</h2>
      <ul>
        <li>Your list, favourites, playback progress, recently viewed titles, search history, preferences and any films you save offline are stored <strong>only on your device</strong> (IndexedDB, Cache Storage and local storage). They are not sent to us.</li>
        <li>To personalise “Recommended For You”, the slugs of titles you recently viewed or saved may be sent with the homepage request, without any identifier.</li>
      </ul>
      <h2>Account holders</h2>
      <ul>
        <li>Username, email address and a salted bcrypt hash of your password (we never store your password in plain text).</li>
        <li>Your list, favourites, ratings, playback positions, download history and preferences, so they sync across devices.</li>
        <li>An optional avatar image you upload.</li>
        <li>A secure, HTTP-only session cookie that keeps you signed in. We do not use advertising or third-party tracking cookies.</li>
      </ul>
      <h2>Your choices</h2>
      <p>You can clear your watch and download history from your profile, and permanently delete your account (and all associated data) from Profile → Settings. For other requests contact <a href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a>.</p>
      <h2>Notifications</h2>
      <p>Notifications are off by default and are only shown after you enable them and grant browser permission.</p>
      <h2>Content reports</h2>
      <p>When you submit a report or contact form, we store your name, email and message to handle the request.</p>
    </>
  )
}

function Terms() {
  return (
    <>
      <p>By using {BRAND.name} you agree to these terms.</p>
      <h2>The service</h2>
      <p>{BRAND.name} lets you discover, stream and download films that we are permitted to distribute. Availability of titles, qualities and downloads may change, and some titles are listed for information only (“Download currently unavailable”).</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Downloads are for personal use unless a title’s licence states otherwise (public-domain works may be reused freely where the law allows).</li>
        <li>Do not attempt to access other users’ data, circumvent access controls, overload the service, or upload material you don’t have the rights to.</li>
      </ul>
      <h2>Accounts</h2>
      <p>You are responsible for keeping your password secure. We may suspend accounts that violate these terms or repeatedly infringe copyright.</p>
      <h2>Disclaimer</h2>
      <p>The service is provided “as is”. Rights information is supplied in good faith; see our <Link to="/copyright">Copyright Policy</Link> for how to raise concerns.</p>
      <h2>Contact</h2>
      <p>Questions? <Link to="/contact">Contact us</Link>.</p>
    </>
  )
}
