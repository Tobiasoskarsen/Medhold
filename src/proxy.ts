import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Kjør på alle ruter unntatt statiske filer og bilder. `opengraph-image`
     * må være unntatt slik at sosiale mediers krawlere (ikke innlogget) kan
     * hente delingsbildet — ellers ville proxy-en sendt dem til /velkommen
     * i stedet for selve PNG-en (samme resonnement som manifest.webmanifest).
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
