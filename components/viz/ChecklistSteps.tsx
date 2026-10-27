import { Check } from "lucide-react";

export interface Paso {
  etiqueta: string;
  hecho: boolean;
}

/** Pasos con caja de 20 px: rellena con check si está hecho; hechos tachados en ink-3. */
export function ChecklistSteps({ pasos }: { pasos: Paso[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {pasos.map((p) => (
        <li key={p.etiqueta} className="flex items-center gap-2.5 text-[13px]">
          <span
            className={`grid h-5 w-5 flex-none place-items-center rounded-md ${
              p.hecho ? "bg-pri text-on-pri" : "border border-line"
            }`}
          >
            {p.hecho && <Check className="h-3 w-3" strokeWidth={3} aria-label="Hecho" />}
          </span>
          <span className={p.hecho ? "text-ink-3 line-through" : "font-semibold"}>{p.etiqueta}</span>
        </li>
      ))}
    </ul>
  );
}
