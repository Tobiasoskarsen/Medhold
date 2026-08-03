import { Skjermramme, Skjelett } from "@/components/ui";

// Satser-skjelett: tittel + tekst + satskort + tabellskjelett.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-5">
      <Skjelett className="h-4 w-16" />
      <Skjelett className="mt-4 h-6 w-52" />
      <Skjelett className="mt-1.5 h-4 w-full" />
      <Skjelett className="mt-5 h-[190px] w-full rounded-2xl" />
      <Skjelett className="mt-5 h-[220px] w-full rounded-2xl" />
    </Skjermramme>
  );
}
