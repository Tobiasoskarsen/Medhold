import { Skjermramme, Skjelett } from "@/components/ui";

// Veier ut-skjelett: eyebrow + tittel + tekst + tre kortskjeletter.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-5">
      <Skjelett className="h-4 w-16" />
      <Skjelett className="mt-4 h-3 w-40" />
      <Skjelett className="mt-1.5 h-7 w-44" />
      <Skjelett className="mt-2.5 h-4 w-full" />
      <div className="mt-5 flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skjelett key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </Skjermramme>
  );
}
