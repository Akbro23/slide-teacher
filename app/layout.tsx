import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// The variable names match the `@theme inline` mapping in globals.css.
const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Slide Teacher",
  description:
    "Upload a lecture PDF and get instant explanations of the terms that matter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* A fixed-height shell; every pane manages its own scrolling. */}
      <body className="flex h-full flex-col overflow-hidden">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
