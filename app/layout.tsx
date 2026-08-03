import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PointerEventsGuard } from "@/components/shared/pointer-events-guard";
import { BUSINESS_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: BUSINESS_NAME, template: `%s · ${BUSINESS_NAME}` },
  description: `Sistema de gestión de ${BUSINESS_NAME}`,
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
        <Toaster position="top-center" />
        <PointerEventsGuard />
      </body>
    </html>
  );
}
