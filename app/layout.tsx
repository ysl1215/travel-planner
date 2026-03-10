import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Planner AI",
  description: "AI-powered travel planner that finds perfect destinations based on your budget, preferences, and travel style",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
