import type { Metadata } from "next";
import { appearanceForViewer, appearanceRootAttributes } from "../lib/appearance";
import { getCurrentUser } from "../lib/auth";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const appearance = appearanceForViewer(user);

  return (
    <html lang="en" {...appearanceRootAttributes(appearance)}>
      <body>{children}</body>
    </html>
  );
}
