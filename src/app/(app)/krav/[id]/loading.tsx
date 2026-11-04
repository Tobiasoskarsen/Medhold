import { Skjermramme, Skjelett } from "@/components/ui";

// Krav-detalj-skjelett: navn, beløp og status, neste handling, frist og funn.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-5">
      <Skjelett className="mt-12 h-6 w-40" />
      <Skjelett className="mt-3 h-12 w-44" />
      <Skjelett className="mt-3 h-6 w-32 rounded-full" />
      <Skjelett className="mt-seksjon h-5 w-36" />
      <div className="mt-gruppe flex flex-col gap-2">
        {[0, 1].map((i) => (
          <Skjelett key={i} className="h-[68px] w-full rounded-kort" />
        ))}
      </div>
      <Skjelett className="mt-seksjon h-5 w-28" />
      <Skjelett className="mt-gruppe h-[62px] w-full rounded-kort" />
    </Skjermramme>
  );
}
