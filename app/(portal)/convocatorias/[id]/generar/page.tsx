"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  FolderKanban,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { textoCreditos, useAccesoSuscripcion, useCreditos, useDocumentosPropios, useProyectosPropios, useCategoriaPorId, useTarifas } from "@/lib/hooks";
import { documentoParaProyectoConv } from "@/lib/documentos";
import { pedir } from "@/lib/pedir";
import { calcularCompletitud } from "@/lib/proyectos";
import { cn } from "@/lib/utils";
import { CompletitudBadge } from "@/components/CompletitudProyecto";
import { Chip } from "@/components/ui/Chip";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const MENSAJES_CARGA = [
  "Leyendo los términos de referencia…",
  "Adaptando tu proyecto a la convocatoria…",
  "Redactando las secciones…",
  "Marcando los datos pendientes…",
  "Esto puede tardar hasta dos minutos…",
];

export default function GenerarDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const categoriaPorId = useCategoriaPorId();
  const { id } = use(params);
  const router = useRouter();
  const convocatoria = useAppStore((s) => s.convocatorias.find((c) => c.id === id));
  const proyectos = useProyectosPropios();
  const proyectoParaGenerar = useAppStore((s) => s.proyectoParaGenerar);
  const limpiarProyectoParaGenerar = useAppStore((s) => s.limpiarProyectoParaGenerar);
  const abrirModalCreditos = useAppStore((s) => s.abrirModalCreditos);
  const documentos = useDocumentosPropios();
  const { requerirAcceso } = useAccesoSuscripcion();
  const { disponibles } = useCreditos();
  // RN-17: generar cuesta la tarifa vigente (100 al iniciar la sesión 030).
  const costo = useTarifas().generacion;

  const [seleccionId, setSeleccionId] = useState<string | null>(proyectoParaGenerar);
  const [generando, setGenerando] = useState(false);
  const [mensajeIndex, setMensajeIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (proyectoParaGenerar) limpiarProyectoParaGenerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, []);

  if (!convocatoria) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">No encontramos esta convocatoria.</p>
        <Link href="/convocatorias" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const proyectoSeleccionado = proyectos.find((p) => p.id === seleccionId);
  // RF-53, RF-61: si el par ya tiene documento, generar crea una versión nueva y conserva la anterior.
  const documentoExistente = seleccionId ? documentoParaProyectoConv(seleccionId, convocatoria.id, documentos) : undefined;
  const completitudSeleccionado = proyectoSeleccionado ? calcularCompletitud(proyectoSeleccionado) : null;

  // CU-33 · El servidor reserva el crédito, llama a la IA y solo cobra si sale
  // bien (RN-17). La pantalla no decide nada: muestra el progreso y el motivo.
  const iniciarGeneracion = async () => {
    if (!seleccionId) return;
    if (!requerirAcceso("generar un documento con IA")) return;
    if (disponibles < costo) {
      abrirModalCreditos("generar un documento con IA");
      return;
    }

    setError(null);
    setGenerando(true);
    setMensajeIndex(0);
    let i = 0;
    intervaloRef.current = setInterval(() => {
      i = Math.min(i + 1, MENSAJES_CARGA.length - 1);
      setMensajeIndex(i);
    }, 8000);

    const r = await pedir<{ id: string }>("/api/documentos/generar", { proyectoId: seleccionId, convocatoriaId: convocatoria.id });
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    if (!r.ok) {
      setGenerando(false);
      setError(r.error);
      router.refresh();
      return;
    }
    router.push(`/documentos/${r.datos.id}`);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/convocatorias/${convocatoria.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a la convocatoria
      </Link>

      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <Sparkles className="h-3.5 w-3.5" /> Generar documento con IA
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">{convocatoria.nombre}</h1>
        <p className="mt-1 text-sm text-ink-soft">{convocatoria.entidadConvocante}</p>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/60 px-5 py-3">
        <p className="text-sm text-teal-800">
          Te quedan <strong>{textoCreditos(disponibles)}</strong>. Generar consumirá {textoCreditos(costo)}.
        </p>
      </div>

      {generando ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-teal-100 bg-teal-50/30 px-6 py-20 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          <p className="mt-5 font-display text-base font-semibold text-ink">Generando tu documento…</p>
          <p className="mt-1.5 text-sm text-ink-soft">{MENSAJES_CARGA[mensajeIndex]}</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-danger/30 bg-danger-bg px-6 py-16 text-center">
          <XCircle className="h-10 w-10 text-danger" />
          <p className="mt-4 font-display text-base font-semibold text-danger">No pudimos generar el documento</p>
          <p className="mt-1.5 max-w-sm text-sm text-danger/90">
            {error}
          </p>
          <Button variant="danger" className="mt-5" onClick={iniciarGeneracion}>
            <RotateCcw className="h-4 w-4" /> Reintentar
          </Button>
        </div>
      ) : proyectos.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          titulo="Aún no tienes proyectos"
          descripcion="Crea un proyecto con la información de tu empresa para poder generar un documento con IA."
          accion={
            <LinkButton href="/proyectos" variant="primary">
              Crear proyecto
            </LinkButton>
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm font-semibold text-ink">Elige el proyecto para este documento</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {proyectos.map((p) => {
              const activo = seleccionId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSeleccionId(p.id)}
                  className={cn(
                    "flex flex-col rounded-2xl border p-5 text-left transition-colors",
                    activo ? "border-teal-500 bg-teal-50/40 ring-1 ring-teal-200" : "border-line hover:border-teal-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-ink">{p.nombre}</h3>
                    <CompletitudBadge proyecto={p} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.categorias.slice(0, 3).map((cid) => {
                      const cat = categoriaPorId(cid);
                      return cat ? (
                        <Chip key={cid} tono={cat.tipo}>
                          {cat.nombre}
                        </Chip>
                      ) : null;
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          {documentoExistente && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
              <p className="text-sm text-teal-900">
                Ya tienes un documento de este proyecto para esta convocatoria (versión {documentoExistente.version}).{" "}
                <Link href={`/documentos/${documentoExistente.id}`} className="font-semibold underline">
                  Editar documento
                </Link>
                . Si generas de nuevo, se crea la versión {documentoExistente.version + 1} y la anterior se conserva.
              </p>
            </div>
          )}

          {proyectoSeleccionado && completitudSeleccionado && completitudSeleccionado.porcentaje < 50 && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">
                Este proyecto tiene poco contenido diligenciado ({completitudSeleccionado.porcentaje}%). El documento
                tendrá varios datos marcados como pendientes.{" "}
                <Link href={`/proyectos/${proyectoSeleccionado.id}`} className="font-semibold underline">
                  Completar proyecto
                </Link>
              </p>
            </div>
          )}

          <p className="mt-6 text-xs text-ink-faint">
            El contenido del proyecto y de la convocatoria se procesa con un proveedor externo de IA. El documento es
            una base: los datos que falten quedan marcados como pendientes, nunca se inventan.
          </p>
          <div className="mt-3 flex items-center justify-end">
            <Button variant="teal" size="lg" disabled={!seleccionId} onClick={iniciarGeneracion}>
              <Sparkles className="h-4 w-4" /> {documentoExistente ? `Generar versión nueva (${textoCreditos(costo)})` : `Generar documento (${textoCreditos(costo)})`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
