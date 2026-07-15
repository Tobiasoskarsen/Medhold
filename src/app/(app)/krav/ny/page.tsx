import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    </Skjermramme>
  );
}
