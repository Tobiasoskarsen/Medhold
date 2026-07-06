import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export default function Bunntekst() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-6 text-center text-xs text-slate-400">
        <p>
          {APP_NAME} er et verktøy for å holde oversikt — ikke en offentlig
          tjeneste og ikke profesjonell rådgivning. Bekreft alltid viktige ting
          med rett instans.
        </p>
        <p className="mt-2">
          <Link href="/personvern" className="underline hover:text-slate-600">
            Personvern
          </Link>
          <span className="mx-2">·</span>
          <Link href="/konto" className="underline hover:text-slate-600">
            Min konto
          </Link>
        </p>
      </div>
    </footer>
  );
}
