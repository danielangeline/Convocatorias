import type { Categoria, Convocatoria } from "@/lib/types";
import { nombreDepartamento, textoCobertura } from "@/lib/departamentos";

/**
 * Filtros combinables del catálogo (RF-12, CU-07) y chips sugeridos (RF-43).
 * Código puro: lo usan la pantalla, para filtrar al instante sobre lo que el
 * servidor ya autorizó, y `GET /api/convocatorias`, con los mismos criterios.
 */

export interface FiltrosCatalogo {
  q?: string;
  tipoProyecto?: string[];
  sector?: string[];
  entidad?: string;
  /** Código DANE (RN-34): deja las de ese departamento y las de cobertura nacional. */
  departamento?: string;
  /** Pesos: deja las convocatorias cuyo monto mínimo no pasa de aquí. */
  montoHasta?: number | null;
  /** AAAA-MM-DD: deja las que cierran ese día o antes. */
  cierraAntesDe?: string;
}

/** Minúsculas y sin tildes: "Innovación" encuentra "innovacion". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function filtrarCatalogo(lista: Convocatoria[], f: FiltrosCatalogo): Convocatoria[] {
  const q = normalizar(f.q ?? "");
  const palabras = q ? q.split(/\s+/) : [];
  return lista.filter((c) => {
    if (palabras.length) {
      const texto = normalizar(`${c.nombre} ${c.entidadConvocante} ${c.descripcion} ${c.ubicacion} ${textoCobertura(c)}`);
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    if (f.tipoProyecto?.length && !f.tipoProyecto.some((id) => c.categorias.includes(id))) return false;
    if (f.sector?.length && !f.sector.some((id) => c.categorias.includes(id))) return false;
    if (f.entidad && c.entidadConvocante !== f.entidad) return false;
    if (f.departamento && !c.coberturaNacional && !c.departamentos.includes(f.departamento)) return false;
    // Sin monto mínimo informado no hay umbral que la excluya.
    if (f.montoHasta != null && c.montoMin != null && c.montoMin > f.montoHasta) return false;
    if (f.cierraAntesDe && c.fechaCierre > f.cierraAntesDe) return false;
    return true;
  });
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
  const frecuencia = new Map<string, number>();
  for (const c of lista) for (const id of c.categorias) frecuencia.set(id, (frecuencia.get(id) ?? 0) + 1);

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
