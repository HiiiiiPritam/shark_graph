import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Shark3 - Network Simulation Platform",
  description: "Comprehensive Network Simulation and Learning Platform with realistic protocol implementations",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
