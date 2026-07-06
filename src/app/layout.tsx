import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/brand";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Brev, frister og krav — samlet på ett sted, med hjelp til å svare riktig og i tide.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nb"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bakgrunn text-blekk">
        {children}
      </body>
    </html>
  );
}
