import { cn } from "@/lib/utils";

/** Marca: cuadro de 34 px en `--pri` con el anillo y el punto del diseño. */
export function LogoMarca({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid h-[34px] w-[34px] flex-none place-items-center overflow-hidden rounded-[10px] bg-pri text-on-pri",
        className
      )}
    >
      <span className="absolute left-1.5 top-1.5 h-[22px] w-[22px] rounded-full border-[3px] border-current opacity-95" />
      <span className="absolute right-[5px] top-[5px] h-[9px] w-[9px] rounded-full bg-current" />
    </span>
  );
}

/** Marca con el nombre y, opcionalmente, el portal debajo. */
export function Logo({ subtitulo }: { subtitulo?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMarca />
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold leading-[1.1] tracking-[-0.01em] text-ink">Convocatorias</span>
        {subtitulo && <span className="mt-[3px] block text-[11.5px] text-ink-3">{subtitulo}</span>}
      </span>
    </span>
  );
}
