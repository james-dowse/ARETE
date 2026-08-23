import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AttributesSync from "@/components/AttributesSync";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const inter = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Display condensé — titres et CTA, direction « Spartiate »
const fraunces = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
      <body className="min-h-full flex">
        <ServiceWorkerRegister />
        <AttributesSync />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
