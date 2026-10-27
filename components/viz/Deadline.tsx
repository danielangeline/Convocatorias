import { Clock } from "lucide-react";
import { TONO_CLASE } from "./tonos";

/** Caja de 46 px con los días restantes: amber < 15, rose < 10. */
export function DeadlineTile({ dias }: { dias: number }) {
  const tono = dias < 10 ? "rose" : dias < 15 ? "amber" : "neutro";
  return (
    <div
      className={`flex h-[46px] w-[46px] flex-none flex-col items-center justify-center gap-0.5 rounded-xl ${TONO_CLASE[tono]}`}
      aria-label={`Cierra en ${dias} días`}
    >
      <span className="font-tabular text-[17px] font-semibold leading-none">{dias}</span>
      <span className="text-[9.5px] font-bold uppercase leading-none tracking-[.06em]">días</span>
    </div>
  );
}

/** Chip amber con reloj: "N días". */
export function DeadlineChip({ dias }: { dias: number }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-lg px-[9px] py-[5px] text-xs font-bold ${TONO_CLASE.amber}`}
    >
      <Clock className="h-[13px] w-[13px]" aria-hidden />
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}
