/**
 * Parte pura de las sugerencias (CU-10 · docs/05 §9.6): los cinco criterios y
 * lo que se muestra sin coincidencias (CU-10 2a). Sin importaciones, para que
 * `scripts/prueba-sugerencias.mjs` la pruebe directamente: por HTTP no se puede
 * provocar "ninguna coincidencia" mientras el catálogo real tenga una
 * convocatoria nacional vigente.
 */

export type ClaveCriterio = "tipo_proyecto" | "sector" | "tipo_entidad" | "monto" | "ubicacion";

export const CRITERIOS: { clave: ClaveCriterio; etiqueta: string }[] = [
  { clave: "tipo_proyecto", etiqueta: "Tipo de proyecto" },
  { clave: "sector", etiqueta: "Sector" },
  { clave: "tipo_entidad", etiqueta: "Tipo de entidad" },
  { clave: "monto", etiqueta: "Monto dentro del rango" },
  { clave: "ubicacion", etiqueta: "Ubicación" },
];

/** Cuántas vigentes cercanas se muestran cuando ninguna coincide (CU-10 2a). */
export const MAXIMO_CERCANAS = 5;

/** Criterios que el proyecto no puede cumplir porque le falta el dato, en el orden de CRITERIOS. */
export function datosFaltantes(p: {
  tiposDeCategoria: ReadonlySet<string>;
  montoBuscado: number | null;
  departamento: string | null;
}): ClaveCriterio[] {
  return CRITERIOS.map((c) => c.clave).filter((clave) => {
    if (clave === "monto") return p.montoBuscado == null;
    if (clave === "ubicacion") return !p.departamento;
    return !p.tiposDeCategoria.has(clave);
  });
}

/**
 * Las que coinciden en algo son las sugerencias. Si ninguna coincide (CU-10 2a),
 * no hay sugerencias y se devuelven las primeras vigentes como "cercanas",
 * en el orden en que llegan (el de `sugerencias_proyecto`: cierran antes).
 */
export function separarSugerencias<T extends { coincidencias: number }>(
  filas: readonly T[]
): { sugerencias: T[]; cercanas: T[] } {
  const sugerencias = filas.filter((f) => f.coincidencias > 0);
  return sugerencias.length > 0
    ? { sugerencias, cercanas: [] }
    : { sugerencias: [], cercanas: filas.slice(0, MAXIMO_CERCANAS) };
}
