import { APP_NAME } from "@/lib/brand";

/**
 * Steg 1 — brevkort med rød varsellinje + lupe (SVG/CSS, ingen bilder).
 * Tekst ordrett fra mockup (medhold_ny_onboarding_mockup.html).
 */
export function BrevSteg() {
  return (
    <>
      <div className="relative flex size-[180px] items-center justify-center">
        <div className="flex h-[150px] w-[118px] flex-col gap-2 rounded-2xl border-[1.5px] border-strek bg-flate p-4 shadow-[0_10px_24px_rgba(28,43,51,0.10)]">
          <span className="h-[7px] w-[80%] rounded-full bg-strek" />
          <span className="h-[7px] w-[55%] rounded-full bg-strek" />
          <span className="h-[7px] w-[70%] rounded-full bg-dom-rod opacity-80" />
          <span className="h-[7px] w-[60%] rounded-full bg-strek" />
        </div>
        <div className="absolute bottom-2 right-0.5 size-[54px] rounded-full border-[5px] border-aksent bg-aksent/[0.06]">
          <span className="absolute -bottom-[11px] -right-[2px] h-[5px] w-5 rotate-45 rounded-[3px] bg-aksent" />
        </div>
      </div>
      <h1 className="mt-[26px] font-serif text-[25px] font-medium leading-[1.25] tracking-[-0.01em] text-blekk">
        Fått et brev
        <br />
        du gruer deg for?
      </h1>
      <p className="mt-2.5 max-w-[270px] text-sm leading-[1.6] text-dempet">
        Fotografer det, lim inn teksten, eller last opp en fil. {APP_NAME}{" "}
        leser det for deg — på under et minutt.
      </p>
    </>
  );
}
