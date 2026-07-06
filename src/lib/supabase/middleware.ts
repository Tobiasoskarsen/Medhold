import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Fornyer Supabase-sessionen på hver request og beskytter ruter.
 * Uinnloggede brukere sendes til /velkommen (unntatt offentlige ruter).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Viktig: ikke kjør kode mellom createServerClient og getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/velkommen") ||
    path.startsWith("/logg-inn") ||
    path.startsWith("/auth") ||
    path.startsWith("/personvern") ||
    // Cron-endepunktet har ingen innlogget bruker — det sikres av CRON_SECRET
    // i selve ruten. Uten dette unntaket ville proxy-en sendt Vercel Cron til
    // innlogging, og jobben ville aldri kjørt.
    path.startsWith("/api/cron");

  // Uinnlogget på en beskyttet rute → velkomstskjermen (roten for uinnloggede).
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/velkommen";
    return NextResponse.redirect(url);
  }

  // Innlogget bruker som treffer velkomst/innlogging → rett til Hjem.
  if (
    user &&
    (path.startsWith("/velkommen") || path.startsWith("/logg-inn"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Returner supabaseResponse uendret slik at cookies følger med.
  return supabaseResponse;
}
