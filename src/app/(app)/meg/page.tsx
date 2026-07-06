import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme } from "@/components/ui";
import SlettKonto from "@/components/SlettKonto";
import VarselInnstilling from "@/components/VarselInnstilling";
import { Fornavn } from "./Fornavn";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Meg — ${APP_NAME}`,
};

export default async function MegPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fornavn = (user?.user_metadata?.fornavn as string | undefined) ?? "";
  const varslerPa = user?.user_metadata?.varsler_paa !== false;

  return (
    <Skjermramme className="pt-6">
      <h1 className="mb-5 text-[21px] font-medium tracking-[-0.3px] text-blekk">
        Meg
      </h1>

      <div className="flex flex-col divide-y divide-strek">
        <div className="pb-5">
          <Fornavn start={fornavn} />
        </div>

        <div className="py-5">
          <p className="text-sm font-medium text-blekk">E-post</p>
          <p className="mt-0.5 text-[13px] text-dempet">{user?.email}</p>
        </div>

        <div className="py-5">
          <VarselInnstilling pa={varslerPa} />
        </div>

        <div className="py-5">
          <Link
            href="/personvern"
            className="text-sm text-blekk underline decoration-strek underline-offset-4 transition hover:decoration-dempet"
          >
            Personvern
          </Link>
        </div>

        <div className="py-5">
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-dempet transition hover:text-blekk">
              Logg ut
            </button>
          </form>
        </div>

        <div className="pt-5">
          <SlettKonto />
        </div>
      </div>
    </Skjermramme>
  );
}
