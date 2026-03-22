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

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ backgroundColor: '#0D0D0D' }}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
