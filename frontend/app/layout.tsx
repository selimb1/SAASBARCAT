import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "contabilizAR — Automatización Contable para Argentina",
  description:
    "Subí fotos o PDFs de comprobantes y exportalos listos para Holistor, Tango Gestión y Bejerman. OCR + IA para contadores argentinos.",
  keywords: ["contabilidad argentina", "OCR facturas", "Tango Gestión", "Holistor", "Bejerman", "automatización contable"],
  authors: [{ name: "contabilizAR" }],
  openGraph: {
    title: "contabilizAR",
    description: "De la foto al asiento, sin tocar el teclado.",
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
