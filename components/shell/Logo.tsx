import { cn } from "@/lib/utils";

/** Símbolo FundRadar: dos anillos concéntricos en `--pri` y un punto ámbar (el "ping"). */
export function LogoMarca({ className, tamano = 34 }: { className?: string; tamano?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 34 34"
      width={tamano}
      height={tamano}
      fill="none"
      className={cn("flex-none text-pri", className)}
    >
      <circle cx="17" cy="17" r="15" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="17" r="9" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <circle cx="17" cy="17" r="4" fill="#F2A93B" />
    </svg>
  );
}

/** Marca con el nombre y, opcionalmente, el portal debajo. */
export function Logo({ subtitulo, compacto = false }: { subtitulo?: string; compacto?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMarca tamano={compacto ? 26 : 34} />
      <span className="min-w-0">
        <span
          className={cn(
            "block font-display font-semibold leading-[1.1] text-ink",
            compacto ? "text-lg" : "text-[22px]"
          )}
        >
          Fund<span className="text-pri-text">Radar</span>
        </span>
        {subtitulo && !compacto && <span className="mt-[3px] block text-xs text-ink-3">{subtitulo}</span>}
      </span>
    </span>
  );
}
