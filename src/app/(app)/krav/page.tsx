import { NavLenke as Link } from "@/components/NavLenke";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Kort, Primærknapp, Trapp, Sekvens, SekvensDel } from "@/components/ui";
import { Kravkort } from "./Kravkort";
import { AvsluttedeListe } from "./AvsluttedeListe";
import { GruppertSaksliste, type Gruppe, type GruppeRad } from "./GruppertSaksliste";
import { STADIUM_ETIKETT, type Stadium } from "@/lib/gjeld";
import { formaterBelop } from "@/lib/format";
import { dagerTil } from "@/lib/dato";
import { erHastende, fristChipTekst } from "@/lib/frist";
import { STATUS_ETIKETT, type SakStatus, type SakUtfall } from "@/lib/types";
import type { GebyrsjekkResultat } from "@/lib/gebyr";

type SakRad = {
  id: string;
  kreditor: string | null;
  tittel: string;
  opprinnelig_kreditor: string | null;
  saksnummer: string | null;
  belop_totalt: number | null;
  stadium: Stadium | null;
  status: SakStatus;
  utfall: SakUtfall | null;
  sist_endret: string;
};

// Grupperingen (på kreditor) vises kun når listen faktisk er stor nok til at
// den hjelper — med få saker er den vanlige, flate listen mer oversiktlig.
const GRUPPERING_TERSKEL = 10;

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
          "id, kreditor, tittel, opprinnelig_kreditor, saksnummer, belop_totalt, stadium, status, utfall, sist_endret",
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

  // Gruppert visning (kun brukt over terskelen, se lenger ned): raden inni
  // en åpnet gruppe. Kreditornavnet er allerede gruppens overskrift, så
  // radens egen tittel er saksnummeret når det finnes, ellers stadiet.
  function gruppeRad(sak: SakRad): GruppeRad {
    const frist = nesteFrist.get(sak.id) ?? null;
    const dagerIgjen = frist ? dagerTil(frist) : null;
    const hastende = dagerIgjen != null && erHastende(dagerIgjen);
    const stadiumTekst = sak.stadium ? STADIUM_ETIKETT[sak.stadium] : null;
    const fristTekst = dagerIgjen != null ? fristChipTekst(dagerIgjen) : null;
    const tittel = sak.saksnummer
      ? `Sak #${sak.saksnummer}`
      : (stadiumTekst ?? "Krav");
    const underDeler = sak.saksnummer
      ? [stadiumTekst, fristTekst].filter(Boolean)
      : [
          fristTekst ??
            (sak.status === "venter_pa_svar"
              ? STATUS_ETIKETT.venter_pa_svar
              : null),
        ].filter(Boolean);
    return {
      id: sak.id,
      tittel,
      underTekst: underDeler.length > 0 ? (underDeler.join(" · ") as string) : null,
      hastende,
      belop: sak.belop_totalt,
      harFunn: harFunnPerSak.get(sak.id) ?? false,
    };
  }

  // Gruppering på kreditor (§ mockup «gruppert saksliste») — kun over
  // GRUPPERING_TERSKEL aktive saker. Rekkefølgen inni hver gruppe arves fra
  // aktiveSortert (nærmeste frist først); selve gruppene sorteres på samlet
  // beløp (høyest øverst).
  const brukGruppering = aktive.length > GRUPPERING_TERSKEL;
  const grupper: Gruppe[] = [];
  const enkeltstaendeSaker: SakRad[] = [];
  if (brukGruppering) {
    const perKreditor = new Map<string, SakRad[]>();
    for (const sak of aktiveSortert) {
      const navn = sak.kreditor ?? sak.tittel;
      const liste = perKreditor.get(navn);
      if (liste) liste.push(sak);
      else perKreditor.set(navn, [sak]);
    }
    for (const [navn, liste] of perKreditor) {
      if (liste.length === 1) {
        enkeltstaendeSaker.push(liste[0]);
        continue;
      }
      const rader = liste.map(gruppeRad);
      const samletBelop = liste.reduce(
        (sum, s) => sum + (s.belop_totalt ?? 0),
        0,
      );
      let minDager: number | null = null;
      for (const s of liste) {
        const f = nesteFrist.get(s.id);
        if (!f) continue;
        const d = dagerTil(f);
        if (minDager == null || d < minDager) minDager = d;
      }
      grupper.push({
        navn,
        saker: rader,
        samletBelop: samletBelop > 0 ? samletBelop : null,
        harFunn: rader.some((r) => r.harFunn),
        fristTekst:
          minDager != null && erHastende(minDager)
            ? fristChipTekst(minDager)
            : null,
      });
    }
    grupper.sort((a, b) => (b.samletBelop ?? 0) - (a.samletBelop ?? 0));
  }
  const antallKreditorer = grupper.length + enkeltstaendeSaker.length;

  const stripe = oversiktsstripe(saker);

  return (
    <Skjermramme className="pt-6" animerInn={false}>
      <Sekvens>
      <SekvensDel>
      <h1 className="font-serif text-[26px] font-medium tracking-[-0.01em] text-blekk">
        Sakene dine
      </h1>
      </SekvensDel>
      {stripe && (
        <SekvensDel>
          <p className="eyebrow mt-1.5">{stripe}</p>
        </SekvensDel>
      )}

      {saker.length === 0 && (
        <SekvensDel>
          <Kort className="mt-6">
            <Trapp stadium="faktura" kompakt />
            <p className="mt-4 text-[15px] leading-relaxed text-blekk">
              Legg inn ditt første brev, så holder Medhold oversikten.
            </p>
            <div className="mt-4">
              <Primærknapp href="/legg-til-brev">Legg til brev</Primærknapp>
            </div>
          </Kort>
        </SekvensDel>
      )}
      {aktive.length > 0 && (
        <SekvensDel>
          <div className="mt-6">
            {avsluttede.length > 0 && <p className="eyebrow mb-2">Aktive</p>}
            {brukGruppering ? (
              <GruppertSaksliste
                grupper={grupper}
                enkeltstaende={enkeltstaendeSaker.map(kortData)}
                antallKreditorer={antallKreditorer}
              />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {aktiveSortert.map((sak) => (
                  <li key={sak.id}>
                    <Kravkort {...kortData(sak)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SekvensDel>
      )}
      {avsluttede.length > 0 && (
        <SekvensDel>
          <div className="mt-8">
            <p className="eyebrow mb-2">Avsluttet</p>
            <AvsluttedeListe saker={avsluttede.map(kortData)} />
          </div>
        </SekvensDel>
      )}
      </Sekvens>

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
