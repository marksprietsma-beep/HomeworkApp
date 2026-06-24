import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clarion",
  description: "structured homework, feedback and learning clarity.",
  icons: {
    icon: "/brand/clarion_app_icon.png",
    shortcut: "/brand/clarion_app_icon.png",
    apple: "/brand/clarion_app_icon.png",
  },
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
