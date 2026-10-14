import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/components/auth-provider'
import { SocketProvider } from '@/components/socket-provider'
import { RuntimeConfigGate } from '@/components/runtime-config-gate'
import './globals.css'

export const metadata: Metadata = {
  title: 'SCOPE // System Monitor',
  description: 'Tactical infrastructure monitoring dashboard',
  applicationName: 'SCOPE',
  // Icons (icon.svg, favicon.ico, apple-icon.png) and the web manifest are
  // auto-detected by Next from the app/ directory — no manual links needed.
  appleWebApp: {
    capable: true,
    title: 'SCOPE',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#080a08',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-mono antialiased">
        <RuntimeConfigGate>
          <AuthProvider>
            <SocketProvider>
              {children}
            </SocketProvider>
          </AuthProvider>
        </RuntimeConfigGate>
        <Analytics />
      </body>
    </html>
  )
}
