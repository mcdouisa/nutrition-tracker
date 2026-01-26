import { AuthProvider } from '../lib/AuthContext'

export const metadata = {
  title: 'Nutrition Tracker',
  description: 'Simple daily nutrition tracking',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
