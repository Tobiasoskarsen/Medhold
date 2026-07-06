import { Check } from "lucide-react";
import { Skjermramme, Kort, Primærknapp } from "@/components/ui";
import { erPilot, PLUSS_PRIS } from "@/lib/plan";
import { APP_NAME } from "@/lib/brand";

const PUNKTER = [
  "Ferdige utkast til innsigelse og klage",
  "Fotografer brevet i stedet for å skrive det av",
  "Alle krav samlet — uten grenser",
];

export const metadata = {
  title: `${APP_NAME} Pluss`,
};

export default function PlussPage() {
  const pilot = erPilot();

  return (
    <Skjermramme className="pt-6">
      <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
        {APP_NAME} Pluss
      </h1>

      <Kort className="mt-4">
        <ul className="flex flex-col gap-3.5">
          {PUNKTER.map((p) => (
            <li key={p} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-aksent" aria-hidden />
              <span className="text-sm leading-relaxed text-blekk">{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 border-t-[0.5px] border-strek pt-5">
          {pilot ? (
            <p className="text-sm font-medium text-aksent">
              Alt er gratis i pilotperioden
            </p>
          ) : (
            <>
              <p className="mb-4 text-[13px] text-dempet">{PLUSS_PRIS}</p>
              <Primærknapp>Oppgrader</Primærknapp>
            </>
          )}
        </div>
      </Kort>
    </Skjermramme>
  );
}
