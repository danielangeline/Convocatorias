"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus, Trash2, Sparkles, UserPlus, X, PencilLine } from "lucide-react";
import type { Categoria, PropuestaProyecto, Proyecto } from "@/lib/types";
import { calcularCompletitud } from "@/lib/proyectos";
import { useAccesoSuscripcion, usePostulacionesPropias, useTarifas } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SolicitarConsultorModal } from "@/components/SolicitarConsultorModal";
import { ProyectoFormModal } from "@/components/ProyectoFormModal";
import { AsistenteProyecto } from "./AsistenteProyecto";
import { textoUbicacionProyecto } from "@/lib/departamentos";

/**
 * CU-09 · Listado de proyectos. Los datos llegan del servidor, leídos con la
 * sesión de la empresa (RN-30); no del store, que en el servidor solo tiene
 * datos de ejemplo. Crear, editar y eliminar pasan por /api/proyectos.
 */
export function ListadoProyectos({
  proyectos,
  categorias,
  compatiblesPorProyecto = {},
}: {
  proyectos: Proyecto[];
  categorias: Categoria[];
  /** Convocatorias vigentes que coinciden con cada proyecto (CU-10). */
  compatiblesPorProyecto?: Record<string, number>;
}) {
  const categoriaPorId = (id: string) => categorias.find((c) => c.id === id);
  const router = useRouter();
  const postulaciones = usePostulacionesPropias();
  const costoIA = useTarifas().estructuracion;
  const [elegirAbierto, setElegirAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  // CU-09 2a: se dice antes qué se pierde; con encargos el servidor responde 409.
  const eliminarProyecto = async (p: Proyecto) => {
    setError(null);
    const consulta = await fetch(`/api/proyectos/${p.id}?consecuencias=1`);
    const info = await consulta.json().catch(() => ({}));
    if (!consulta.ok) {
      setError(info.error ?? "No pudimos consultar el proyecto. Intenta de nuevo.");
      return;
    }
    const { documentos, encargos } = info.datos as { documentos: number; encargos: number };
    if (encargos > 0) {
      setError(`"${p.nombre}" tiene ${encargos === 1 ? "un encargo" : `${encargos} encargos`} a consultores y no se puede eliminar.`);
      return;
    }
    const aviso =
      documentos > 0
        ? ` También se borrarán ${documentos === 1 ? "su documento generado" : `sus ${documentos} documentos generados`}, y sus postulaciones quedarán sin proyecto.`
        : " Sus postulaciones, si tiene, quedarán sin proyecto.";
    if (!window.confirm(`¿Eliminar "${p.nombre}"?${aviso} No se puede deshacer.`)) return;
    setEliminando(p.id);
    const r = await fetch(`/api/proyectos/${p.id}`, { method: "DELETE" });
    const json = await r.json().catch(() => ({}));
    setEliminando(null);
    if (!r.ok) {
      setError(json.error ?? "No pudimos eliminar el proyecto. Intenta de nuevo.");
      return;
    }
    router.refresh();
  };
  const { requerirAcceso } = useAccesoSuscripcion();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Proyecto | null>(null);
  // CU-43: "Nuevo proyecto" abre primero el asistente; su propuesta llena el formulario.
  const [asistenteAbierto, setAsistenteAbierto] = useState(false);
  const [propuesta, setPropuesta] = useState<PropuestaProyecto | null>(null);
  const [proyectoConsultorId, setProyectoConsultorId] = useState<string | null>(null);
  const proyectoParaConsultor = proyectos.find((p) => p.id === proyectoConsultorId) ?? null;

  const verSugerencias = (proyectoId: string) => {
    if (!requerirAcceso("ver sugerencias de convocatorias")) return;
    router.push(`/proyectos/${proyectoId}/sugerencias`);
  };

  const solicitarConsultor = (proyectoId: string) => {
    if (!requerirAcceso("solicitar un consultor")) return;
    setProyectoConsultorId(proyectoId);
  };

  // «Nuevo proyecto» abre primero la elección de camino: contarlo con la IA o llenar el formulario.
  const abrirCrear = () => {
    setEditando(null);
    setPropuesta(null);
    setElegirAbierto(true);
  };
  const elegirIA = () => {
    setElegirAbierto(false);
    setAsistenteAbierto(true);
  };
  const elegirFormulario = () => {
    setElegirAbierto(false);
    abrirFormulario(null);
  };

  const abrirFormulario = (p: PropuestaProyecto | null) => {
    setPropuesta(p);
    setAsistenteAbierto(false);
    setModalAbierto(true);
  };

  // RF-98: el proyecto creado con IA abre su ficha para revisar y editar cada
  // parte. Lo que faltó viaja en sessionStorage, solo para el aviso de la ficha.
  const alCrearConIA = (id: string, faltantes: string[] = []) => {
    try {
      sessionStorage.setItem(`proyecto-ia:${id}`, JSON.stringify(faltantes));
    } catch {
      /* sin almacenamiento: el aviso sale sin la lista */
    }
    setAsistenteAbierto(false);
    setModalAbierto(false);
    router.push(`/proyectos/${id}?creado=ia`);
  };

  const abrirEditar = (p: Proyecto) => {
    setEditando(p);
    setModalAbierto(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Proyectos"
        descripcion="Registra los proyectos de tu empresa: son la base de las sugeridas y de los documentos con IA."
        accion={
          <Button variant="primary" onClick={abrirCrear}>
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </Button>
        }
      />

      {error && (
        <p role="alert" className="rounded-[4px] bg-rose-soft px-3 py-2.5 text-sm text-rose">
          {error}
        </p>
      )}

      {proyectos.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          titulo="Aún no tienes proyectos"
          descripcion="Crea tu primer proyecto para empezar a recibir sugerencias de convocatorias que encajan con él."
          accion={
            <Button variant="primary" onClick={abrirCrear}>
              <Plus className="h-4 w-4" /> Crear proyecto
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
          {proyectos.map((p) => {
            const { porcentaje, faltantes } = calcularCompletitud(p);
            const meta = [
              ...p.categorias.map((cid) => categoriaPorId(cid)).filter((c) => c && (c.tipo === "tipo_proyecto" || c.tipo === "sector")).map((c) => c!.nombre),
              textoUbicacionProyecto(p),
            ].filter(Boolean);
            const compatibles = compatiblesPorProyecto[p.id];
            const numPostulaciones = postulaciones.filter((x) => x.proyectoId === p.id).length;
            return (
              <article key={p.id} className="flex flex-col rounded-md border border-line bg-surface p-5">
                <Link href={`/proyectos/${p.id}`} className="font-display text-xl font-semibold leading-snug text-ink hover:text-pri-text hover:underline">
                  {p.nombre}
                </Link>
                {meta.length > 0 && <p className="mt-1 text-[13px] text-ink-3">{meta.join(" · ")}</p>}

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-xs font-semibold text-ink-2">
                    <span>Información del proyecto</span>
                    <span className="font-tabular text-ink">{porcentaje}%</span>
                  </div>
                  <ProgressBar porcentaje={porcentaje} tono={porcentaje < 70 ? "amber" : "pri"} className="mt-1.5" altura={6} />
                  <p className="mt-2 text-[13px] leading-snug text-ink-2">
                    {faltantes.length > 0
                      ? `Agrega ${faltantes[0].etiqueta.toLowerCase()} para afinar el cruce.`
                      : "Todo el contenido está diligenciado."}
                  </p>
                </div>

                <dl className="m-0 mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line text-center">
                  <div className="bg-surface px-2 py-2.5">
                    <dd className="font-tabular m-0 text-xl font-medium text-ink">{compatibles ?? "—"}</dd>
                    <dt className="text-xs text-ink-3">Compatibles</dt>
                  </div>
                  <div className="bg-surface px-2 py-2.5">
                    <dd className="font-tabular m-0 text-xl font-medium text-ink">{numPostulaciones}</dd>
                    <dt className="text-xs text-ink-3">Postulaciones</dt>
                  </div>
                </dl>

                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => verSugerencias(p.id)}>
                    <Sparkles className="h-4 w-4" /> Ver sugeridas
                  </Button>
                  <Button variant="secondary" onClick={() => abrirEditar(p)} aria-label={`Editar ${p.nombre}`}>
                    <PencilLine className="h-4 w-4" /> Editar
                  </Button>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" className="text-pri-text hover:bg-pri-soft" onClick={() => solicitarConsultor(p.id)}>
                    <UserPlus className="h-3.5 w-3.5" /> Solicitar consultor
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => eliminarProyecto(p)}
                    disabled={eliminando === p.id}
                    aria-label={`Eliminar ${p.nombre}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Nuevo proyecto: dos caminos, el de la IA destacado. */}
      {elegirAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4" onClick={() => setElegirAbierto(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-camino"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setElegirAbierto(false)}
            className="w-full max-w-[520px] rounded-md border border-line bg-surface p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="titulo-camino" className="font-display text-2xl font-semibold text-ink">
                Nuevo proyecto
              </h2>
              <button
                type="button"
                onClick={() => setElegirAbierto(false)}
                aria-label="Cerrar"
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-[4px] text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-2">¿Cómo quieres registrarlo?</p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                autoFocus
                onClick={elegirIA}
                className="flex min-h-[88px] w-full cursor-pointer items-start gap-4 rounded-md border-2 border-pri bg-pri-soft p-4 text-left hover:bg-pri-soft/70"
              >
                <Sparkles className="mt-0.5 h-6 w-6 flex-none text-pri-text" aria-hidden />
                <span>
                  <span className="block font-display text-lg font-semibold text-ink">Cuéntalo con tus palabras</span>
                  <span className="mt-0.5 block text-sm text-ink-2">
                    Escribe o dicta tu idea y la IA arma el proyecto. Usa {costoIA.toLocaleString("es-CO")} créditos.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={elegirFormulario}
                className="flex min-h-[88px] w-full cursor-pointer items-start gap-4 rounded-md border border-line-strong bg-surface p-4 text-left hover:bg-surface-2"
              >
                <PencilLine className="mt-0.5 h-6 w-6 flex-none text-ink-2" aria-hidden />
                <span>
                  <span className="block font-display text-lg font-semibold text-ink">Llenar el formulario</span>
                  <span className="mt-0.5 block text-sm text-ink-2">Unos 5 minutos. Sin costo.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {asistenteAbierto && (
        <AsistenteProyecto
          onCreado={alCrearConIA}
          onPropuesta={(p) => abrirFormulario(p)}
          onManual={() => abrirFormulario(null)}
          onClose={() => setAsistenteAbierto(false)}
        />
      )}
      {modalAbierto && (
        <ProyectoFormModal
          proyecto={editando}
          propuesta={editando ? null : propuesta}
          onCreado={!editando && propuesta ? alCrearConIA : undefined}
          onClose={() => setModalAbierto(false)}
        />
      )}

      {proyectoParaConsultor && (
        <SolicitarConsultorModal
          proyecto={proyectoParaConsultor}
          open={!!proyectoConsultorId}
          onClose={() => setProyectoConsultorId(null)}
        />
      )}
    </div>
  );
}
