import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Nav } from "@/components/nav"
import { ThemeProvider } from "@/components/theme-provider"
import { StoreInitializer } from "@/components/store-initializer"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Everything You Own",
  description: "A personal product database for tracking purchases, wishlists, and collections",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <StoreInitializer />
          <Nav />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
