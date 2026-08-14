import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI League Coach",
  description: "AI-powered League of Legends performance analyzer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Link href="/" className="text-sm font-semibold tracking-wide text-text-primary">
              <span className="text-accent">AI</span> League Coach
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
