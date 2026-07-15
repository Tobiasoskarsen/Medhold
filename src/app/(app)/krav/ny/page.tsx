import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { Skjermramme } from "@/components/ui";
import { NyttKravSkjema } from "./NyttKravSkjema";

export default function NyttKravPage() {
  return (
    <Skjermramme className="pt-5">
      <Link
        href="/krav"
        className="mb-3.5 flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Krav
      </Link>

      <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
        Nytt krav
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
        Opprett et krav uten brev. Du kan legge til brev og gebyrsjekk senere.
      </p>

      <NyttKravSkjema />

      <div className="mt-6 border-t-[0.5px] border-strek pt-5">
        <p className="text-[13px] text-dempet">
          Har du selve brevet? Legg det til, så leser Medhold det og oppretter
          kravet automatisk — med gebyrsjekk.
        </p>
        <Link
          href="/legg-til-brev"
          className="trykk mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-aksent/40 bg-flate px-3 py-3 text-sm font-medium text-aksent transition hover:bg-aksent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
        >
          <Plus className="size-4" aria-hidden />
          Legg til brev i stedet
        </Link>
      </div>
    </Skjermramme>
  );
}
