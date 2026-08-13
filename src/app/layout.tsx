import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { AppBanner } from "@/components/AppBanner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SmartDollarFX - Binary Trading Platform",
  description: "Trade binary options on synthetic indices",
};

export const viewport: Viewport = {
  themeColor: "#833ab4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <AppBanner />
        <SessionProvider>{children}</SessionProvider>
        <Script id="brevo-conversations" strategy="afterInteractive">
          {`(function(d, w, c) {
            w.BrevoConversationsID = '6a6cf0e761b4158f8b09143d';
            w[c] = w[c] || function() {
              (w[c].q = w[c].q || []).push(arguments);
            };
            var s = d.createElement('script');
            s.async = true;
            s.src = 'https://conversations-widget.brevo.com/brevo-conversations.js';
            if (d.head) d.head.appendChild(s);
          })(document, window, 'BrevoConversations');`}
        </Script>
      </body>
    </html>
  );
}
