import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/brand";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Serif kun til overskrifter, beløp, Dommen, seier og profilhode (se serif-
// regelen i designordren). Variabel font → opsz-aksen aktiv; italic inkludert.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  // Kreves for at og:image/twitter:image (opengraph-image.tsx) skal bli en
  // gyldig absolutt URL i prod — samme fallback-URL som lib/epost.ts sin
  // appUrl() allerede bruker. Uten denne løser Next kun til localhost (se
  // build-advarselen), og delingsbildet ville vært uinnhentbart for Facebook/
  // LinkedIn/Twitters debuggere.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://app2-chi-five.vercel.app",
  ),
  title: APP_NAME,
  description:
    "Brev, frister og krav — samlet på ett sted, med hjelp til å svare riktig og i tide.",
  icons: {
    icon: "/favicon.ico",
    apple: "/ikon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  openGraph: {
    title: APP_NAME,
    description:
      "Forstå inkassobrevet ditt, sjekk gebyrene mot loven, og svar riktig og i tide.",
    locale: "nb_NO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description:
      "Forstå inkassobrevet ditt, sjekk gebyrene mot loven, og svar riktig og i tide.",
  },
};

export const viewport: Viewport = {
  themeColor: "#21456e",
  width: "device-width",
  initialScale: 1,
};

// Settes før paint (ingen FOUC): leser lagret tema og legger .mork på <html>
// hvis mørkt er valgt, eller «system» og OS er mørkt.
const TEMA_SKRIPT = `(function(){try{var t=localStorage.getItem('medhold-tema')||'system';var d=t==='mork'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('mork');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nb"
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bakgrunn text-blekk">
        <script dangerouslySetInnerHTML={{ __html: TEMA_SKRIPT }} />
        {children}
      </body>
    </html>
  );
}
