import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { Metadata, Viewport } from "next";
import "../../styles/global.css";
import "../../styles/animations.css";
import SplashCursor from "@/components/SplashCursor";
import { AppProvider } from "@/context/AppContext";
import ScrollRestoration from "@/components/ScrollRestoration";
import RootLayoutShell from "@/components/RootLayoutShell";
import MobileBlocker from "@/components/MobileBlocker";

export const metadata: Metadata = {
  metadataBase: new URL("https://brmax.xyz"),
  title: "BR-MAX | iMessage Conversation Video Generator",
  description:
    "Generate realistic iMessage-style conversation videos with full control over scripts, voices, themes, monetization chats, and cinematic rendering — all inside BR-MAX.",
  keywords: [
    "BR-MAX",
    "iMessage video generator",
    "chat video maker",
    "iMessage conversation video",
    "Remotion video generator",
    "scripted chat visuals",
    "chat marketing videos",
    "iMessage chat animation",
    "video rendering tool",
  ],
  openGraph: {
    title: "BR-MAX — Generate Realistic iMessage-Style Conversation Videos",
    description:
      "Generate scripted iMessage conversations, customize voice settings, add monetization segments, and export polished conversation videos seamlessly.",
    url: "https://brmax.xyz/",
    siteName: "BR-MAX",
    type: "website",
    images: [
      {
        url: "https://br-max.s3.ap-south-1.amazonaws.com/og-brmax-1200x630.png",
        width: 1200,
        height: 630,
        alt: "BR-MAX iMessage Conversation Video Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BR-MAX — iMessage Conversation Video Generator",
    description:
      "Create polished iMessage-style videos from your custom scripts with full control over visuals and audio.",
    images: [
      "https://br-max.s3.ap-south-1.amazonaws.com/og-brmax-1200x630.png",
    ],
  },
  alternates: {
    canonical: "https://brmax.xyz/",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <Analytics />
      <html lang="en">
        <AppProvider>
          <SplashCursor />
          <ScrollRestoration />
          <body className="min-h-screen flex flex-col bg-transparent text-white antialiased">
              <RootLayoutShell>{children}</RootLayoutShell>
          </body>
        </AppProvider>
      </html>
    </ClerkProvider>
  );
}
