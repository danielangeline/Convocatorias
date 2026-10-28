import { fechaColombia } from "@/lib/fechas";

/**
 * Postulaciones por semana para el tablero del panel (RF-42). Código puro, sin
 * red: lo prueba `scripts/prueba-tablero-semanas.mjs`.
 *
 * Cada postulación se cuenta por su **día en Colombia**, como el resto de la
 * plataforma (RN-02). La semana actual termina hoy (inclusive) y empieza seis
 * días antes. Una fecha posterior a hoy —desfase de reloj entre la base y el
 * servidor— cuenta en la semana actual, nunca fuera de la lista: antes de la
 * sesión 033 se calculaba con la medianoche UTC y, de 7 p. m. a medianoche en
 * Colombia, una postulación recién creada caía «en el futuro» y el panel
 * respondía 500.
 */

const DIA = 86_400_000;

const sumarDias = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA);

export function postulacionesPorSemana(
  creadas: readonly string[],
  hoy: string,
  semanas: number = 12
): { semanas: { inicio: string; total: number }[]; totalTrimestreAnterior: number } {
  const lista = Array.from({ length: semanas }, (_, i) => ({ inicio: sumarDias(hoy, 1 - 7 * (semanas - i)), total: 0 }));
  let totalTrimestreAnterior = 0;
  for (const creada of creadas) {
    const atras = Math.floor(Math.max(0, diasEntre(fechaColombia(creada), hoy)) / 7);
    if (atras < semanas) lista[semanas - 1 - atras].total += 1;
    else if (atras < semanas * 2) totalTrimestreAnterior += 1;
  }
  return { semanas: lista, totalTrimestreAnterior };
}

/** Desde cuándo pedir postulaciones: el primer instante del periodo anterior, en hora de Colombia. */
export function inicioDelPeriodo(hoy: string, semanas: number = 12): string {
  return new Date(Date.parse(`${sumarDias(hoy, 1 - 7 * semanas * 2)}T00:00:00-05:00`)).toISOString();
}
