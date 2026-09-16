import type { Metadata, Viewport } from "next";
import { Karla, Newsreader } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import "./globals.css";

const inter = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

// Display serif — titres et grands chiffres, direction « Basalte »
const fraunces = Newsreader({
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
  themeColor: "#17130F",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full ${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-full flex">
        <ServiceWorkerRegister />
        {/* <AttributesSync/> a été déplacé dans app/(app)/layout.tsx, qui peut
            lui passer le référentiel déjà chargé côté serveur. Ici, il partait
            systématiquement chercher /api/attributes au montage — y compris sur
            la page de connexion et les pages d'invitation, qui n'utilisent
            aucune valeur de référentiel. */}
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
