import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/brand";
import type { GebyrsjekkResultat } from "@/lib/gebyr";

// Story-format (Instagram/TikTok), samme next/og-mønster som
// opengraph-image.tsx — men autentisert (ikke en offentlig fil-konvensjon):
// bildet er trygt å dele (ingen kreditor/sak-detaljer), men selve
// GENERERINGEN skal likevel kun skje for saken sin egen eier.
function totalOver(resultat: GebyrsjekkResultat | null): number {
  if (!resultat) return 0;
  return resultat.linjer
    .filter((l) => l.vurdering === "over")
    .reduce((sum, l) => sum + (l.differanse ?? 0), 0);
}

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Ikke innlogget", { status: 401 });

  const { data: sak } = await supabase
    .from("saker")
    .select("id, status, utfall")
    .eq("id", id)
    .maybeSingle();
  if (!sak || sak.status !== "fullfort" || sak.utfall !== "medhold") {
    return new Response("Fant ikke et delbart resultat", { status: 404 });
  }

  const { data: nyesteBrev } = await supabase
    .from("brev")
    .select("gebyrsjekk")
    .eq("sak_id", id)
    .order("brevdato", { ascending: false, nullsFirst: false })
    .order("opprettet", { ascending: false })
    .limit(1)
    .maybeSingle();
  const belop = totalOver(
    (nyesteBrev?.gebyrsjekk as GebyrsjekkResultat | null) ?? null,
  );
  // Beløpet er kun med når det faktisk finnes et lagret gebyrfunn å vise til
  // — aldri et oppdiktet tall (samme «AI tolker, kode beslutter»-prinsipp
  // som resten av gebyrsjekken).
  const undertekst =
    belop > 0 ? "tilbake fordi salæret var over lovlig sats" : "kravet ble frafalt";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 100,
          background: "linear-gradient(160deg, #153529 0%, #1f4d3d 55%, #2f6e56 100%)",
          fontFamily: "serif",
          textAlign: "center",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
          <div
            style={{ width: 48, height: 56, borderRadius: 12, background: "rgba(255,255,255,.35)" }}
          />
          <div
            style={{ width: 48, height: 92, borderRadius: 12, background: "rgba(255,255,255,.35)" }}
          />
          <div style={{ width: 48, height: 136, borderRadius: 12, background: "#d9b25e" }} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 70,
            color: "#ffffff",
            fontSize: 82,
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          <span>Jeg fikk</span>
          <span style={{ color: "#d9b25e", fontStyle: "italic" }}>medhold.</span>
        </div>
        {belop > 0 && (
          <div style={{ display: "flex", marginTop: 60, color: "#d9b25e", fontSize: 140, fontWeight: 600 }}>
            {kr(belop)} kr
          </div>
        )}
        <div
          style={{
            display: "flex",
            marginTop: 26,
            color: "rgba(255,255,255,.75)",
            fontSize: 42,
            maxWidth: 760,
            fontFamily: "sans-serif",
          }}
        >
          {undertekst}
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 80,
            color: "rgba(255,255,255,.55)",
            fontSize: 42,
            fontStyle: "italic",
          }}
        >
          {APP_NAME}
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
