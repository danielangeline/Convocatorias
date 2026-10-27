"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Wallet, Sparkles, UserPlus, FileStack, Users, X, Pencil } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccesoSuscripcion, useEncargosPropios } from "@/lib/hooks";
import { diasRestantes, formatCOP } from "@/lib/utils";
import { Chip } from "@/components/ui/Chip";
import { Button, LinkButton } from "@/components/ui/Button";
import { CompletitudDetalle } from "@/components/CompletitudProyecto";
import { SolicitarConsultorModal } from "@/components/SolicitarConsultorModal";
import { ProyectoFormModal, type CampoEditable } from "@/components/ProyectoFormModal";
import { CAMPOS_CONTENIDO, campoContenidoCompleto } from "@/lib/proyectos";
import { AvisoCreadoConIA } from "./AvisoCreadoConIA";
import type { Categoria, Proyecto } from "@/lib/types";
import { textoUbicacionProyecto } from "@/lib/departamentos";

/**
 * CU-09 · Ficha del proyecto. El proyecto llega del servidor, leído con la
 * sesión de la empresa (RN-30). RF-81: el indicador de completitud abre la
 * edición en el campo que falta.
 */
export function FichaProyecto({
  proyecto,
  categorias,
  editar = null,
  creadoConIa = false,
}: {
  proyecto: Proyecto | null;
  categorias: Categoria[];
  /** CU-10 2a: las sugerencias llegan aquí con `?editar=<campo>` para completar el dato que falta. */
  editar?: CampoEditable | null;
  /** RF-98: recién creado con IA; se muestra el aviso para revisar cada parte. */
  creadoConIa?: boolean;
}) {
  const categoriaPorId = (id: string) => categorias.find((c) => c.id === id);
  const router = useRouter();
  const todosLosEncargos = useEncargosPropios();
  const encargos = todosLosEncargos.filter((e) => e.proyectoId === proyecto?.id);
  const todasLasConvocatorias = useAppStore((s) => s.convocatorias);
  const setProyectoParaGenerar = useAppStore((s) => s.setProyectoParaGenerar);
  const { requerirAcceso } = useAccesoSuscripcion();

  const [modalConsultorAbierto, setModalConsultorAbierto] = useState(false);
  const [modalGenerarAbierto, setModalGenerarAbierto] = useState(false);
  // RF-81: edición del proyecto desde su propia ficha, opcionalmente situada
  // en el campo que el indicador de completitud señala como faltante.
  const [modalEditarAbierto, setModalEditarAbierto] = useState(editar !== null);
  const [campoAEditar, setCampoAEditar] = useState<CampoEditable | null>(editar);

  const abrirEdicion = (clave?: CampoEditable) => {
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
        <p className="text-ink-2">No encontramos este proyecto.</p>
        <Link href="/proyectos" className="mt-3 inline-block text-sm font-semibold text-pri-text hover:underline">
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
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-pri-text"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a mis proyectos
      </Link>

      {creadoConIa && <AvisoCreadoConIA proyectoId={proyecto.id} />}

      <div className="rounded-2xl border border-line p-6 sm:p-8 bg-surface shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">{proyecto.nombre}</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{proyecto.descripcion}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button variant="ai" size="lg" onClick={abrirSelectorGenerar}>
              <Sparkles className="h-4 w-4" /> Generar documento para una convocatoria...
            </Button>
            <Button variant="consultor" size="lg" onClick={abrirFlujo}>
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

        <div className="mt-6 grid gap-4 rounded-xl bg-pri-soft/60 p-5 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
              <Wallet className="h-3.5 w-3.5" /> Monto buscado
              <BotonEditar etiqueta="Editar el monto buscado" onClick={() => abrirEdicion("montoBuscado")} />
            </p>
            <p className="mt-1 font-tabular text-sm font-medium text-ink">
              {proyecto.montoBuscado != null ? formatCOP(proyecto.montoBuscado) : "Sin definir"}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
              <MapPin className="h-3.5 w-3.5" /> Ubicación
              <BotonEditar etiqueta="Editar la ubicación" onClick={() => abrirEdicion("departamento")} />
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{textoUbicacionProyecto(proyecto) || "Sin ubicación"}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
            Categorías
            <BotonEditar etiqueta="Editar las categorías" onClick={() => abrirEdicion("categorias")} />
          </p>
          {proyecto.categorias.length === 0 && (
            <p className="text-sm font-semibold text-amber-ink">Sin categorías: agrégalas para mejorar las sugerencias.</p>
          )}
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

        <section className="mt-8" aria-labelledby="contenido-proyecto">
          <h2 id="contenido-proyecto" className="text-[15px] font-extrabold text-ink">
            Contenido del proyecto
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            Es lo que usa la IA para el documento base de cada postulación. Edita cada parte con su lápiz.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CAMPOS_CONTENIDO.map((c) => {
              const completo = campoContenidoCompleto(proyecto, c.clave);
              return (
                <div
                  key={c.clave}
                  className={
                    completo
                      ? "rounded-xl border border-line bg-surface p-4"
                      : "rounded-xl border border-dashed border-amber/50 bg-amber/5 p-4"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[13px] font-bold text-ink">{c.etiqueta}</h3>
                    <BotonEditar etiqueta={`Editar ${c.etiqueta.toLowerCase()}`} onClick={() => abrirEdicion(c.clave)} />
                  </div>
                  {completo ? (
                    <ValorContenido proyecto={proyecto} clave={c.clave} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrirEdicion(c.clave)}
                      className="mt-1.5 cursor-pointer text-[13px] font-semibold text-amber-ink hover:underline"
                    >
                      Falta · completar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-8 flex items-center justify-between border-t border-line-2 pt-6">
          <p className="text-sm text-ink-2">Cruza este proyecto contra el catálogo de convocatorias.</p>
          <LinkButton href={`/proyectos/${proyecto.id}/sugerencias`} variant="secondary">
            <Sparkles className="h-4 w-4" /> Ver sugerencias
          </LinkButton>
        </div>
      </div>

      {encargos.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line p-6 bg-surface shadow-card">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <Users className="h-4 w-4 text-sky-ink" /> Consultores en este proyecto
          </h2>
          <ul className="mt-3 divide-y divide-line-2">
            {encargos.map((e) => (
              <li key={e.id} className="py-3 text-sm text-ink-2">
                <Link href="/encargos" className="font-medium text-ink hover:text-pri-text">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-generar" className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-generar" className="font-display text-lg font-semibold text-ink">Elige una convocatoria vigente</h3>
              <button onClick={() => setModalGenerarAbierto(false)} className="text-ink-3 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            {convocatoriasVigentes.length === 0 ? (
              <p className="text-sm text-ink-3">No hay convocatorias vigentes en este momento.</p>
            ) : (
              <ul className="space-y-2">
                {convocatoriasVigentes.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => elegirConvocatoriaParaGenerar(c.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left transition-colors hover:border-violet/30 hover:bg-violet/10"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet/10 text-violet-ink">
                        <FileStack className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">{c.nombre}</span>
                        <span className="block text-xs text-ink-3">{c.entidadConvocante}</span>
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

function BotonEditar({ etiqueta, onClick }: { etiqueta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="ml-auto grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-lg text-ink-3 normal-case tracking-normal hover:bg-surface-2 hover:text-ink"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
}

/** Valor de un campo de contenido, legible: listas, meses y pesos. */
function ValorContenido({ proyecto, clave }: { proyecto: Proyecto; clave: (typeof CAMPOS_CONTENIDO)[number]["clave"] }) {
  const valor = proyecto[clave];
  if (Array.isArray(valor)) {
    return (
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-ink-2">
        {valor.filter((v) => v.trim()).map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    );
  }
  if (clave === "duracionMeses") return <p className="font-tabular mt-1.5 text-[13px] text-ink-2">{String(valor)} meses</p>;
  if (clave === "presupuestoEstimado" && typeof valor === "number") {
    return <p className="font-tabular mt-1.5 text-[13px] text-ink-2">{formatCOP(valor)}</p>;
  }
  return <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{String(valor ?? "")}</p>;
}
