import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Kort, Primærknapp } from "@/components/ui";
import { KravBrevFaner } from "@/components/KravBrevFaner";
import { formaterKortDato } from "@/lib/dato";
import { STADIUM_ETIKETT, type BrevType } from "@/lib/gjeld";

type BrevRad = {
  id: string;
  sak_id: string;
  avsender: string | null;
  brevtype: BrevType | null;
  brevdato: string | null;
  opprettet: string;
  saker: { kreditor: string | null; tittel: string } | null;
};

function brevtypeEtikett(bt: BrevType | null): string {
  if (!bt || bt === "annet") return "Brev";
  const t = STADIUM_ETIKETT[bt];
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default async function BrevArkivPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brev")
    .select(
      "id, sak_id, avsender, brevtype, brevdato, opprettet, saker(kreditor, tittel)",
    )
    .order("brevdato", { ascending: false, nullsFirst: false })
    .order("opprettet", { ascending: false });

  const brev = (data ?? []) as unknown as BrevRad[];

  return (
    <Skjermramme className="pt-6">
      <KravBrevFaner aktiv="brev" />

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
        <ul className="flex flex-col gap-2.5">
          {brev.map((b) => {
            const dato = b.brevdato ?? b.opprettet.slice(0, 10);
            const kravnavn = b.saker?.kreditor ?? b.saker?.tittel;
            return (
              <li key={b.id}>
                <Link href={`/krav/${b.sak_id}/brev/${b.id}`} className="block">
                  <Kort klikkbar className="hover:border-dempet/40">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-blekk">
                        {brevtypeEtikett(b.brevtype)}
                        {b.avsender ? ` · ${b.avsender}` : ""}
                      </span>
                      <span className="shrink-0 text-xs text-dempet">
                        {formaterKortDato(dato)}
                      </span>
                    </div>
                    {kravnavn && (
                      <p className="mt-1 text-xs text-dempet">{kravnavn}</p>
                    )}
                  </Kort>
                </Link>
              </li>
            );
          })}
        </ul>
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
