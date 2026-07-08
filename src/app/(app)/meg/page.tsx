import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, LogOut, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme } from "@/components/ui";
import SlettKonto from "@/components/SlettKonto";
import VarselInnstilling from "@/components/VarselInnstilling";
import { Fornavn } from "./Fornavn";
import { TemaVelger } from "./Tema";
import { APP_NAME, SUPPORT_EPOST } from "@/lib/brand";

export const metadata = {
  title: `Meg — ${APP_NAME}`,
};

function Gruppe({ tittel, children }: { tittel: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.4px] text-dempet">
        {tittel}
      </p>
      <div className="flex flex-col divide-y divide-strek overflow-hidden rounded-2xl border-[0.5px] border-strek bg-flate">
        {children}
      </div>
    </section>
  );
}

export default async function MegPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fornavn = (user?.user_metadata?.fornavn as string | undefined) ?? "";
  const varslerPa = user?.user_metadata?.varsler_paa !== false;

  return (
    <Skjermramme className="pt-6">
      <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
        Meg
      </h1>

      <Gruppe tittel="Konto">
        <div className="px-[18px] py-4">
          <Fornavn start={fornavn} />
        </div>
        <div className="px-[18px] py-4">
          <p className="text-sm font-medium text-blekk">E-post</p>
          <p className="mt-0.5 text-[13px] text-dempet">{user?.email}</p>
        </div>
      </Gruppe>

      <Gruppe tittel="Utseende">
        <div className="px-[18px] py-4">
          <p className="text-sm font-medium text-blekk">Tema</p>
          <p className="mb-3 mt-0.5 text-[13px] text-dempet">
            Velg lyst, mørkt, eller følg enheten din.
          </p>
          <TemaVelger />
        </div>
      </Gruppe>

      <Gruppe tittel="Varsling">
        <div className="px-[18px] py-4">
          <VarselInnstilling pa={varslerPa} />
        </div>
      </Gruppe>

      <Gruppe tittel="Hjelp og info">
        <a
          href={`mailto:${SUPPORT_EPOST}?subject=${encodeURIComponent(
            "Hjelp med Medhold",
          )}`}
          className="trykk flex items-center justify-between px-[18px] py-4 text-sm text-blekk"
        >
          <span className="flex items-center gap-2.5">
            <Mail className="size-4 shrink-0 text-dempet" aria-hidden />
            Kontakt support
          </span>
          <ChevronRight className="size-4 shrink-0 text-dempet" aria-hidden />
        </a>
        <Link
          href="/personvern"
          className="trykk flex items-center justify-between px-[18px] py-4 text-sm text-blekk"
        >
          Personvern og data
          <ChevronRight className="size-4 shrink-0 text-dempet" aria-hidden />
        </Link>
        <div className="px-[18px] py-4">
          <p className="text-[13px] leading-relaxed text-dempet">
            {APP_NAME} er et verktøy for å holde oversikt — ikke en offentlig
            tjeneste og ikke profesjonell rådgivning. Bekreft alltid viktige
            ting med rett instans.
          </p>
        </div>
      </Gruppe>

      <div className="mt-8 flex flex-col gap-5">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="trykk flex items-center gap-2 text-sm text-dempet transition hover:text-blekk"
          >
            <LogOut className="size-4" aria-hidden />
            Logg ut
          </button>
        </form>
        <SlettKonto />
      </div>
    </Skjermramme>
  );
}
