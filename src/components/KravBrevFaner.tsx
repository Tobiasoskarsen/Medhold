import { NavLenke as Link } from "@/components/NavLenke";

/**
 * Segmentert veksler mellom kravlisten og brevarkivet. Begge bor under
 * «Krav»-fanen i bunn-navigasjonen.
 */
export function KravBrevFaner({ aktiv }: { aktiv: "krav" | "brev" }) {
  const faner = [
    { key: "krav", href: "/krav", etikett: "Krav" },
    { key: "brev", href: "/brev", etikett: "Brev" },
  ] as const;

  return (
    <div
      role="tablist"
      className="inline-flex rounded-[10px] border-[0.5px] border-strek bg-flate p-0.5"
    >
      {faner.map((f) => {
        const er = aktiv === f.key;
        return (
          <Link
            key={f.key}
            href={f.href}
            role="tab"
            aria-selected={er}
            className={`trykk rounded-lg px-5 py-1.5 text-[13px] font-medium transition ${
              er ? "bg-aksent text-white" : "text-dempet hover:text-blekk"
            }`}
          >
            {f.etikett}
          </Link>
        );
      })}
    </div>
  );
}
