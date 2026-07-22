import { AuthProvider } from '../lib/AuthContext'
import './globals.css'

export const metadata = {
  title: 'Lytz',
  description: 'Daily nutrition tracking & healthy habits',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lytz',
  },
  icons: {
    apple: [{ url: '/icon.png', sizes: '1024x1024', type: 'image/png' }],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ backgroundColor: '#0D0D0D' }}>
      <body>
        <AuthProvider>
          {isStaging && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              background: 'linear-gradient(90deg, #FF9F0A, #FF6B00)',
              color: '#fff', textAlign: 'center',
              fontSize: '11px', fontWeight: '700', letterSpacing: '2px',
              padding: '5px 0', pointerEvents: 'none',
            }}>
              ⚠ STAGING — ADMIN TEST BUILD ⚠
            </div>
          )}
          <div style={isStaging ? { paddingTop: 25 } : undefined}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
