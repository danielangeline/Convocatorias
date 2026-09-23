"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Wallet, Sparkles, UserPlus, FileStack, Users, X, Pencil } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccesoSuscripcion, useEncargosPropios, useProyectosPropios, useCategoriaPorId } from "@/lib/hooks";
import { diasRestantes, formatCOP } from "@/lib/utils";
import { Chip } from "@/components/ui/Chip";
import { Button, LinkButton } from "@/components/ui/Button";
import { CompletitudDetalle } from "@/components/CompletitudProyecto";
import { SolicitarConsultorModal } from "@/components/SolicitarConsultorModal";
import { ProyectoFormModal } from "@/components/ProyectoFormModal";
import type { CampoContenido } from "@/lib/proyectos";

export default function DetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const categoriaPorId = useCategoriaPorId();
  const { id } = use(params);
  const router = useRouter();
  const proyecto = useProyectosPropios().find((p) => p.id === id);
  const todosLosEncargos = useEncargosPropios();
  const encargos = todosLosEncargos.filter((e) => e.proyectoId === id);
  const todasLasConvocatorias = useAppStore((s) => s.convocatorias);
  const setProyectoParaGenerar = useAppStore((s) => s.setProyectoParaGenerar);
  const { requerirAcceso } = useAccesoSuscripcion();

  const [modalConsultorAbierto, setModalConsultorAbierto] = useState(false);
  const [modalGenerarAbierto, setModalGenerarAbierto] = useState(false);
  // RF-81: edición del proyecto desde su propia ficha, opcionalmente situada
  // en el campo que el indicador de completitud señala como faltante.
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [campoAEditar, setCampoAEditar] = useState<CampoContenido["clave"] | null>(null);

  const abrirEdicion = (clave?: CampoContenido["clave"]) => {
    setCampoAEditar(clave ?? null);
    setModalEditarAbierto(true);
  };

  const convocatoriasVigentes = useMemo(
    () => todasLasConvocatorias.filter((c) => c.estado === "publicada" && diasRestantes(c.fechaCierre) >= 0),
    [todasLasConvocatorias]
  );

  if (!proyecto) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">No encontramos este proyecto.</p>
        <Link href="/proyectos" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
          Volver a mis proyectos
        </Link>
      </div>
    );
  }

  const abrirFlujo = () => {
    if (!requerirAcceso("solicitar un consultor")) return;
    setModalConsultorAbierto(true);
  };

  const abrirSelectorGenerar = () => {
    if (!requerirAcceso("generar un documento con IA")) return;
    setModalGenerarAbierto(true);
  };

  const elegirConvocatoriaParaGenerar = (convocatoriaId: string) => {
    setProyectoParaGenerar(proyecto.id);
    setModalGenerarAbierto(false);
    router.push(`/convocatorias/${convocatoriaId}/generar`);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/proyectos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a mis proyectos
      </Link>

      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{proyecto.nombre}</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{proyecto.descripcion}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button variant="teal" size="lg" onClick={abrirSelectorGenerar}>
              <Sparkles className="h-4 w-4" /> Generar documento para una convocatoria...
            </Button>
            <Button variant="brick" size="lg" onClick={abrirFlujo}>
              <UserPlus className="h-4 w-4" /> Solicitar consultor
            </Button>
            <Button variant="ghost" size="lg" onClick={() => abrirEdicion()}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <CompletitudDetalle proyecto={proyecto} onCompletar={(clave) => abrirEdicion(clave)} />
        </div>

        <div className="mt-6 grid gap-4 rounded-xl bg-primary-50/60 p-5 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <Wallet className="h-3.5 w-3.5" /> Monto buscado
            </p>
            <p className="mt-1 font-tabular text-sm font-medium text-ink">{formatCOP(proyecto.montoBuscado)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <MapPin className="h-3.5 w-3.5" /> Ubicación
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{proyecto.ubicacion || "Sin ubicación"}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Categorías</p>
          <div className="flex flex-wrap gap-2">
            {proyecto.categorias.map((cid) => {
              const cat = categoriaPorId(cid);
              return cat ? (
                <Chip key={cid} tono={cat.tipo}>
                  {cat.nombre}
                </Chip>
              ) : null;
            })}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-line-soft pt-6">
          <p className="text-sm text-ink-soft">Cruza este proyecto contra el catálogo de convocatorias.</p>
          <LinkButton href={`/proyectos/${proyecto.id}/sugerencias`} variant="secondary">
            <Sparkles className="h-4 w-4" /> Ver sugerencias
          </LinkButton>
        </div>
      </div>

      {encargos.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line p-6">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <Users className="h-4 w-4 text-brick-600" /> Consultores en este proyecto
          </h2>
          <ul className="mt-3 divide-y divide-line-soft">
            {encargos.map((e) => (
              <li key={e.id} className="py-3 text-sm text-ink-soft">
                <Link href="/encargos" className="font-medium text-ink hover:text-primary-800">
                  {e.tituloTarea}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modalEditarAbierto && (
        <ProyectoFormModal
          proyecto={proyecto}
          campoInicial={campoAEditar}
          onClose={() => setModalEditarAbierto(false)}
        />
      )}

      <SolicitarConsultorModal
        proyecto={proyecto}
        open={modalConsultorAbierto}
        onClose={() => setModalConsultorAbierto(false)}
      />

      {modalGenerarAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">Elige una convocatoria vigente</h3>
              <button onClick={() => setModalGenerarAbierto(false)} className="text-ink-faint hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            {convocatoriasVigentes.length === 0 ? (
              <p className="text-sm text-ink-faint">No hay convocatorias vigentes en este momento.</p>
            ) : (
              <ul className="space-y-2">
                {convocatoriasVigentes.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => elegirConvocatoriaParaGenerar(c.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                        <FileStack className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">{c.nombre}</span>
                        <span className="block text-xs text-ink-faint">{c.entidadConvocante}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
