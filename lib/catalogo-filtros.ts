import type { Categoria, Convocatoria, TipoDocumento } from "@/lib/types";
import { REGIONES, nombreDepartamento, textoCobertura, type ClaveRegion } from "@/lib/departamentos";
import { hoyColombia } from "@/lib/fechas";

/**
 * Filtros combinables del catálogo (RF-12, CU-07), orden (RF-94) y chips
 * sugeridos (RF-43). Código puro: lo usan la pantalla, para filtrar al instante
 * sobre lo que el servidor ya autorizó, y `GET /api/convocatorias`, con los
 * mismos criterios. Todo se deriva de los datos de la ficha: no hay columnas
 * propias de los filtros.
 *
 * Regla de combinación: dentro de un mismo filtro de varias opciones (tipo de
 * proyecto, sector, quién puede postular, tipo de documento) basta una; entre
 * filtros distintos se exigen todos.
 */

export const DIAS_CIERRE = [7, 15, 30, 60, 90] as const;
export const TIPOS_DOCUMENTO: ReadonlyArray<{ clave: TipoDocumento; nombre: string }> = [
  { clave: "TDR", nombre: "Términos de referencia" },
  { clave: "terminos", nombre: "Términos y condiciones" },
  { clave: "anexo", nombre: "Anexos" },
  { clave: "formato", nombre: "Formatos" },
];

export type Alcance = "nacional" | "territorial";
export type FiltroMonto = "con" | "sin";

export const ORDENES = [
  { clave: "cierre_asc", nombre: "Cierre más próximo" },
  { clave: "cierre_desc", nombre: "Cierre más lejano" },
  { clave: "monto_desc", nombre: "Mayor monto de apoyo" },
  { clave: "monto_asc", nombre: "Menor monto de apoyo" },
  { clave: "apertura_desc", nombre: "Apertura más reciente" },
  { clave: "nombre", nombre: "Nombre (A-Z)" },
  { clave: "entidad", nombre: "Entidad convocante (A-Z)" },
  { clave: "requisitos_asc", nombre: "Menos requisitos" },
] as const;
export type ClaveOrden = (typeof ORDENES)[number]["clave"];

export interface FiltrosCatalogo {
  q?: string;
  tipoProyecto?: string[];
  sector?: string[];
  /** Quién puede postular: categorías de tipo de entidad. */
  tipoEntidad?: string[];
  entidad?: string;
  /** Código DANE (RN-34): deja las de ese departamento y las de cobertura nacional. */
  departamento?: string;
  /** Región natural: deja las que cubren algún departamento de ella y las nacionales. */
  region?: ClaveRegion | "";
  /** Solo las de cobertura nacional, o solo las que listan departamentos. */
  alcance?: Alcance | "";
  /** Pesos: deja las convocatorias cuyo monto mínimo no pasa de aquí. */
  montoHasta?: number | null;
  /** Pesos: deja las que informan un monto máximo de al menos esto. */
  montoDesde?: number | null;
  /** Con algún monto informado, o sin ninguno (apoyo no monetario o no informado). */
  monto?: FiltroMonto | "";
  /** AAAA-MM-DD: deja las que cierran ese día o antes. */
  cierraAntesDe?: string;
  /** AAAA-MM-DD: deja las que cierran ese día o después. */
  cierraDesde?: string;
  /** Cierran de hoy a hoy + N días (hora de Colombia). */
  cierraEnDias?: number | null;
  /** Año del cierre, cuatro cifras. */
  anioCierre?: number | null;
  /** AAAA-MM-DD: deja las que abren ese día o después; sin apertura informada no entran. */
  abreDesde?: string;
  /** Al menos un documento adjunto de alguno de estos tipos. */
  tipoDoc?: TipoDocumento[];
  /** Tiene algún requisito obligatorio de tipo documento. */
  exigeDocumentos?: boolean;
  /** A lo sumo N requisitos. */
  maxRequisitos?: number | null;
}

/** Minúsculas y sin tildes: "Innovación" encuentra "innovacion". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const sumarDias = (fecha: string, dias: number): string => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const departamentosDe = (clave: string): readonly string[] => REGIONES.find((r) => r.clave === clave)?.departamentos ?? [];

/** `hoy` es AAAA-MM-DD en Colombia; se inyecta para poder probarlo. */
export function filtrarCatalogo(lista: Convocatoria[], f: FiltrosCatalogo, hoy: string = hoyColombia()): Convocatoria[] {
  const q = normalizar(f.q ?? "");
  const palabras = q ? q.split(/\s+/) : [];
  const deRegion = f.region ? departamentosDe(f.region) : null;
  const limiteCierre = f.cierraEnDias != null ? sumarDias(hoy, f.cierraEnDias) : null;
  return lista.filter((c) => {
    if (palabras.length) {
      const texto = normalizar(`${c.nombre} ${c.entidadConvocante} ${c.descripcion} ${c.ubicacion} ${textoCobertura(c)}`);
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    if (f.tipoProyecto?.length && !f.tipoProyecto.some((id) => c.categorias.includes(id))) return false;
    if (f.sector?.length && !f.sector.some((id) => c.categorias.includes(id))) return false;
    if (f.tipoEntidad?.length && !f.tipoEntidad.some((id) => c.categorias.includes(id))) return false;
    if (f.entidad && c.entidadConvocante !== f.entidad) return false;
    if (f.departamento && !c.coberturaNacional && !c.departamentos.includes(f.departamento)) return false;
    if (deRegion && !c.coberturaNacional && !c.departamentos.some((d) => deRegion.includes(d))) return false;
    if (f.alcance === "nacional" && !c.coberturaNacional) return false;
    if (f.alcance === "territorial" && c.coberturaNacional) return false;
    // Sin monto mínimo informado no hay umbral que la excluya.
    if (f.montoHasta != null && c.montoMin != null && c.montoMin > f.montoHasta) return false;
    // "Apoya con al menos X": sin monto máximo informado no puede afirmarlo.
    if (f.montoDesde != null && (c.montoMax == null || c.montoMax < f.montoDesde)) return false;
    const conMonto = c.montoMin != null || c.montoMax != null;
    if (f.monto === "con" && !conMonto) return false;
    if (f.monto === "sin" && conMonto) return false;
    if (f.cierraAntesDe && c.fechaCierre > f.cierraAntesDe) return false;
    if (f.cierraDesde && c.fechaCierre < f.cierraDesde) return false;
    if (limiteCierre && (c.fechaCierre < hoy || c.fechaCierre > limiteCierre)) return false;
    if (f.anioCierre != null && !c.fechaCierre.startsWith(String(f.anioCierre))) return false;
    if (f.abreDesde && (!c.fechaApertura || c.fechaApertura < f.abreDesde)) return false;
    if (f.tipoDoc?.length && !c.documentos.some((d) => f.tipoDoc!.includes(d.tipo))) return false;
    if (f.exigeDocumentos && !c.requisitos.some((r) => r.tipo === "documento" && r.obligatorio)) return false;
    if (f.maxRequisitos != null && c.requisitos.length > f.maxRequisitos) return false;
    return true;
  });
}

/**
 * RF-94 · Sin orden elegido la pantalla conserva el del servidor. Las vigentes siempre antes que las cerradas (RN-02); dentro de cada
 * grupo rige el orden elegido, y las que no informan el dato van al final.
 */
export function ordenarCatalogo(lista: Convocatoria[], orden: ClaveOrden = "cierre_asc"): Convocatoria[] {
  const texto = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });
  // `null` va al final sea cual sea el sentido.
  const numero = (a: number | null, b: number | null, desc: boolean) =>
    a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : desc ? b - a : a - b;
  const comparar = (a: Convocatoria, b: Convocatoria): number => {
    switch (orden) {
      case "cierre_asc": return a.fechaCierre.localeCompare(b.fechaCierre);
      case "cierre_desc": return b.fechaCierre.localeCompare(a.fechaCierre);
      case "monto_desc": return numero(a.montoMax ?? a.montoMin, b.montoMax ?? b.montoMin, true);
      case "monto_asc": return numero(a.montoMin ?? a.montoMax, b.montoMin ?? b.montoMax, false);
      case "apertura_desc":
        return a.fechaApertura == null && b.fechaApertura == null ? 0 : a.fechaApertura == null ? 1 : b.fechaApertura == null ? -1 : b.fechaApertura.localeCompare(a.fechaApertura);
      case "nombre": return texto(a.nombre, b.nombre);
      case "entidad": return texto(a.entidadConvocante, b.entidadConvocante);
      case "requisitos_asc": return a.requisitos.length - b.requisitos.length;
    }
  };
  const cerrada = (c: Convocatoria) => (c.estado === "cerrada" ? 1 : 0);
  // Desempate estable: cierre más próximo y luego nombre.
  return [...lista].sort((a, b) => cerrada(a) - cerrada(b) || comparar(a, b) || a.fechaCierre.localeCompare(b.fechaCierre) || texto(a.nombre, b.nombre));
}

export const esClaveOrden = (v: string): v is ClaveOrden => ORDENES.some((o) => o.clave === v);

/** Cuántas convocatorias de `lista` llevan cada categoría (RF-95, conteo por opción). */
export function conteoPorCategoria(lista: Convocatoria[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of lista) for (const id of new Set(c.categorias)) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

export interface ChipSugerido {
  etiqueta: string;
  filtros: FiltrosCatalogo;
}

/**
 * RF-43 · Se derivan de lo vigente, así que ninguno lleva a un resultado vacío:
 * las categorías de tipo de proyecto y sector más frecuentes y, si hay espacio,
 * los departamentos más frecuentes (RN-34).
 */
export function chipsSugeridos(lista: Convocatoria[], categorias: Categoria[], maximo = 5): ChipSugerido[] {
  const frecuencia = conteoPorCategoria(lista);

  const deCategorias = categorias
    .filter((cat) => (cat.tipo === "tipo_proyecto" || cat.tipo === "sector") && frecuencia.has(cat.id))
    .sort((a, b) => frecuencia.get(b.id)! - frecuencia.get(a.id)! || a.nombre.localeCompare(b.nombre, "es"))
    .map((cat): ChipSugerido => ({
      etiqueta: cat.nombre,
      filtros: cat.tipo === "tipo_proyecto" ? { tipoProyecto: [cat.id] } : { sector: [cat.id] },
    }));

  const departamentos = new Map<string, number>();
  for (const c of lista) for (const d of c.departamentos) departamentos.set(d, (departamentos.get(d) ?? 0) + 1);
  const deUbicaciones = [...departamentos.entries()]
    .map(([codigo, n]) => ({ codigo, n, nombre: nombreDepartamento(codigo) }))
    .filter((d) => d.nombre)
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"))
    .map((d): ChipSugerido => ({ etiqueta: d.nombre, filtros: { departamento: d.codigo } }));

  return [...deCategorias, ...deUbicaciones].slice(0, maximo);
}
