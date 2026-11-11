import { Bell, Mail, FileText, ShieldCheck, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme, Sekvens, SekvensDel } from "@/components/ui";
import SlettKonto from "@/components/SlettKonto";
import VarselInnstilling from "@/components/VarselInnstilling";
import { TilbakeKnapp } from "@/components/TilbakeKnapp";
import { APP_NAME, APP_VERSJON, SUPPORT_EPOST } from "@/lib/brand";
import { initialerFra } from "@/lib/tint";
import { Gruppe } from "./Gruppe";
import { Rad } from "./Rad";
import { TemaRad } from "./TemaRad";
import { BrevnavnRad } from "./BrevnavnRad";

export const metadata = {
  title: `Meg — ${APP_NAME}`,
};

// user.identities → lesbar liste over innloggingsmåter (jf. 1.5: kun informativt).
const PROVIDER_ETIKETT: Record<string, string> = {
  email: "E-postkode",
  phone: "Telefon",
  google: "Google",
};

export default async function MegPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ett navnefelt (brevnavn) dekker både profilhodet og brevsignaturen.
  // Fallback til det gamle fornavn-feltet for brukere som satte det før
  // sammenslåingen — aldri tomt for noen som allerede har oppgitt et navn.
  const navn =
    ((user?.user_metadata?.brevnavn as string | undefined) ??
      (user?.user_metadata?.fornavn as string | undefined)) ??
    "";
  const telefon = (user?.user_metadata?.telefon as string | undefined) ?? "";
  const varslerPa = user?.user_metadata?.varsler_paa !== false;
  // Kun første ord vises i hodet; resten av navnet er der for brevsignaturen.
  const fornavn = navn.trim().split(/\s+/)[0] ?? "";

  const innlogging =
    (user?.identities ?? [])
      .map(
        (i) =>
          PROVIDER_ETIKETT[i.provider] ??
          i.provider.charAt(0).toUpperCase() + i.provider.slice(1),
      )
      .join(", ") || "E-postkode";

  return (
    <Skjermramme className="pt-3" animerInn={false}>
      <h1 className="sr-only">Meg</h1>

      <Sekvens>
      <SekvensDel>
        <TilbakeKnapp />
      </SekvensDel>

      <SekvensDel>
        <div className="flex flex-col items-center pb-6 pt-2 text-center">
          <div
            aria-hidden
            className="flex size-[72px] items-center justify-center rounded-full bg-knapp text-[28px] font-bold text-knapp-tekst"
          >
            {initialerFra(navn, user?.email)}
          </div>
          {fornavn && <p className="mt-3 text-[22px] font-bold leading-tight text-blekk">{fornavn}</p>}
          <p className="mt-0.5 max-w-full break-all text-[15px] text-dempet">{user?.email ?? ""}</p>
        </div>
      </SekvensDel>

      <SekvensDel>
      <Gruppe>
        <BrevnavnRad navn={navn} telefon={telefon} innlogging={innlogging} />
        <Rad
          ikon={Bell}
          etikett="E-postpåminnelser"
          høyre={<VarselInnstilling pa={varslerPa} />}
          chevron={false}
        />
        <TemaRad />
      </Gruppe>
      </SekvensDel>

      <SekvensDel>
      <Gruppe>
        <Rad ikon={Scale} etikett="Satsene vi bruker" href="/satser" />
        <Rad ikon={FileText} etikett="Alle brev" href="/brev" />
        <Rad
          ikon={Mail}
          etikett="Kontakt support"
          href={`mailto:${SUPPORT_EPOST}?subject=${encodeURIComponent(
            "Hjelp med Medhold",
          )}`}
        />
        <Rad ikon={ShieldCheck} etikett="Personvern og data" href="/personvern" />
      </Gruppe>
      </SekvensDel>

      <SekvensDel>
      <Gruppe>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="trykk flex min-h-[52px] w-full items-center justify-center px-[14px] py-2.5 text-brod font-semibold text-dom-rod focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dom-rod"
          >
            Logg ut
          </button>
        </form>
      </Gruppe>
      </SekvensDel>

      <SekvensDel>
      <div className="mt-2 flex flex-col items-center gap-3 text-center">
        <SlettKonto />
        <p className="text-[13px] text-dempet">
          {APP_NAME} {APP_VERSJON} · Ikke profesjonell rådgivning
        </p>
      </div>
      </SekvensDel>
      </Sekvens>
    </Skjermramme>
  );
}
