import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AspenIQ | Process Analytics Workspace',
  description:
    'Interactive process analytics dashboard for Aspen Plus / Aspen HYSYS simulation results. Upload CSV output files to analyze yield, conversion, energy, and optimization data.',
  keywords: ['Aspen Plus', 'HYSYS', 'process engineering', 'chemical engineering', 'analytics', 'simulation'],
  
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0d1728',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  )
}
