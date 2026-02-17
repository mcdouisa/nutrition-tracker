import { AuthProvider } from '../lib/AuthContext'

export const metadata = {
  title: 'Lytz',
  description: 'Daily nutrition tracking & healthy habits',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
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
    <html lang="en" style={{ backgroundColor: '#fefefe' }}>
      <body style={{ margin: 0, backgroundColor: '#fefefe', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
