import { Skjermramme, Skjelett } from "@/components/ui";

// Utkast-skjelett: tittel, type-valg og tekstfelt (ikke sakens skjelett).
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-5">
      <Skjelett className="mt-12 h-7 w-44" />
      <Skjelett className="mt-3 h-4 w-full" />
      <div className="mt-6 flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skjelett key={i} className="h-[60px] w-full rounded-kontroll" />
        ))}
      </div>
      <Skjelett className="mt-5 h-[130px] w-full rounded-kontroll" />
    </Skjermramme>
  );
}
