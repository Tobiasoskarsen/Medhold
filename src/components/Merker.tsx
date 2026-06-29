import { Heart, Wallet, Users, House, Folder, type LucideIcon } from "lucide-react";
import {
  KATEGORI_ETIKETT,
  KATEGORI_STIL,
  STATUS_ETIKETT,
  STATUS_STIL,
  type SakKategori,
  type SakStatus,
} from "@/lib/types";

const KATEGORI_IKON: Record<SakKategori, LucideIcon> = {
  helse: Heart,
  okonomi: Wallet,
  familie: Users,
  bolig: House,
  annet: Folder,
};

function Merke({
  tekst,
  stil,
  ikon: Ikon,
}: {
  tekst: string;
  stil: string;
  ikon?: LucideIcon;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${stil}`}
    >
      {Ikon && <Ikon className="size-3" aria-hidden />}
      {tekst}
    </span>
  );
}

export function StatusMerke({ status }: { status: SakStatus }) {
  return <Merke tekst={STATUS_ETIKETT[status]} stil={STATUS_STIL[status]} />;
}

export function KategoriMerke({ kategori }: { kategori: SakKategori }) {
  return (
    <Merke
      tekst={KATEGORI_ETIKETT[kategori]}
      stil={KATEGORI_STIL[kategori]}
      ikon={KATEGORI_IKON[kategori]}
    />
  );
}

// Farget ikon-«badge» til kort og lister.
export function KategoriIkon({ kategori }: { kategori: SakKategori }) {
  const Ikon = KATEGORI_IKON[kategori];
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${KATEGORI_STIL[kategori]}`}
    >
      <Ikon className="size-[18px]" aria-hidden />
    </span>
  );
}
