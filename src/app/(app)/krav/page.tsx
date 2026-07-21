import { NavLenke as Link } from "@/components/NavLenke";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Kort, Primærknapp, Trapp } from "@/components/ui";
import { Kravkort } from "./Kravkort";
import { AvsluttedeListe } from "./AvsluttedeListe";
import { STADIUM_ETIKETT, type Stadium } from "@/lib/gjeld";
import { formaterBelop } from "@/lib/format";
import type { SakStatus, SakUtfall } from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";

type SakRad = {
  id: string;
  kreditor: string | null;
  tittel: string;
  opprinnelig_kreditor: string | null;
  belop_totalt: number | null;
  stadium: Stadium | null;
  status: SakStatus;
  utfall: SakUtfall | null;
  sist_endret: string;
};

/** «{N} aktive · {M} venter på svar · {K} avsluttet» — ledd med 0 utelates. */
function oversiktsstripe(saker: SakRad[]): string {
  const aktiv = saker.filter((s) => s.status === "aktiv").length;
  const venter = saker.filter((s) => s.status === "venter_pa_svar").length;
  const avsluttet = saker.filter((s) => s.status === "fullfort").length;
  return [
    aktiv > 0 ? `${aktiv} aktive` : null,
    venter > 0 ? `${venter} venter på svar` : null,
    avsluttet > 0 ? `${avsluttet} avsluttet` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function KravListePage() {
  const supabase = await createClient();

  const [{ data: sakData }, { data: fristData }, { data: brevData }] =
    await Promise.all([
      supabase
        .from("saker")
        .select(
          "id, kreditor, tittel, opprinnelig_kreditor, belop_totalt, stadium, status, utfall, sist_endret",
        )
        .order("sist_endret", { ascending: false }),
      supabase
        .from("frister")
        .select("sak_id, forfallsdato")
        .eq("fullfort", false),
      // Nyeste brev per sak (kun for funn-markøren) — ÉN spørring, ingen N+1.
      supabase
        .from("brev")
        .select("sak_id, opprettet, gebyrsjekk")
        .order("opprettet", { ascending: false }),
    ]);

  const saker = (sakData ?? []) as SakRad[];
  const frister = (fristData ?? []) as { sak_id: string; forfallsdato: string }[];

  const nesteFrist = new Map<string, string>();
  for (const f of frister) {
    const nå = nesteFrist.get(f.sak_id);
    if (!nå || f.forfallsdato < nå) nesteFrist.set(f.sak_id, f.forfallsdato);
  }

  // Nyeste brev er først (DB-sortert) → første treff per sak_id holdes.
  const harFunnPerSak = new Map<string, boolean>();
  for (const b of brevData ?? []) {
    if (harFunnPerSak.has(b.sak_id)) continue;
    const gs = b.gebyrsjekk as GebyrsjekkResultat | null;
    harFunnPerSak.set(
      b.sak_id,
      !!gs?.linjer.some((l) => l.vurdering === "over"),
    );
  }

  const aktive = saker.filter((s) => s.status !== "fullfort");
  const avsluttede = saker.filter((s) => s.status === "fullfort");

  // Nærmeste åpne frist først; saker uten frist etter, sortert på sist_endret
  // (stabil sort — aktive er allerede i sist_endret-rekkefølge fra spørringen).
  const aktiveSortert = [...aktive].sort((a, b) => {
    const fa = nesteFrist.get(a.id);
    const fb = nesteFrist.get(b.id);
    if (fa && fb) return fa < fb ? -1 : 1;
    if (fa) return -1;
    if (fb) return 1;
    return 0;
  });

  function kortData(sak: SakRad) {
    return {
      id: sak.id,
      navn: sak.kreditor ?? sak.tittel,
      delNavn: !sak.opprinnelig_kreditor,
      belop: formaterBelop(sak.belop_totalt),
      stadiumEtikett: sak.stadium ? STADIUM_ETIKETT[sak.stadium] : null,
      frist: nesteFrist.get(sak.id) ?? null,
      status: sak.status,
      utfall: sak.utfall,
      harFunn: harFunnPerSak.get(sak.id) ?? false,
    };
  }

  const stripe = oversiktsstripe(saker);

  return (
    <Skjermramme className="pt-6">
      <h1 className="font-serif text-[26px] font-medium tracking-[-0.01em] text-blekk">
        Sakene dine
      </h1>
      {stripe && <p className="eyebrow mt-1.5">{stripe}</p>}

      {saker.length === 0 ? (
        <Kort className="mt-6">
          <Trapp stadium="faktura" kompakt />
          <p className="mt-4 text-[15px] leading-relaxed text-blekk">
            Legg inn ditt første brev, så holder Medhold oversikten.
          </p>
          <div className="mt-4">
            <Primærknapp href="/legg-til-brev">Legg til brev</Primærknapp>
          </div>
        </Kort>
      ) : (
        <>
          {aktive.length > 0 && (
            <div className="mt-6">
              {avsluttede.length > 0 && (
                <p className="eyebrow mb-2">Aktive</p>
              )}
              <ul className="flex flex-col gap-2.5">
                {aktiveSortert.map((sak) => (
                  <li key={sak.id}>
                    <Kravkort {...kortData(sak)} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {avsluttede.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow mb-2">Avsluttet</p>
              <AvsluttedeListe saker={avsluttede.map(kortData)} />
            </div>
          )}
        </>
      )}

      <Link
        href="/krav/ny"
        className="trykk mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-aksent/40 bg-flate px-3 py-3 text-sm font-medium text-aksent transition hover:bg-aksent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
      >
        <Plus className="size-4" aria-hidden />
        Opprett nytt krav
      </Link>
    </Skjermramme>
  );
}
