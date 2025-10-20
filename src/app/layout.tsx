import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";

import { LanguageProvider } from "~/lib/i18n/LanguageProvider";
import { defaultLocale, isLocale } from "~/lib/i18n/config";
import { TRPCReactProvider } from "~/trpc/react";
import { AuthProvider } from "./_components/AuthProvider";
import { AuthGuard } from "./_components/AuthGuard";
import { ThemeProvider } from "./_components/ThemeProvider";
import { ModalStackProvider } from "./_components/modal/ModalStackProvider";

export const metadata: Metadata = {
  title: "PVE Scripts local",
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

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headerList = await headers();
  const cookieHeader = headerList.get("cookie");
  let initialLocale = defaultLocale;

  if (cookieHeader) {
    const localeEntry = cookieHeader
      .split(";")
      .map((entry: string) => entry.trim())
      .find((entry: string) => entry.startsWith("pve-locale="));

    if (localeEntry) {
      const value = localeEntry.split("=")[1];
      if (isLocale(value)) {
        initialLocale = value;
      }
    }
  }

  return (
    <html lang={initialLocale} className={geist.variable}>
      <body
        className="bg-background text-foreground transition-colors"
        suppressHydrationWarning={true}
      >
        <LanguageProvider initialLocale={initialLocale}>
          <ThemeProvider>
            <TRPCReactProvider>
              <AuthProvider>
                <ModalStackProvider>
                  <AuthGuard>{children}</AuthGuard>
                </ModalStackProvider>
              </AuthProvider>
            </TRPCReactProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
