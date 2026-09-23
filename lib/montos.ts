/**
 * Montos en pesos colombianos escritos por una persona (CU-02 2b, RF-05).
 *
 * Se aceptan pesos enteros con un punto cada tres cifras (`1.000.000`) o sin
 * puntos (`1000000`), con `$` y espacios opcionales. Todo lo demás se rechaza
 * con un mensaje que dice cómo escribirlo: nunca se interpreta a medias. Antes
 * se usaba `Number()`, que convertía `1.000000` en 1 peso sin avisar (sesión 016).
 *
 * Lo usan el servidor, que es quien decide, y el editor, que solo lo muestra.
 */

export const MONTO_MAXIMO = 1e15;

export type LecturaMonto = { ok: true; valor: number | null } | { ok: false; error: string };

export function leerMontoCOP(entrada: unknown): LecturaMonto {
  if (entrada === null || entrada === undefined) return { ok: true, valor: null };

  if (typeof entrada === "number") {
    if (!Number.isInteger(entrada) || entrada < 0) {
      return { ok: false, error: "debe ser un número entero de pesos, sin centavos." };
    }
    return entrada > MONTO_MAXIMO ? { ok: false, error: "es demasiado grande." } : { ok: true, valor: entrada };
  }
  if (typeof entrada !== "string") return { ok: false, error: "no es un número." };

  const limpio = entrada.replace(/\s/g, "").replace(/^\$/, "");
  if (limpio === "") return { ok: true, valor: null };

  if (limpio.includes(",")) return { ok: false, error: "va en pesos enteros, sin centavos ni comas." };
  if (limpio.startsWith("-")) return { ok: false, error: "no puede ser negativo." };

  let digitos: string;
  if (/^\d+$/.test(limpio)) digitos = limpio;
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) digitos = limpio.replace(/\./g, "");
  else if (/^[\d.]+$/.test(limpio)) {
    return { ok: false, error: "debe llevar un punto cada tres cifras (1.000.000) o ninguno (1000000)." };
  } else return { ok: false, error: "solo admite cifras y puntos de miles, por ejemplo 1.000.000." };

  const valor = Number(digitos);
  return valor > MONTO_MAXIMO ? { ok: false, error: "es demasiado grande." } : { ok: true, valor };
}

/** `1000000` → `"1.000.000"`. Agrupa siempre, también los números de cuatro cifras. */
export function formatearMontoCOP(valor: number | null): string {
  return valor === null ? "" : String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
