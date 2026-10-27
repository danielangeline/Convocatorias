"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { PropuestaProyecto, Proyecto } from "@/lib/types";
import type { CampoContenido } from "@/lib/proyectos";
import { formatearMontoCOP } from "@/lib/montos";
import { DEPARTAMENTOS } from "@/lib/departamentos";
import { Button } from "./ui/Button";

/**
 * Formulario de proyecto compartido por el listado (`/proyectos`) y la ficha
 * (`/proyectos/[id]`). RF-81: el indicador de completitud es accionable, así
 * que la edición tiene que poder abrirse desde donde se señalan los campos
 * faltantes, no solo desde el lápiz del listado.
 */

type ClaveContenido = CampoContenido["clave"];
/** Campos a los que se puede saltar: los de contenido (RF-81) y los de clasificación que piden las sugerencias (CU-10 2a). */
export type CampoEditable = ClaveContenido | "montoBuscado" | "departamento" | "categorias";

type FormularioProyecto = {
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

/** CU-43 · El formulario lleno con la propuesta de la IA, para revisarla. */
function desdePropuesta(p: PropuestaProyecto): FormularioProyecto {
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
    const cuerpo = {
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

  const campoTexto = (clave: ClaveContenido, filas: number, placeholder?: string) => (
    <textarea
      id={`campo-${clave}`}
      value={form[clave] as string}
      onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
      rows={filas}
      placeholder={placeholder}
      className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-violet bg-surface text-ink"
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={proyecto ? "Editar proyecto" : "Nuevo proyecto"}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            {proyecto ? "Editar proyecto" : "Nuevo proyecto"}
          </h3>
          <button onClick={cerrar} className="text-ink-3 hover:text-ink" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {propuesta && (
          <div className="mb-4 rounded-xl bg-violet/10 p-3 text-sm text-violet-ink ring-1 ring-inset ring-violet/30">
            <p className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="h-4 w-4" /> La IA llenó el formulario con lo que contaste
            </p>
            <p className="mt-1 text-xs text-violet-ink">
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

        <div className="space-y-4">
          <Campo etiqueta="Nombre del proyecto" htmlFor="campo-nombre">
            <input
              id="campo-nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pri bg-surface text-ink"
              placeholder="Ej. EcoEmpaques Andinos"
            />
          </Campo>

          <Campo etiqueta="Descripción" htmlFor="campo-descripcion">
            <textarea
              id="campo-descripcion"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pri bg-surface text-ink"
              placeholder="Describe brevemente el proyecto"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo etiqueta="Monto buscado (COP)" htmlFor="campo-montoBuscado">
              <input
                id="campo-montoBuscado"
                type="text"
                inputMode="numeric"
                value={form.montoBuscado}
                onChange={(e) => setForm({ ...form, montoBuscado: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pri bg-surface text-ink"
                placeholder="Ej. 100.000.000"
              />
            </Campo>
            {/* RN-34: el departamento es el que cuenta para sugerencias; el detalle solo se muestra. */}
            <Campo etiqueta="Departamento donde se ejecuta" htmlFor="campo-departamento">
              <select
                id="campo-departamento"
                value={form.departamento}
                onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pri bg-surface text-ink"
              >
                <option value="">Sin indicar</option>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d.codigo} value={d.codigo}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Municipio o detalle de ubicación (opcional)" htmlFor="campo-ubicacion">
            <input
              id="campo-ubicacion"
              value={form.ubicacion}
              onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pri bg-surface text-ink"
              placeholder="Ej. Barranquilla, zona rural de Sabanalarga"
              maxLength={300}
            />
          </Campo>

          <Campo etiqueta="Categorías">
            <div id="campo-categorias" tabIndex={-1} className="max-h-48 space-y-3 overflow-y-auto rounded-lg border border-line-2 p-3 outline-none">
              {(["tipo_proyecto", "sector", "tipo_entidad"] as const).map((tipo) => (
                <div key={tipo}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                    {tipo === "tipo_proyecto" ? "Tipo de proyecto" : tipo === "sector" ? "Sector" : "Tipo de entidad"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {categorias
                      .filter((c) => c.tipo === tipo)
                      .map((c) => {
                        const activo = form.categorias.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => toggleCategoria(c.id)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                              activo
                                ? "bg-pri text-on-pri ring-pri"
                                : "bg-surface text-ink-2 ring-line hover:bg-surface-2"
                            }`}
                          >
                            {c.nombre}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </Campo>

          <div className="border-t border-dashed border-line pt-4">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-violet-ink">
              <Sparkles className="h-3.5 w-3.5" /> Contenido para generación de documentos
            </p>
            <p className="mb-3 text-xs text-ink-3">
              Estos campos alimentan la generación de documentos con IA y determinan la completitud del proyecto.
            </p>

            <div className="space-y-4">
              <Campo etiqueta="Problema que atiende el proyecto" htmlFor="campo-problema">
                {campoTexto("problema", 2)}
              </Campo>
              <Campo etiqueta="Objetivo general" htmlFor="campo-objetivoGeneral">
                {campoTexto("objetivoGeneral", 2)}
              </Campo>
              <Campo etiqueta="Objetivos específicos (uno por línea)" htmlFor="campo-objetivosEspecificos">
                {campoTexto(
                  "objetivosEspecificos",
                  3,
                  "Ej.\nInstalar 5 sensores climáticos\nCapacitar a 100 productores"
                )}
              </Campo>
              <Campo etiqueta="Población beneficiaria" htmlFor="campo-poblacionBeneficiaria">
                {campoTexto("poblacionBeneficiaria", 2)}
              </Campo>
              <Campo etiqueta="Actividades y metodología" htmlFor="campo-actividades">
                {campoTexto("actividades", 2)}
              </Campo>
              <Campo etiqueta="Resultados esperados" htmlFor="campo-resultadosEsperados">
                {campoTexto("resultadosEsperados", 2)}
              </Campo>
              <div className="grid grid-cols-2 gap-4">
                <Campo etiqueta="Duración (meses)" htmlFor="campo-duracionMeses">
                  <input
                    id="campo-duracionMeses"
                    type="number"
                    min={1}
                    max={240}
                    step={1}
                    value={form.duracionMeses}
                    onChange={(e) => setForm({ ...form, duracionMeses: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-violet bg-surface text-ink"
                  />
                </Campo>
                <Campo etiqueta="Presupuesto estimado (COP)" htmlFor="campo-presupuestoEstimado">
                  <input
                    id="campo-presupuestoEstimado"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 250.000.000"
                    value={form.presupuestoEstimado}
                    onChange={(e) => setForm({ ...form, presupuestoEstimado: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-violet bg-surface text-ink"
                  />
                </Campo>
              </div>
              <Campo etiqueta="Experiencia de la empresa" htmlFor="campo-experienciaEmpresa">
                {campoTexto("experienciaEmpresa", 2)}
              </Campo>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose/10 px-3 py-2.5 text-sm text-rose-ink">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={!form.nombre.trim() || guardando}>
            {guardando ? "Guardando…" : proyecto ? "Guardar cambios" : "Crear proyecto"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  htmlFor,
  children,
}: {
  etiqueta: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3"
      >
        {etiqueta}
      </label>
      {children}
    </div>
  );
}
