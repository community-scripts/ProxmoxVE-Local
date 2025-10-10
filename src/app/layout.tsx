import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "PVE Scripts local",
  description: "Manage and execute Proxmox helper scripts locally with live output streaming",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} dark`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Force dark mode
              document.documentElement.classList.add('dark');
            `,
          }}
        />
      </head>
      <body 
        className="bg-background text-foreground transition-colors"
        suppressHydrationWarning={true}
      >
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
