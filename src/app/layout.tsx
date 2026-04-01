import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { AuthProvider } from "./_components/AuthProvider";
import { AuthGuard } from "./_components/AuthGuard";
import { ThemeProvider } from "./_components/ThemeProvider";
import { ModalStackProvider } from "./_components/modal/ModalStackProvider";

export const metadata: Metadata = {
  title: "PVE Scripts Local",
  description:
    "Manage and execute Proxmox helper scripts locally with live output streaming",
  icons: [
    { rel: "icon", url: "/favicon.png", type: "image/png" },
    { rel: "icon", url: "/favicon.ico", sizes: "any" },
    { rel: "apple-touch-icon", url: "/favicon.png" },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body
        className="bg-background text-foreground antialiased"
        style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
        suppressHydrationWarning={true}
      >
        {/* Dark ambient gradients */}
        <div className="dark-ambient dark-ambient-1" aria-hidden="true" />
        <div className="dark-ambient dark-ambient-2" aria-hidden="true" />
        <ThemeProvider>
          <TRPCReactProvider>
            <AuthProvider>
              <ModalStackProvider>
                <AuthGuard>{children}</AuthGuard>
              </ModalStackProvider>
            </AuthProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
