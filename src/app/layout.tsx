import type { Metadata } from "next";
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
  title: APP_NAME,
  description:
    "Brev, frister og krav — samlet på ett sted, med hjelp til å svare riktig og i tide.",
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
