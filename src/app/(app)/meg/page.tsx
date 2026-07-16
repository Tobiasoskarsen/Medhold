import { Bell, Mail, ShieldCheck, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme } from "@/components/ui";
import SlettKonto from "@/components/SlettKonto";
import VarselInnstilling from "@/components/VarselInnstilling";
import { APP_NAME, APP_VERSJON, SUPPORT_EPOST } from "@/lib/brand";
import { Gruppe } from "./Gruppe";
import { Rad } from "./Rad";
import { ProfilKort } from "./ProfilKort";
import { TemaRad } from "./TemaRad";

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

  const fornavn = (user?.user_metadata?.fornavn as string | undefined) ?? "";
  const telefon = (user?.user_metadata?.telefon as string | undefined) ?? "";
  const varslerPa = user?.user_metadata?.varsler_paa !== false;

  const innlogging =
    (user?.identities ?? [])
      .map(
        (i) =>
          PROVIDER_ETIKETT[i.provider] ??
          i.provider.charAt(0).toUpperCase() + i.provider.slice(1),
      )
      .join(", ") || "E-postkode";

  return (
    <Skjermramme className="pt-6">
      <h1 className="sr-only">Meg</h1>

      <ProfilKort
        fornavn={fornavn}
        epost={user?.email ?? ""}
        telefon={telefon}
        innlogging={innlogging}
      />

      <Gruppe tittel="Innstillinger">
        <TemaRad />
        <Rad
          ikon={Bell}
          etikett="E-postpåminnelser"
          høyre={<VarselInnstilling pa={varslerPa} />}
          chevron={false}
        />
      </Gruppe>

      <Gruppe tittel="Hjelp">
        <Rad
          ikon={Mail}
          etikett="Kontakt support"
          href={`mailto:${SUPPORT_EPOST}?subject=${encodeURIComponent(
            "Hjelp med Medhold",
          )}`}
        />
        <Rad ikon={ShieldCheck} etikett="Personvern og data" href="/personvern" />
      </Gruppe>

      <Gruppe>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="trykk flex w-full items-center gap-2.5 px-[14px] py-3 text-left text-sm text-blekk"
          >
            <LogOut className="size-[17px] shrink-0 text-dempet" aria-hidden />
            Logg ut
          </button>
        </form>
      </Gruppe>

      <div className="mt-[18px] flex flex-col items-center gap-1.5">
        <p className="text-center text-[12px] text-dempet">
          {APP_NAME} {APP_VERSJON} · Ikke profesjonell rådgivning
        </p>
        <SlettKonto />
      </div>
    </Skjermramme>
  );
}
