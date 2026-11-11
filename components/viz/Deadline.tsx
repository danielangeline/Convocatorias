import { Clock } from "lucide-react";
import { TONO_CLASE } from "./tonos";

/** Caja con los días restantes: rose < 10, amber 10 a 14, neutro desde 15. */
export function DeadlineTile({ dias }: { dias: number }) {
  const tono = dias < 10 ? "rose" : dias < 15 ? "amber" : "neutro";
  return (
    <div
      className={`flex h-[46px] w-[46px] flex-none flex-col items-center justify-center gap-0.5 rounded-[4px] ${TONO_CLASE[tono]}`}
      aria-label={`Cierra en ${dias} días`}
    >
      <span className="font-tabular text-[17px] font-semibold leading-none">{dias}</span>
      <span className="text-[9.5px] font-bold uppercase leading-none tracking-[.06em]">días</span>
    </div>
  );
}

/** Chip de plazo con reloj ("N días"), con el mismo color que la caja. */
export function DeadlineChip({ dias }: { dias: number }) {
  const tono = dias < 10 ? "rose" : dias < 15 ? "amber" : "neutro";
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-[4px] px-[9px] py-[5px] text-xs font-semibold ${TONO_CLASE[tono]}`}
    >
      <Clock className="h-[13px] w-[13px]" aria-hidden />
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}
