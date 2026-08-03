import { FeilVisning } from "@/components/FeilVisning";

export default function NotFound() {
  return (
    <FeilVisning
      tittel="Fant ikke siden"
      tekst="Siden du lette etter finnes ikke, eller er flyttet."
      primaer={{ tekst: "Til forsiden", href: "/" }}
    />
  );
}
