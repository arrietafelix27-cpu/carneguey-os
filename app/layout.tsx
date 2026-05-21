import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PointerEventsGuard } from "@/components/shared/pointer-events-guard";

export const metadata: Metadata = {
  title: "Carnegüey OS",
  description: "Sistema de gestión interno de Carnegüey",
};

export const viewport: Viewport = {
  themeColor: "#D40000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO">
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-center" />
        <PointerEventsGuard />
      </body>
    </html>
  );
}
