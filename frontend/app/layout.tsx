import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "CONTAMAX — Del comprobante al software contable en segundos",
  description:
    "Subí fotos o PDFs de comprobantes fiscales argentinos y exportalos listos para Tango, Holistor, Bejerman y más. OCR + IA AFIP para contadores.",
  keywords: [
    "contabilidad argentina", "OCR facturas AFIP", "Tango Gestión", "Holistor",
    "Bejerman", "automatización contable", "CAE", "CUIT", "comprobantes fiscales"
  ],
  authors: [{ name: "CONTAMAX" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CONTAMAX",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: "/icons/icon-192.png",
  },
  openGraph: {
    title: "CONTAMAX",
    description: "Del comprobante papel a tu software contable en segundos.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
