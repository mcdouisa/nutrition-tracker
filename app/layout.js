import { AuthProvider } from '../lib/AuthContext'

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
  themeColor: '#0D0D0D',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ backgroundColor: '#0D0D0D' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          ::-webkit-scrollbar { display: none; }
          body { overscroll-behavior: none; }
        `}</style>
      </head>
      <body style={{
        margin: 0,
        backgroundColor: '#0D0D0D',
        color: '#FFFFFF',
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
