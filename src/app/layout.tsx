import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Nav } from "@/components/nav"
import { ThemeProvider } from "@/components/theme-provider"
import { StoreInitializer } from "@/components/store-initializer"
import { AuthProvider } from "@/components/auth-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Everything You Own",
    template: "%s | Everything You Own",
  },
  description: "Know what you own, where it is, and what it's worth. Track purchases, manage storage, and share with your household.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://stuff.imprevista.com"),
  openGraph: {
    title: "Everything You Own",
    description: "Personal home inventory tracker with Gmail import, NFC storage tracking, and household sharing.",
    url: "/",
    siteName: "Everything You Own",
    type: "website",
  },
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
          <AuthProvider>
            <StoreInitializer />
            <Nav />
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
