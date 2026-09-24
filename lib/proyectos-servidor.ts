import "server-only";
import { cache } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { leerMontoCOP } from "@/lib/montos";
import { esCodigoDepartamento } from "@/lib/departamentos";
import type { Proyecto } from "@/lib/types";

/**
 * Proyectos de la empresa (RF-14, RF-45, RF-46, RF-81, CU-09 · docs/05 §9.17 ·
 * Sprint 3 paso 1). Todo con la sesión de la empresa: **la RLS decide qué
 * proyecto es suyo** (RN-30). Aquí se valida la forma de los datos antes de
 * tocar la base; `guardar_proyecto` guarda datos y categorías juntos, y la
 * completitud la calcula un trigger.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };
const invalido = (error: string) => ({ ok: false as const, status: 400, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNAS =
  "id, usuario_id, nombre, descripcion, monto_buscado, departamento_codigo, ubicacion, problema, objetivo_general, objetivos_especificos, poblacion_beneficiaria, actividades, resultados_esperados, duracion_meses, presupuesto_estimado, experiencia_empresa, completitud, proyecto_categoria (categoria_id)";

type Fila = {
  id: string;
  usuario_id: string;
  nombre: string;
  descripcion: string | null;
  monto_buscado: number | string | null;
  departamento_codigo: string | null;
  ubicacion: string | null;
  problema: string | null;
  objetivo_general: string | null;
  objetivos_especificos: string[] | null;
  poblacion_beneficiaria: string | null;
  actividades: string | null;
  resultados_esperados: string | null;
  duracion_meses: number | null;
  presupuesto_estimado: number | string | null;
  experiencia_empresa: string | null;
  completitud: number;
  proyecto_categoria: { categoria_id: string }[];
};

const numero = (v: number | string | null) => (v === null ? null : Number(v));
const opcional = <T,>(v: T | null) => (v === null ? undefined : v);

function aProyecto(f: Fila): Proyecto {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    nombre: f.nombre,
    descripcion: f.descripcion ?? "",
    montoBuscado: numero(f.monto_buscado),
    departamento: f.departamento_codigo,
    ubicacion: f.ubicacion ?? "",
    categorias: f.proyecto_categoria.map((c) => c.categoria_id),
    problema: opcional(f.problema),
    objetivoGeneral: opcional(f.objetivo_general),
    objetivosEspecificos: f.objetivos_especificos ?? [],
    poblacionBeneficiaria: opcional(f.poblacion_beneficiaria),
    actividades: opcional(f.actividades),
    resultadosEsperados: opcional(f.resultados_esperados),
    duracionMeses: opcional(f.duracion_meses),
    presupuestoEstimado: opcional(numero(f.presupuesto_estimado)),
    experienciaEmpresa: opcional(f.experiencia_empresa),
    completitud: f.completitud,
  };
}

// `cache` de React: el layout y la página piden lo mismo en una petición.

/** RN-30 · Los proyectos de la sesión, los más recientes primero. */
export const listarProyectos = cache(async (): Promise<Proyecto[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("proyectos").select(COLUMNAS).order("creado_at", { ascending: false });
  if (error) {
    console.error("Proyectos: no se pudieron listar", error.code, error.message);
    return [];
  }
  return (data as unknown as Fila[]).map(aProyecto);
});

/** El proyecto, si la sesión puede verlo; null si para ella no existe. */
export const obtenerProyecto = cache(async (id: string): Promise<Proyecto | null> => {
  if (!UUID.test(id)) return null;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("proyectos").select(COLUMNAS).eq("id", id).maybeSingle();
  if (error) console.error("Proyectos: no se pudo leer", error.code, error.message);
  return data ? aProyecto(data as unknown as Fila) : null;
});

// ---------------------------------------------------------------------------
// Validación de forma
// ---------------------------------------------------------------------------

type Cuerpo = Record<string, unknown> | null;

function texto(cuerpo: Cuerpo, campo: string, maximo: number): string | null {
  const v = cuerpo?.[campo];
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  const limpio = v.trim();
  return limpio.length > maximo ? null : limpio;
}

const ETIQUETAS: Record<string, string> = {
  descripcion: "La descripción",
  ubicacion: "El municipio o detalle de ubicación",
  problema: "El problema",
  objetivoGeneral: "El objetivo general",
  poblacionBeneficiaria: "La población beneficiaria",
  actividades: "Las actividades",
  resultadosEsperados: "Los resultados esperados",
  experienciaEmpresa: "La experiencia de la empresa",
};

function datosDelProyecto(cuerpo: Cuerpo): { ok: true; datos: Record<string, unknown>; categorias: string[] } | ReturnType<typeof invalido> {
  const nombre = texto(cuerpo, "nombre", 200);
  if (nombre === null) return invalido("El nombre no puede pasar de 200 caracteres.");
  if (!nombre) return invalido("Escribe el nombre del proyecto.");

  const textos: Record<string, string> = {};
  for (const [campo, etiqueta] of Object.entries(ETIQUETAS)) {
    const maximo = campo === "ubicacion" ? 300 : 5000;
    const v = texto(cuerpo, campo, maximo);
    if (v === null) return invalido(`${etiqueta} no puede pasar de ${maximo.toLocaleString("es-CO")} caracteres.`);
    textos[campo] = v;
  }

  // CU-02 2b, CU-09: montos en formato colombiano, sin interpretar a medias.
  const monto = leerMontoCOP(cuerpo?.montoBuscado ?? "");
  if (!monto.ok) return invalido(`El monto buscado ${monto.error}`);
  const presupuesto = leerMontoCOP(cuerpo?.presupuestoEstimado ?? "");
  if (!presupuesto.ok) return invalido(`El presupuesto estimado ${presupuesto.error}`);

  let duracion: number | null = null;
  const d = cuerpo?.duracionMeses;
  if (d !== undefined && d !== null && d !== "") {
    duracion = Number(d);
    if (!Number.isInteger(duracion) || duracion < 1 || duracion > 240) {
      return invalido("La duración debe ser un número entero de meses, entre 1 y 240.");
    }
  }

  const objetivosCrudos = cuerpo?.objetivosEspecificos ?? [];
  if (!Array.isArray(objetivosCrudos) || objetivosCrudos.length > 30 || !objetivosCrudos.every((o) => typeof o === "string")) {
    return invalido("Objetivos específicos no válidos.");
  }
  const objetivos = (objetivosCrudos as string[]).map((o) => o.trim()).filter(Boolean);
  if (objetivos.some((o) => o.length > 1000)) return invalido("Cada objetivo específico puede tener hasta 1.000 caracteres.");

  // RN-34 · El departamento sale de la lista oficial; vacío si aún no se indica.
  const departamento = cuerpo?.departamento ?? "";
  if (departamento !== "" && departamento !== null && (typeof departamento !== "string" || !esCodigoDepartamento(departamento))) {
    return invalido("El departamento no está en la lista oficial.");
  }

  const categorias = cuerpo?.categorias ?? [];
  if (!Array.isArray(categorias) || categorias.length > 50 || !categorias.every((c) => typeof c === "string" && UUID.test(c))) {
    return invalido("Categorías no válidas.");
  }

  return {
    ok: true,
    categorias: [...new Set(categorias as string[])],
    datos: {
      nombre,
      descripcion: textos.descripcion,
      monto_buscado: monto.valor === null ? "" : String(monto.valor),
      departamento_codigo: departamento ?? "",
      ubicacion: textos.ubicacion,
      problema: textos.problema,
      objetivo_general: textos.objetivoGeneral,
      objetivos_especificos: objetivos,
      poblacion_beneficiaria: textos.poblacionBeneficiaria,
      actividades: textos.actividades,
      resultados_esperados: textos.resultadosEsperados,
      duracion_meses: duracion === null ? "" : String(duracion),
      presupuesto_estimado: presupuesto.valor === null ? "" : String(presupuesto.valor),
      experiencia_empresa: textos.experienciaEmpresa,
    },
  };
}

const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_existe: { status: 404, error: "El proyecto no existe." },
  categoria_invalida: { status: 400, error: "Hay una categoría inexistente o inactiva." },
  departamento_invalido: { status: 400, error: "El departamento no está en la lista oficial." },
};

function rechazo(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  console.error(`Proyectos: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos guardar el proyecto. Intenta de nuevo." };
}

/** RF-14, RF-45, RF-81 · Crea (id null) o edita un proyecto propio. */
export async function guardarProyecto(id: string | null, cuerpo: Cuerpo): Promise<Resultado<Proyecto>> {
  if (id !== null && !UUID.test(id)) return { ok: false, status: 404, error: "El proyecto no existe." };
  const v = datosDelProyecto(cuerpo);
  if (!v.ok) return v;

  const supabase = await crearClienteServidor();
  const { data: guardadoId, error } = await supabase.rpc("guardar_proyecto", {
    p_id: id,
    p_datos: v.datos,
    p_categorias: v.categorias,
  });
  if (error) return rechazo(error, id ? "editar" : "crear");

  const proyecto = await obtenerProyecto(guardadoId as string);
  if (!proyecto) return { ok: false, status: 404, error: "El proyecto no existe." };
  return { ok: true, datos: proyecto };
}

/** Lo que se pierde al borrar, para advertirlo antes (CU-09 2a). */
export async function consecuenciasDeBorrar(id: string): Promise<Resultado<{ documentos: number; encargos: number }>> {
  if (!(await obtenerProyecto(id))) return { ok: false, status: 404, error: "El proyecto no existe." };
  const supabase = await crearClienteServidor();
  const [docs, encargos] = await Promise.all([
    supabase.from("documentos_generados").select("id", { count: "exact", head: true }).eq("proyecto_id", id),
    supabase.from("encargos").select("id", { count: "exact", head: true }).eq("proyecto_id", id),
  ]);
  return { ok: true, datos: { documentos: docs.count ?? 0, encargos: encargos.count ?? 0 } };
}

/** CU-09 2a · Borra un proyecto propio. Con encargos no se puede (docs/05 §9.17). */
export async function eliminarProyecto(id: string): Promise<Resultado<null>> {
  if (!UUID.test(id)) return { ok: false, status: 404, error: "El proyecto no existe." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("proyectos").delete().eq("id", id).select("id").maybeSingle();
  if (error) {
    if (error.code === "23503") {
      return { ok: false, status: 409, error: "Este proyecto tiene encargos a consultores y no se puede eliminar." };
    }
    console.error("Proyectos: no se pudo eliminar", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos eliminar el proyecto. Intenta de nuevo." };
  }
  if (!data) return { ok: false, status: 404, error: "El proyecto no existe." };
  return { ok: true, datos: null };
}
