"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { textoCreditos, useCreditos } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function IndicadorCreditos({ href }: { href: string }) {
  const { disponibles, suscripcion } = useCreditos();
  if (!suscripcion) return null;

  return (
    <Link
      href={href}
      className={cn(
        "hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset sm:flex",
        disponibles > 0 ? "bg-teal-50 text-teal-700 ring-teal-100" : "bg-danger-bg text-danger ring-red-200"
      )}
      title="Créditos de IA disponibles este periodo"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {textoCreditos(disponibles)}
    </Link>
  );
}
