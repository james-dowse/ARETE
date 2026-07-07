import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

// Display serif — titres et grands chiffres (direction « Or Massif »)
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARETE",
  description: "Training system powered by movement intelligence",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ARETE" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0A0908",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full ${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-full flex"><ServiceWorkerRegister />{children}</body>
    </html>
  );
}
