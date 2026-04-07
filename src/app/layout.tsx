import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Funding Ops",
  description: "Standalone funding operations dashboard extracted from client-acquisition-hub.",
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
