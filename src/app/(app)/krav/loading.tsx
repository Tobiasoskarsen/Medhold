import { Skjermramme, Skjelett } from "@/components/ui";

// Krav-liste-skjelett: tittel + tre kort.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-6">
      <Skjelett className="h-6 w-24" />
      <div className="mt-4 flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skjelett key={i} className="h-[72px] w-full rounded-2xl" />
        ))}
      </div>
    </Skjermramme>
  );
}
