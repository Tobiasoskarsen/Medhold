import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topplinje from "@/components/Topplinje";
import Bunntekst from "@/components/Bunntekst";
import SlettKonto from "@/components/SlettKonto";
import VarselInnstilling from "@/components/VarselInnstilling";

export const metadata = {
  title: "Min konto — Klarvei",
};

export default async function KontoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Topplinje epost={user.email} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <Link
            href="/saker"
            className="text-sm text-slate-500 transition hover:text-slate-800"
          >
            ← Tilbake til saker
          </Link>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            Min konto
          </h1>

          <dl className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm">
            <dt className="text-slate-400">Innlogget som</dt>
            <dd className="mt-0.5 text-slate-800">{user.email}</dd>
          </dl>

          <div className="mt-6">
            <VarselInnstilling
              pa={user.user_metadata?.varsler_paa !== false}
            />
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Les hvordan dataene dine behandles i{" "}
            <Link
              href="/personvern"
              className="underline hover:text-slate-900"
            >
              personvernerklæringen
            </Link>
            .
          </p>

          <div className="mt-8">
            <SlettKonto />
          </div>
        </div>
      </main>
      <Bunntekst />
    </div>
  );
}
