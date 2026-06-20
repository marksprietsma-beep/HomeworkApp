import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homework App",
  description: "Local-first homework app foundation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
