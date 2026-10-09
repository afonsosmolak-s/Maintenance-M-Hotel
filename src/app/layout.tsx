import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: brand.productName,
    template: `%s · ${brand.productName}`,
  },
  description: `Gestão de manutenção para motéis e hotéis — ${brand.company}.`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
