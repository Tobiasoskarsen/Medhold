import { Skjermramme, Skjelett } from "@/components/ui";

// Nytt krav-skjelett: tittel + ett stort skjema-skjelett.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-5">
      <Skjelett className="h-4 w-16" />
      <Skjelett className="mt-4 h-6 w-32" />
      <Skjelett className="mt-1.5 h-4 w-64" />
      <Skjelett className="mt-6 h-[280px] w-full rounded-2xl" />
    </Skjermramme>
  );
}
