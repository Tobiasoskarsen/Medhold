"use client";

import { FeilVisning } from "@/components/FeilVisning";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FeilVisning
      tittel="Noe gikk galt"
      tekst="Det oppstod en feil vi ikke fikk løst automatisk. Prøv igjen, eller gå tilbake til forsiden."
      primaer={{ tekst: "Prøv igjen", onClick: reset }}
      sekundaer={{ tekst: "Til forsiden", href: "/" }}
      detalj={process.env.NODE_ENV !== "production" ? error.message : undefined}
    />
  );
}
