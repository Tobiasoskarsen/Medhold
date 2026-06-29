import Link from "next/link";
import { LogOut } from "lucide-react";
import Logo from "@/components/Logo";

export default function Topplinje({ epost }: { epost?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-3.5">
        <Link href="/saker" className="transition hover:opacity-80">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          {epost && (
            <Link
              href="/konto"
              className="hidden text-xs text-slate-400 transition hover:text-slate-700 sm:inline"
            >
              {epost}
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <LogOut className="size-4" aria-hidden />
              Logg ut
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
