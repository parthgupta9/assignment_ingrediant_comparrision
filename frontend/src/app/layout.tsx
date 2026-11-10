import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ingredient Composition Matcher",
  description: "Identify competitive manufacturers and sales leads by matching active pharmaceutical ingredients.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
