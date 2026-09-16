import type { Metadata, Viewport } from "next";
import { Karla, Newsreader } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import "./globals.css";

// Graisses réellement utilisées, mesurées dans le code : 700 (245 usages),
// 600 (122), 800 (56), 400 (corps de texte). La graisse 500 n'était appelée
// qu'une seule fois. Chaque graisse est un fichier woff2 supplémentaire à
// télécharger avant le premier rendu — ce qui se paie cher hors wifi.
const inter = Karla({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

// Display serif — titres et grands chiffres, direction « Basalte ».
// Employé uniquement en 700 et 800 : les graisses 500 et 600 étaient
// téléchargées sans jamais être demandées.
const fraunces = Newsreader({
  subsets: ["latin"],
  weight: ["700", "800"],
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
      <head>
        {/* Les couvertures de séance et les vignettes de la bibliothèque
            viennent toutes de ce domaine. Ouvrir la connexion pendant l'analyse
            du document évite de payer DNS + TLS au moment où la première image
            entre dans le champ — plusieurs centaines de millisecondes en 4G. */}
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        {/* Couvertures de séance choisies par les auteurs (Google Drive). */}
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
      </head>
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
