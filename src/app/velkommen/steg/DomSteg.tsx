/**
 * Steg 3 — rødbrun paragrafboks («§» + «Gebyrsjekk»), samme token-par som
 * DomMini (border-dom-rod/40 + bg-dom-rod-bg). Tekst ordrett fra mockup.
 */
export function DomSteg() {
  return (
    <>
      <div className="flex size-[180px] items-center justify-center">
        <div className="flex size-[150px] flex-col items-center justify-center gap-0.5 rounded-[20px] border-[1.5px] border-dom-rod/40 bg-dom-rod-bg">
          <span className="font-serif text-[52px] font-semibold leading-none text-dom-rod">
            §
          </span>
          <span className="font-serif text-[22px] font-semibold text-dom-rod">
            Gebyrsjekk
          </span>
        </div>
      </div>
      <h1 className="mt-[26px] font-serif text-[25px] font-medium leading-[1.25] tracking-[-0.01em] text-blekk">
        Vi sjekker om
        <br />
        <em className="italic text-aksent-dyp">gebyrene stemmer</em>
      </h1>
      <p className="mt-2.5 max-w-[270px] text-sm leading-[1.6] text-dempet">
        Alle beløp kontrolleres automatisk mot lovens maksimalsatser. Finner
        vi noe, hjelper vi deg å si ifra.
      </p>
    </>
  );
}
