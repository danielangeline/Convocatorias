import "server-only";
import { DEPARTAMENTOS, esCodigoDepartamento } from "@/lib/departamentos";
import type { Categoria, PropuestaProyecto } from "@/lib/types";

/**
 * Estructurar un proyecto a partir de la explicación de la empresa (CU-43,
 * RF-96, RN-37). La IA **propone** el formulario de CU-09; la empresa lo revisa
 * antes de guardar. El departamento solo puede salir de la lista oficial
 * (RN-34) y las categorías de las activas, con claves cortas que el servidor
 * traduce a sus ids: un id que el modelo no recibió se descarta.
 *
 * Las instrucciones son un dato: la versión activa de `plantillas_proyecto`,
 * que el administrador edita desde el panel (RF-99, docs/05 §9.30). Lo que la
 * instrucción no puede cambiar vive aquí: el esquema estricto de la respuesta,
 * las listas que se entregan y la validación de `leerPropuesta`.
 */

const TEXTO = { type: "string" } as const;
const TEXTO_O_NULO = { type: ["string", "null"] } as const;
const NUMERO_O_NULO = { type: ["number", "null"] } as const;
const LISTA = { type: "array", items: { type: "string" } } as const;

export const ESQUEMA_PROPUESTA = {
  type: "object",
  additionalProperties: false,
  required: [
    "nombre",
    "descripcion",
    "montoBuscado",
    "departamento",
    "ubicacion",
    "categorias",
    "problema",
    "objetivoGeneral",
    "objetivosEspecificos",
    "poblacionBeneficiaria",
    "actividades",
    "resultadosEsperados",
    "duracionMeses",
    "presupuestoEstimado",
    "experienciaEmpresa",
    "faltantes",
  ],
  properties: {
    nombre: TEXTO,
    descripcion: TEXTO,
    montoBuscado: NUMERO_O_NULO,
    departamento: TEXTO_O_NULO,
    ubicacion: TEXTO,
    categorias: LISTA,
    problema: TEXTO,
    objetivoGeneral: TEXTO,
    objetivosEspecificos: LISTA,
    poblacionBeneficiaria: TEXTO,
    actividades: TEXTO,
    resultadosEsperados: TEXTO,
    duracionMeses: NUMERO_O_NULO,
    presupuestoEstimado: NUMERO_O_NULO,
    experienciaEmpresa: TEXTO,
    faltantes: LISTA,
  },
} as const;

const NOMBRE_TIPO: Record<Categoria["tipo"], string> = {
  tipo_proyecto: "Tipo de proyecto",
  sector: "Sector",
  tipo_entidad: "Tipo de entidad que postula",
};

/** El mensaje para la IA y el mapa de claves cortas a ids de categoría. */
export function contextoEstructuracion(
  explicacion: string,
  categorias: Pick<Categoria, "id" | "tipo" | "nombre">[]
): { mensaje: string; claves: Map<string, string> } {
  const claves = new Map<string, string>();
  const lineas = categorias.map((c, i) => {
    const clave = `c${i + 1}`;
    claves.set(clave, c.id);
    return `${clave}: ${NOMBRE_TIPO[c.tipo] ?? c.tipo} · ${c.nombre}`;
  });
  const departamentos = DEPARTAMENTOS.map((d) => `${d.codigo}: ${d.nombre}`).join("\n");
  // La explicación va al final y delimitada: es un dato, no una instrucción (regla 11).
  const mensaje = `<departamentos>\n${departamentos}\n</departamentos>\n\n<categorias>\n${lineas.join("\n") || "(ninguna)"}\n</categorias>\n\n<explicacion_de_la_empresa>\n${explicacion}\n</explicacion_de_la_empresa>`;
  return { mensaje, claves };
}

const recortar = (v: unknown, maximo: number) => (typeof v === "string" ? v.trim().slice(0, maximo) : "");

function montoValido(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 1e15) return null;
  return Math.round(v);
}

/**
 * Valida la respuesta del modelo con los topes de `guardar_proyecto` y descarta
 * lo que no esté en las listas. Null si la forma no es la esperada.
 */
export function leerPropuesta(json: unknown, claves: Map<string, string>): PropuestaProyecto | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;
  if (typeof r.nombre !== "string" || !Array.isArray(r.categorias) || !Array.isArray(r.objetivosEspecificos)) return null;

  const departamento = typeof r.departamento === "string" && esCodigoDepartamento(r.departamento.trim()) ? r.departamento.trim() : null;
  const categorias = [
    ...new Set(r.categorias.map((c) => (typeof c === "string" ? claves.get(c.trim()) : undefined)).filter((c): c is string => !!c)),
  ];
  const duracion = typeof r.duracionMeses === "number" && Number.isFinite(r.duracionMeses) ? Math.round(r.duracionMeses) : null;

  return {
    nombre: recortar(r.nombre, 200) || "Proyecto sin nombre",
    descripcion: recortar(r.descripcion, 5000),
    montoBuscado: montoValido(r.montoBuscado),
    departamento,
    ubicacion: recortar(r.ubicacion, 300),
    categorias,
    problema: recortar(r.problema, 5000),
    objetivoGeneral: recortar(r.objetivoGeneral, 5000),
    objetivosEspecificos: r.objetivosEspecificos
      .map((o) => recortar(o, 1000))
      .filter(Boolean)
      .slice(0, 30),
    poblacionBeneficiaria: recortar(r.poblacionBeneficiaria, 5000),
    actividades: recortar(r.actividades, 5000),
    resultadosEsperados: recortar(r.resultadosEsperados, 5000),
    duracionMeses: duracion !== null && duracion >= 1 && duracion <= 240 ? duracion : null,
    presupuestoEstimado: montoValido(r.presupuestoEstimado),
    experienciaEmpresa: recortar(r.experienciaEmpresa, 5000),
    faltantes: Array.isArray(r.faltantes)
      ? r.faltantes
          .map((f) => recortar(f, 200))
          .filter(Boolean)
          .slice(0, 20)
      : [],
  };
}
