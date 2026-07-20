import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description:
      "Brev, frister og krav — samlet på ett sted, med hjelp til å svare riktig og i tide.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#21456e",
    lang: "nb",
    icons: [
      { src: "/ikon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/ikon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/ikon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
