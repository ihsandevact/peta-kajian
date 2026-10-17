import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { LivePlayerProvider } from "@/context/LivePlayerContext";
import PersistentFloatingLivePlayer from "@/components/PersistentFloatingLivePlayer";
import FloatingStudyNotes from "@/components/FloatingStudyNotes";
import LoginNudgePrompt from "@/components/LoginNudgePrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Peta Kajian Indonesia",
  description: "Temukan jadwal kajian terdekat di seluruh wilayah Indonesia.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Peta Kajian",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=3" },
      { url: "/favicon-16x16.png?v=3", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=3", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Peta Kajian" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body 
        className="font-geist antialiased bg-surface text-on-surface h-full flex flex-col"
        suppressHydrationWarning
      >
        <LivePlayerProvider>
          {children}
          <PersistentFloatingLivePlayer />
          <FloatingStudyNotes />
          <LoginNudgePrompt />
          <PWAInstallPrompt />
        </LivePlayerProvider>
      </body>
    </html>
  );
}

