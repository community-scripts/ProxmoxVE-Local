import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { DarkModeProvider } from "./_components/DarkModeProvider";
import { DarkModeToggle } from "./_components/DarkModeToggle";

export const metadata: Metadata = {
  title: "PVE Scripts local",
  description: "",
  icons: [
    { rel: "icon", url: "/favicon.png", type: "image/png" },
    { rel: "icon", url: "/favicon.ico", sizes: "any" },
    { rel: "apple-touch-icon", url: "/favicon.png" },
  ],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme');
                  const theme = stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
                  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const shouldBeDark = theme === 'dark' || (theme === 'system' && systemDark);
                  
                  if (shouldBeDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  // Fallback to system preference if localStorage fails
                  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (systemDark) {
                    document.documentElement.classList.add('dark');
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body 
        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors"
        suppressHydrationWarning={true}
      >
        <DarkModeProvider>
          {/* Dark Mode Toggle in top right corner */}
          <div className="fixed top-4 right-4 z-50">
            <DarkModeToggle />
          </div>
          
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </DarkModeProvider>
      </body>
    </html>
  );
}
