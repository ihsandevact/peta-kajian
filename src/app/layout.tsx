import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { ConfirmDialogProvider } from "@/context/ConfirmDialogContext";
import { BottomNavProvider } from "@/context/BottomNavContext";
import MobileBottomNav from "@/components/MobileBottomNav";
import NavigationHistoryTracker from "@/components/navigation/NavigationHistoryTracker";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { LivePlayerProvider } from "@/context/LivePlayerContext";
import PersistentFloatingLivePlayer from "@/components/PersistentFloatingLivePlayer";
import FloatingStudyNotes from "@/components/FloatingStudyNotes";
import LoginNudgePrompt from "@/components/LoginNudgePrompt";
import QueryProvider from "@/components/providers/QueryProvider";
import PWASplashScreen from "@/components/PWASplashScreen";

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
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
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
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body 
        className="font-geist antialiased bg-surface text-on-surface h-full flex flex-col"
        suppressHydrationWarning
      >
        <QueryProvider>
          <ThemeProvider>
            <ConfirmDialogProvider>
              <PWASplashScreen />
            <LivePlayerProvider>
              <BottomNavProvider>
                <NavigationHistoryTracker />
                {children}
                <MobileBottomNav />
                <PersistentFloatingLivePlayer />
                <FloatingStudyNotes />
                <LoginNudgePrompt />
                <PWAInstallPrompt />
              </BottomNavProvider>
            </LivePlayerProvider>
            </ConfirmDialogProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

