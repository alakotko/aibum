import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Albumin",
  description: "Workflow-first white-label album sales for photographers",
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
