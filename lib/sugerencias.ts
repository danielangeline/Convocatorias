import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";
import { obtenerProyecto } from "@/lib/proyectos-servidor";
import { CRITERIOS, datosFaltantes, separarSugerencias, type ClaveCriterio } from "@/lib/sugerencias-calculo";
import type { Convocatoria, Proyecto } from "@/lib/types";

/**
 * Sugerencias de un proyecto (CU-10, RF-15, RF-16 · docs/05 §9.6 · Sprint 3
 * paso 2). El cálculo lo hace `sugerencias_proyecto` en la base con la sesión de
 * la empresa: la RLS decide qué proyecto es suyo y qué convocatorias ve, y la
 * función exige suscripción vigente. Es un cruce determinístico, sin IA (RN-05).
 * Aquí se añade lo que la base no sabe decir: qué dato le falta al proyecto y,
 * sin coincidencias, las vigentes más cercanas (CU-10 2a).
 */

export type { ClaveCriterio };
/** `sin_dato`: no coincide porque el proyecto no tiene ese dato (docs/05 §9.6). */
export type EstadoCriterio = "cumple" | "no_cumple" | "sin_dato";

export interface CriterioEvaluado {
  clave: ClaveCriterio;
  etiqueta: string;
  estado: EstadoCriterio;
}

export interface Sugerencia {
  convocatoria: Convocatoria;
  criterios: CriterioEvaluado[];
  coincidencias: number;
  porcentaje: number;
}

export interface ResultadoSugerencias {
  proyecto: Proyecto;
  /** Con al menos una coincidencia, de mayor a menor porcentaje. */
  sugerencias: Sugerencia[];
  /** CU-10 2a: solo sin ninguna coincidencia; vigentes en 0 %, las que cierran antes. */
  cercanas: Sugerencia[];
  /** Convocatorias vigentes evaluadas, con o sin coincidencias. */
  evaluadas: number;
  /** Datos que le faltan al proyecto para poder comparar (CU-10 2a, RF-81). */
  faltan: { clave: ClaveCriterio; etiqueta: string }[];
}

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };

type Fila = Record<ClaveCriterio, boolean> & {
  convocatoria_id: string;
  coincidencias: number;
  porcentaje: number;
};

const RECHAZOS: Record<string, { status: number; error: string }> = {
  sin_suscripcion: {
    status: 402,
    error: "Tu suscripción está vencida. Renuévala para ver qué convocatorias coinciden con este proyecto.",
  },
  no_existe: { status: 404, error: "El proyecto no existe." },
};

export async function sugerenciasDeProyecto(id: string): Promise<Resultado<ResultadoSugerencias>> {
  const proyecto = await obtenerProyecto(id);
  if (!proyecto) return { ok: false, ...RECHAZOS.no_existe };

  const supabase = await crearClienteServidor();
  const [{ data, error }, catalogo, categorias] = await Promise.all([
    supabase.rpc("sugerencias_proyecto", { p_proyecto: id }),
    listarCatalogo(false),
    listarCategoriasActivas(),
  ]);
  if (error) {
    const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
    if (conocido) return { ok: false, ...conocido };
    console.error("Sugerencias: el cálculo falló", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos calcular las sugerencias. Intenta de nuevo." };
  }

  // Solo cuentan las categorías que la empresa ve (activas), igual que en la base.
  const tipoDe = new Map(categorias.map((c) => [c.id, c.tipo as string]));
  const faltan = datosFaltantes({
    tiposDeCategoria: new Set(proyecto.categorias.map((c) => tipoDe.get(c)).filter((t): t is string => !!t)),
    montoBuscado: proyecto.montoBuscado,
    departamento: proyecto.departamento,
  });

  const porId = new Map(catalogo.map((c) => [c.id, c]));
  const aSugerencia = (f: Fila): Sugerencia | null => {
    const convocatoria = porId.get(f.convocatoria_id);
    // La base y el catálogo leen con la misma sesión; si una cerró entre las dos lecturas, se omite.
    if (!convocatoria) return null;
    return {
      convocatoria,
      coincidencias: f.coincidencias,
      porcentaje: f.porcentaje,
      criterios: CRITERIOS.map(({ clave, etiqueta }) => ({
        clave,
        etiqueta,
        estado: f[clave] ? "cumple" : faltan.includes(clave) ? "sin_dato" : "no_cumple",
      })),
    };
  };

  const filas = (data ?? []) as Fila[];
  const { sugerencias, cercanas } = separarSugerencias(filas);
  const presentes = (lista: Fila[]) => lista.map(aSugerencia).filter((s): s is Sugerencia => s !== null);

  return {
    ok: true,
    datos: {
      proyecto,
      sugerencias: presentes(sugerencias),
      cercanas: presentes(cercanas),
      evaluadas: filas.length,
      faltan: CRITERIOS.filter((c) => faltan.includes(c.clave)),
    },
  };
}
