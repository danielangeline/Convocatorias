"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Proyecto } from "@/lib/types";
import type { CampoContenido } from "@/lib/proyectos";
import { Button } from "./ui/Button";

/**
 * Formulario de proyecto compartido por el listado (`/proyectos`) y la ficha
 * (`/proyectos/[id]`). RF-81: el indicador de completitud es accionable, así
 * que la edición tiene que poder abrirse desde donde se señalan los campos
 * faltantes, no solo desde el lápiz del listado.
 */

type ClaveContenido = CampoContenido["clave"];

type FormularioProyecto = {
  nombre: string;
  descripcion: string;
  montoBuscado: string;
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
    montoBuscado: String(p.montoBuscado),
    ubicacion: p.ubicacion,
    categorias: p.categorias,
    problema: p.problema ?? "",
    objetivoGeneral: p.objetivoGeneral ?? "",
    objetivosEspecificos: (p.objetivosEspecificos ?? []).join("\n"),
    poblacionBeneficiaria: p.poblacionBeneficiaria ?? "",
    actividades: p.actividades ?? "",
    resultadosEsperados: p.resultadosEsperados ?? "",
    duracionMeses: p.duracionMeses ? String(p.duracionMeses) : "",
    presupuestoEstimado: p.presupuestoEstimado ? String(p.presupuestoEstimado) : "",
    experienciaEmpresa: p.experienciaEmpresa ?? "",
  };
}

/**
 * Se monta solo cuando está abierto: el estado inicial se calcula en el
 * montaje y no hay que reiniciarlo desde un efecto.
 */
export function ProyectoFormModal({
  proyecto,
  campoInicial,
  onClose,
}: {
  /** `null` crea un proyecto nuevo; un proyecto lo edita. */
  proyecto: Proyecto | null;
  /** Campo de contenido al que saltar al abrir (RF-81). */
  campoInicial?: ClaveContenido | null;
  onClose: () => void;
}) {
  // Sprint 2 paso 4: las categorías reales, para que las sugerencias crucen con las convocatorias.
  const categorias = useAppStore((s) => s.categorias);
  const agregarProyecto = useAppStore((s) => s.agregarProyecto);
  const actualizarProyecto = useAppStore((s) => s.actualizarProyecto);

  const [form, setForm] = useState<FormularioProyecto>(() =>
    proyecto ? desdeProyecto(proyecto) : formularioVacio
  );

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
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleCategoria = (id: string) => {
    setForm((f) => ({
      ...f,
      categorias: f.categorias.includes(id)
        ? f.categorias.filter((c) => c !== id)
        : [...f.categorias, id],
    }));
  };

  const guardar = () => {
    if (!form.nombre.trim()) return;
    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      montoBuscado: Number(form.montoBuscado) || 0,
      ubicacion: form.ubicacion.trim(),
      categorias: form.categorias,
      problema: form.problema.trim() || undefined,
      objetivoGeneral: form.objetivoGeneral.trim() || undefined,
      objetivosEspecificos: form.objetivosEspecificos
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean),
      poblacionBeneficiaria: form.poblacionBeneficiaria.trim() || undefined,
      actividades: form.actividades.trim() || undefined,
      resultadosEsperados: form.resultadosEsperados.trim() || undefined,
      duracionMeses: Number(form.duracionMeses) || undefined,
      presupuestoEstimado: Number(form.presupuestoEstimado) || undefined,
      experienciaEmpresa: form.experienciaEmpresa.trim() || undefined,
    };
    if (proyecto) {
      actualizarProyecto(proyecto.id, datos);
    } else {
      agregarProyecto(datos);
    }
    onClose();
  };

  const campoTexto = (clave: ClaveContenido, filas: number, placeholder?: string) => (
    <textarea
      id={`campo-${clave}`}
      value={form[clave] as string}
      onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
      rows={filas}
      placeholder={placeholder}
      className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal-500"
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={proyecto ? "Editar proyecto" : "Nuevo proyecto"}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            {proyecto ? "Editar proyecto" : "Nuevo proyecto"}
          </h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Campo etiqueta="Nombre del proyecto" htmlFor="campo-nombre">
            <input
              id="campo-nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
              placeholder="Ej. EcoEmpaques Andinos"
            />
          </Campo>

          <Campo etiqueta="Descripción" htmlFor="campo-descripcion">
            <textarea
              id="campo-descripcion"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
              placeholder="Describe brevemente el proyecto"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo etiqueta="Monto buscado (COP)" htmlFor="campo-montoBuscado">
              <input
                id="campo-montoBuscado"
                type="number"
                value={form.montoBuscado}
                onChange={(e) => setForm({ ...form, montoBuscado: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
                placeholder="Ej. 100000000"
              />
            </Campo>
            <Campo etiqueta="Ubicación" htmlFor="campo-ubicacion">
              <input
                id="campo-ubicacion"
                value={form.ubicacion}
                onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
                placeholder="Ej. Bogotá D.C."
              />
            </Campo>
          </div>

          <Campo etiqueta="Categorías">
            <div className="max-h-48 space-y-3 overflow-y-auto rounded-lg border border-line-soft p-3">
              {(["tipo_proyecto", "sector", "tipo_entidad"] as const).map((tipo) => (
                <div key={tipo}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
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
                                ? "bg-primary-800 text-white ring-primary-800"
                                : "bg-white text-ink-soft ring-line hover:bg-slate-50"
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
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-teal-700">
              <Sparkles className="h-3.5 w-3.5" /> Contenido para generación de documentos
            </p>
            <p className="mb-3 text-xs text-ink-faint">
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
                    value={form.duracionMeses}
                    onChange={(e) => setForm({ ...form, duracionMeses: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </Campo>
                <Campo etiqueta="Presupuesto estimado (COP)" htmlFor="campo-presupuestoEstimado">
                  <input
                    id="campo-presupuestoEstimado"
                    type="number"
                    value={form.presupuestoEstimado}
                    onChange={(e) => setForm({ ...form, presupuestoEstimado: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </Campo>
              </div>
              <Campo etiqueta="Experiencia de la empresa" htmlFor="campo-experienciaEmpresa">
                {campoTexto("experienciaEmpresa", 2)}
              </Campo>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={!form.nombre.trim()}>
            {proyecto ? "Guardar cambios" : "Crear proyecto"}
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
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
      >
        {etiqueta}
      </label>
      {children}
    </div>
  );
}
