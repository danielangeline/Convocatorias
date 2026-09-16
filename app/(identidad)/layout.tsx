import Link from "next/link";
import { Building2 } from "lucide-react";

export default function IdentidadLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-primary-50/50">
      <header className="px-4 py-5 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-800 text-white">
            <Building2 className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="font-display text-[15px] font-bold leading-none text-ink">
            Gestión de
            <br />
            Convocatorias
          </span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
