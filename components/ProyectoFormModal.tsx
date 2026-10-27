"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { PropuestaProyecto, Proyecto } from "@/lib/types";
import type { CampoContenido } from "@/lib/proyectos";
import { formatearMontoCOP } from "@/lib/montos";
import { DEPARTAMENTOS } from "@/lib/departamentos";
import { Button } from "./ui/Button";
import { EditarConIA } from "./proyectos/EditarConIA";

/**
 * Formulario de proyecto compartido por el listado (`/proyectos`) y la ficha
 * (`/proyectos/[id]`). RF-81: el indicador de completitud es accionable, así
 * que la edición tiene que poder abrirse desde donde se señalan los campos
 * faltantes, no solo desde el lápiz del listado.
 */

type ClaveContenido = CampoContenido["clave"];
/** Campos a los que se puede saltar: los de contenido (RF-81) y los de clasificación que piden las sugerencias (CU-10 2a). */
/** Desde la sesión 031 también nombre y descripción, para editar cada apartado por separado (RF-109). */
export type CampoEditable = ClaveContenido | "nombre" | "descripcion" | "montoBuscado" | "departamento" | "categorias";

export type FormularioProyecto = {
  nombre: string;
  descripcion: string;
  montoBuscado: string;
  departamento: string;
  ubicacion: string;
  categorias: string[];
  problema: string;
  objetivoGeneral: string;
  objetivosEspecificos: string;
  poblacionBeneficiaria: string;
  actividades: string;
  resultadosEsperados: string;
  duracionMeses: string;
  presupuestoEstimado: string;
  experienciaEmpresa: string;
};

const formularioVacio: FormularioProyecto = {
  nombre: "",
  descripcion: "",
  montoBuscado: "",
  departamento: "",
  ubicacion: "",
  categorias: [],
  problema: "",
  objetivoGeneral: "",
  objetivosEspecificos: "",
  poblacionBeneficiaria: "",
  actividades: "",
  resultadosEsperados: "",
  duracionMeses: "",
  presupuestoEstimado: "",
  experienciaEmpresa: "",
};

function desdeProyecto(p: Proyecto): FormularioProyecto {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion,
    montoBuscado: formatearMontoCOP(p.montoBuscado),
    departamento: p.departamento ?? "",
    ubicacion: p.ubicacion,
    categorias: p.categorias,
    problema: p.problema ?? "",
    objetivoGeneral: p.objetivoGeneral ?? "",
    objetivosEspecificos: (p.objetivosEspecificos ?? []).join("\n"),
    poblacionBeneficiaria: p.poblacionBeneficiaria ?? "",
    actividades: p.actividades ?? "",
    resultadosEsperados: p.resultadosEsperados ?? "",
    duracionMeses: p.duracionMeses ? String(p.duracionMeses) : "",
    presupuestoEstimado: formatearMontoCOP(p.presupuestoEstimado ?? null),
    experienciaEmpresa: p.experienciaEmpresa ?? "",
  };
}

/** CU-43 · El formulario lleno con la propuesta de la IA. */
export function desdePropuesta(p: PropuestaProyecto): FormularioProyecto {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion,
    montoBuscado: formatearMontoCOP(p.montoBuscado),
    departamento: p.departamento ?? "",
    ubicacion: p.ubicacion,
    categorias: p.categorias,
    problema: p.problema,
    objetivoGeneral: p.objetivoGeneral,
    objetivosEspecificos: p.objetivosEspecificos.join("\n"),
    poblacionBeneficiaria: p.poblacionBeneficiaria,
    actividades: p.actividades,
    resultadosEsperados: p.resultadosEsperados,
    duracionMeses: p.duracionMeses ? String(p.duracionMeses) : "",
    presupuestoEstimado: formatearMontoCOP(p.presupuestoEstimado),
    experienciaEmpresa: p.experienciaEmpresa,
  };
}

/** Cuerpo de `POST/PATCH /api/proyectos` (RF-14): el servidor valida la forma y lee los montos. */
export function cuerpoDeFormulario(form: FormularioProyecto) {
  return {
    nombre: form.nombre,
    descripcion: form.descripcion,
    montoBuscado: form.montoBuscado,
    departamento: form.departamento,
    ubicacion: form.ubicacion,
    categorias: form.categorias,
    problema: form.problema,
    objetivoGeneral: form.objetivoGeneral,
    objetivosEspecificos: form.objetivosEspecificos.split("\n"),
    poblacionBeneficiaria: form.poblacionBeneficiaria,
    actividades: form.actividades,
    resultadosEsperados: form.resultadosEsperados,
    duracionMeses: form.duracionMeses,
    presupuestoEstimado: form.presupuestoEstimado,
    experienciaEmpresa: form.experienciaEmpresa,
  };
}

/**
 * Se monta solo cuando está abierto: el estado inicial se calcula en el
 * montaje y no hay que reiniciarlo desde un efecto.
 */
export function ProyectoFormModal({
  proyecto,
  campoInicial,
  propuesta,
  onCreado,
  onClose,
  soloApartado = false,
}: {
  /** `null` crea un proyecto nuevo; un proyecto lo edita. */
  proyecto: Proyecto | null;
  /** Campo al que saltar al abrir (RF-81, CU-10 2a). */
  campoInicial?: CampoEditable | null;
  /** CU-43 · Propuesta de la IA con la que se llena un proyecto nuevo. */
  propuesta?: PropuestaProyecto | null;
  /** Se llama con el id del proyecto recién creado, en lugar de cerrar (RF-98). */
  onCreado?: (id: string) => void;
  onClose: () => void;
  /** Abre solo el apartado de `campoInicial` (con «Ver todo el proyecto» para el resto). */
  soloApartado?: boolean;
}) {
  // Sprint 2 paso 4: las categorías reales, para que las sugerencias crucen con las convocatorias.
  const categorias = useAppStore((s) => s.categorias);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState<FormularioProyecto>(() =>
    proyecto ? desdeProyecto(proyecto) : propuesta ? desdePropuesta(propuesta) : formularioVacio
  );

  // CU-43 7a: la propuesta ya costó un crédito; se advierte antes de descartarla.
  const cerrar = () => {
    if (propuesta && !window.confirm("¿Cerrar sin crear el proyecto? Perderás lo que armó la IA y los créditos ya se usaron.")) return;
    onClose();
  };

  // Salta al campo que el usuario quiere completar y le da el foco.
  useEffect(() => {
    if (!campoInicial) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`campo-${campoInicial}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement | HTMLTextAreaElement | null)?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [campoInicial]);

  // Cerrar con Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleCategoria = (id: string) => {
    setForm((f) => ({
      ...f,
      categorias: f.categorias.includes(id)
        ? f.categorias.filter((c) => c !== id)
        : [...f.categorias, id],
    }));
  };

  // RF-14, RF-45, RF-81 · Se guarda en el servidor (docs/05 §9.17): él valida la
  // forma, lee los montos en formato colombiano y calcula la completitud.
  const guardar = async () => {
    if (!form.nombre.trim()) return;
    setError(null);
    setGuardando(true);
    const cuerpo = cuerpoDeFormulario(form);
    const respuesta = await fetch(proyecto ? `/api/proyectos/${proyecto.id}` : "/api/proyectos", {
      method: proyecto ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const json = await respuesta.json().catch(() => ({}));
    setGuardando(false);
    if (!respuesta.ok) {
      setError(json.error ?? "No pudimos guardar el proyecto. Intenta de nuevo.");
      return;
    }
    if (!proyecto && onCreado) {
      onCreado((json.datos as Proyecto).id);
      return;
    }
    router.refresh();
    onClose();
  };

  // Cada apartado se puede abrir solo (RF-81, RF-109): la ficha pasa `soloApartado`.
  const [verTodo, setVerTodo] = useState(!soloApartado || !campoInicial);
  const visible = (...claves: CampoEditable[]) => verTodo || (campoInicial !== null && campoInicial !== undefined && claves.includes(campoInicial));
  const ETIQUETA_APARTADO: Partial<Record<CampoEditable, string>> = {
    nombre: "Nombre del proyecto",
    descripcion: "Descripción",
    montoBuscado: "Monto buscado",
    departamento: "Ubicación",
    categorias: "Categorías",
    problema: "Problema que atiende",
    objetivoGeneral: "Objetivo general",
    objetivosEspecificos: "Objetivos específicos",
    poblacionBeneficiaria: "Población beneficiaria",
    actividades: "Actividades y metodología",
    resultadosEsperados: "Resultados esperados",
    duracionMeses: "Duración",
    presupuestoEstimado: "Presupuesto estimado",
    experienciaEmpresa: "Experiencia de la empresa",
  };

  // Caja de texto grande que la persona puede agrandar (RF-109, pedido del Product Owner).
  const claseCaja =
    "block w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-ink outline-none focus:border-pri";
  const claseLinea =
    "block h-11 w-full rounded-xl border border-line bg-surface px-4 text-[14.5px] text-ink outline-none focus:border-pri";

  /** Apartado de texto con su botón «Editar con IA» (solo con el proyecto ya creado). */
  const apartadoTexto = (
    clave: "nombre" | "descripcion" | ClaveContenido,
    titulo: string,
    { filas = 5, placeholder, ayuda }: { filas?: number; placeholder?: string; ayuda?: string } = {}
  ) => (
    <Apartado
      key={clave}
      titulo={titulo}
      ayuda={ayuda}
      htmlFor={`campo-${clave}`}
      accion={
        proyecto ? (
          <EditarConIA
            proyectoId={proyecto.id}
            apartado={clave}
            textoActual={form[clave] as string}
            onAceptar={(texto) => setForm((f) => ({ ...f, [clave]: texto }))}
          />
        ) : undefined
      }
    >
      {clave === "nombre" ? (
        <input
          id="campo-nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className={claseLinea}
          placeholder="Ej. EcoEmpaques Andinos"
        />
      ) : (
        <textarea
          id={`campo-${clave}`}
          value={form[clave] as string}
          onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
          rows={filas}
          placeholder={placeholder}
          className={`${claseCaja} min-h-[120px]`}
        />
      )}
    </Apartado>
  );

  const categoriasDe = (tipo: "tipo_proyecto" | "sector" | "tipo_entidad", titulo: string, ayuda: string) => {
    const lista = categorias.filter((c) => c.tipo === tipo);
    const elegidas = lista.filter((c) => form.categorias.includes(c.id)).length;
    return (
      <Apartado
        key={tipo}
        titulo={titulo}
        ayuda={ayuda}
        accion={<span className="font-tabular text-xs font-semibold text-ink-3">{elegidas} elegidas</span>}
      >
        <div className="flex flex-wrap gap-2">
          {lista.map((c) => {
            const activo = form.categorias.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={activo}
                onClick={() => toggleCategoria(c.id)}
                className={`min-h-10 cursor-pointer rounded-xl border px-3.5 py-2 text-left text-[13.5px] font-semibold transition-colors ${
                  activo
                    ? "border-pri bg-pri-soft text-pri-text"
                    : "border-line bg-surface text-ink-2 hover:border-pri hover:text-ink"
                }`}
              >
                {activo && <Check className="mr-1.5 inline h-3.5 w-3.5" />}
                {c.nombre}
              </button>
            );
          })}
          {lista.length === 0 && <p className="text-[13px] text-ink-3">No hay opciones activas.</p>}
        </div>
      </Apartado>
    );
  };

  const titulo = !verTodo && campoInicial
    ? `Editar: ${ETIQUETA_APARTADO[campoInicial] ?? "apartado"}`
    : proyecto
      ? "Editar proyecto"
      : "Nuevo proyecto";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl ${
          verTodo ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-extrabold tracking-[-0.02em] text-ink">{titulo}</h3>
            {proyecto && <p className="truncate text-[13px] text-ink-3">{proyecto.nombre}</p>}
          </div>
          <div className="flex items-center gap-2">
            {!verTodo && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setVerTodo(true)}>
                Ver todo el proyecto
              </Button>
            )}
            <button
              onClick={cerrar}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] text-ink-3 hover:bg-surface-2 hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-bg px-4 py-5 sm:px-6">
          {propuesta && (
            <div className="mb-4 rounded-xl bg-violet/10 p-4 text-sm text-violet-ink ring-1 ring-inset ring-violet/30">
              <p className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="h-4 w-4" /> La IA llenó el formulario con lo que contaste
              </p>
              <p className="mt-1 text-xs">
                Revisa y corrige todo antes de crear el proyecto: las categorías y el departamento deciden qué convocatorias te sugerimos.
              </p>
              {propuesta.faltantes.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="font-semibold">No lo mencionaste; complétalo si lo tienes:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {propuesta.faltantes.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4">
            {visible("nombre") && apartadoTexto("nombre", "Nombre del proyecto")}
            {visible("descripcion") &&
              apartadoTexto("descripcion", "Descripción", { filas: 4, placeholder: "Describe brevemente el proyecto" })}

            {(visible("montoBuscado") || visible("departamento")) && (
              <div className={`grid gap-4 ${visible("montoBuscado") && visible("departamento") ? "md:grid-cols-2" : ""}`}>
                {visible("montoBuscado") && (
                  <Apartado titulo="Monto buscado (COP)" htmlFor="campo-montoBuscado" ayuda="Cuánto pides a la convocatoria.">
                    <input
                      id="campo-montoBuscado"
                      type="text"
                      inputMode="numeric"
                      value={form.montoBuscado}
                      onChange={(e) => setForm({ ...form, montoBuscado: e.target.value })}
                      className={`${claseLinea} font-tabular`}
                      placeholder="Ej. 100.000.000"
                    />
                  </Apartado>
                )}
                {/* RN-34: el departamento es el que cuenta para sugerencias; el detalle solo se muestra. */}
                {visible("departamento") && (
                  <Apartado titulo="Ubicación" htmlFor="campo-departamento" ayuda="El departamento cuenta para las sugerencias.">
                    <div className="grid gap-3">
                      <select
                        id="campo-departamento"
                        value={form.departamento}
                        onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                        className={claseLinea}
                      >
                        <option value="">Departamento: sin indicar</option>
                        {DEPARTAMENTOS.map((d) => (
                          <option key={d.codigo} value={d.codigo}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>
                      <input
                        id="campo-ubicacion"
                        aria-label="Municipio o detalle de ubicación (opcional)"
                        value={form.ubicacion}
                        onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                        className={claseLinea}
                        placeholder="Municipio o detalle (opcional). Ej. Pitalito, zona rural"
                        maxLength={300}
                      />
                    </div>
                  </Apartado>
                )}
              </div>
            )}

            {visible("categorias") && (
              <div id="campo-categorias" tabIndex={-1} className="grid gap-4 outline-none lg:grid-cols-3">
                {categoriasDe("tipo_proyecto", "Tipo de proyecto", "Qué clase de proyecto es.")}
                {categoriasDe("sector", "Sector", "En qué sector económico trabaja.")}
                {categoriasDe("tipo_entidad", "Tipo de entidad", "Qué tipo de organización lo ejecuta.")}
              </div>
            )}

            {verTodo && (
              <div className="mt-2">
                <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-violet-ink">
                  <Sparkles className="h-4 w-4" /> Contenido para generación de documentos
                </p>
                <p className="mt-1 text-[13px] text-ink-3">
                  Estos apartados alimentan el documento base que genera la IA y determinan la completitud del proyecto.
                  Puedes agrandar cada caja desde su esquina inferior derecha.
                </p>
              </div>
            )}

            {visible("problema") && apartadoTexto("problema", "Problema que atiende el proyecto")}
            {visible("objetivoGeneral") && apartadoTexto("objetivoGeneral", "Objetivo general", { filas: 4 })}
            {visible("objetivosEspecificos") &&
              apartadoTexto("objetivosEspecificos", "Objetivos específicos", {
                filas: 6,
                ayuda: "Uno por línea.",
                placeholder: "Ej.\nInstalar 5 sensores climáticos\nCapacitar a 100 productores",
              })}
            {visible("poblacionBeneficiaria") && apartadoTexto("poblacionBeneficiaria", "Población beneficiaria", { filas: 4 })}
            {visible("actividades") && apartadoTexto("actividades", "Actividades y metodología", { filas: 6 })}
            {visible("resultadosEsperados") && apartadoTexto("resultadosEsperados", "Resultados esperados")}

            {(visible("duracionMeses") || visible("presupuestoEstimado")) && (
              <div className={`grid gap-4 ${visible("duracionMeses") && visible("presupuestoEstimado") ? "md:grid-cols-2" : ""}`}>
                {visible("duracionMeses") && (
                  <Apartado titulo="Duración (meses)" htmlFor="campo-duracionMeses">
                    <input
                      id="campo-duracionMeses"
                      type="number"
                      min={1}
                      max={240}
                      step={1}
                      value={form.duracionMeses}
                      onChange={(e) => setForm({ ...form, duracionMeses: e.target.value })}
                      className={`${claseLinea} font-tabular`}
                    />
                  </Apartado>
                )}
                {visible("presupuestoEstimado") && (
                  <Apartado titulo="Presupuesto estimado (COP)" htmlFor="campo-presupuestoEstimado">
                    <input
                      id="campo-presupuestoEstimado"
                      type="text"
                      inputMode="numeric"
                      placeholder="Ej. 250.000.000"
                      value={form.presupuestoEstimado}
                      onChange={(e) => setForm({ ...form, presupuestoEstimado: e.target.value })}
                      className={`${claseLinea} font-tabular`}
                    />
                  </Apartado>
                )}
              </div>
            )}
            {visible("experienciaEmpresa") && apartadoTexto("experienciaEmpresa", "Experiencia de la empresa")}
          </div>
        </div>

        <div className="border-t border-line bg-surface px-6 py-4">
          {error && (
            <p role="alert" className="mb-3 rounded-lg bg-rose/10 px-3 py-2.5 text-sm text-rose-ink">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardar} disabled={!form.nombre.trim() || guardando}>
              {guardando ? "Guardando…" : proyecto ? "Guardar cambios" : "Crear proyecto"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Un apartado del proyecto: tarjeta con su título, ayuda opcional y acción a la derecha. */
function Apartado({
  titulo,
  ayuda,
  htmlFor,
  accion,
  children,
}: {
  titulo: string;
  ayuda?: string;
  htmlFor?: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <label htmlFor={htmlFor} className="block text-[15px] font-extrabold text-ink">
            {titulo}
          </label>
          {ayuda && <p className="mt-0.5 text-[12.5px] text-ink-3">{ayuda}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}
