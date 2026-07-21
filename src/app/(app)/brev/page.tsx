import { NavLenke as Link } from "@/components/NavLenke";
import { ChevronLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Kort, Primærknapp } from "@/components/ui";
import { formaterKortDato } from "@/lib/dato";
import { STADIUM_ETIKETT, type BrevType } from "@/lib/gjeld";
import type { GebyrsjekkResultat } from "@/lib/gebyr";

type BrevRad = {
  id: string;
  sak_id: string;
  avsender: string | null;
  brevtype: BrevType | null;
  brevdato: string | null;
  opprettet: string;
  gebyrsjekk: GebyrsjekkResultat | null;
  saker: { kreditor: string | null; tittel: string } | null;
};

type SakGruppe = {
  sakId: string;
  navn: string;
  brev: BrevRad[];
};

function brevtypeEtikett(bt: BrevType | null): string {
  if (!bt || bt === "annet") return "Brev";
  const t = STADIUM_ETIKETT[bt];
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function harOverFunn(g: GebyrsjekkResultat | null): boolean {
  return !!g?.linjer.some((l) => l.vurdering === "over");
}

export default async function BrevArkivPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brev")
    .select(
      "id, sak_id, avsender, brevtype, brevdato, opprettet, gebyrsjekk, saker(kreditor, tittel)",
    )
    .order("brevdato", { ascending: false, nullsFirst: false })
    .order("opprettet", { ascending: false });

  const brev = (data ?? []) as unknown as BrevRad[];

  // Grupper per sak — listen er allerede sortert nyeste-først, så første
  // treff per sak_id blir gruppens posisjon (sakene ender sortert på nyeste
  // brev, uten en egen sorteringsrunde).
  const grupper: SakGruppe[] = [];
  const indeksPerSak = new Map<string, number>();
  for (const b of brev) {
    const i = indeksPerSak.get(b.sak_id);
    if (i === undefined) {
      indeksPerSak.set(b.sak_id, grupper.length);
      grupper.push({
        sakId: b.sak_id,
        navn: b.saker?.kreditor ?? b.saker?.tittel ?? "Sak",
        brev: [b],
      });
    } else {
      grupper[i].brev.push(b);
    }
  }

  return (
    <Skjermramme className="pt-6">
      <Link
        href="/meg"
        className="mb-3.5 flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Meg
      </Link>
      <h1 className="font-serif text-[21px] font-medium tracking-[-0.01em] text-blekk">
        Alle brev
      </h1>

      <div className="mt-5">
        {brev.length === 0 ? (
          <Kort>
            <p className="text-[15px] leading-relaxed text-blekk">
              Ingen brev ennå. Legg inn ditt første brev, så samler vi dem her.
            </p>
            <div className="mt-4">
              <Primærknapp href="/legg-til-brev">Legg til brev</Primærknapp>
            </div>
          </Kort>
        ) : (
          grupper.map((g) => (
            <div key={g.sakId} className="mt-6 first:mt-0">
              <p className="eyebrow mb-2">
                {g.navn} · {g.brev.length} brev
              </p>
              <ul className="flex flex-col gap-2.5">
                {g.brev.map((b) => {
                  const dato = b.brevdato ?? b.opprettet.slice(0, 10);
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/krav/${b.sak_id}/brev/${b.id}`}
                        className="block"
                      >
                        <Kort klikkbar className="hover:border-dempet/40">
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-blekk">
                              {harOverFunn(b.gebyrsjekk) && (
                                <span
                                  role="img"
                                  aria-label="Gebyrfunn i dette brevet"
                                  className="font-serif text-[13px] font-semibold leading-none text-dom-rod"
                                >
                                  §
                                </span>
                              )}
                              {brevtypeEtikett(b.brevtype)}
                              {b.avsender ? ` · ${b.avsender}` : ""}
                            </span>
                            <span className="shrink-0 text-xs text-dempet">
                              {formaterKortDato(dato)}
                            </span>
                          </div>
                        </Kort>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <Link
        href="/legg-til-brev"
        className="trykk mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-aksent/40 bg-flate px-3 py-3 text-sm font-medium text-aksent transition hover:bg-aksent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
      >
        <Plus className="size-4" aria-hidden />
        Legg til brev
      </Link>
    </Skjermramme>
  );
}
