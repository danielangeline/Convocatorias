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
import { useAccesoSuscripcion, useCreditos, useProyectosPropios, useCategoriaPorId } from "@/lib/hooks";
import { calcularCompletitud } from "@/lib/proyectos";
import { cn } from "@/lib/utils";
import { CompletitudBadge } from "@/components/CompletitudProyecto";
import { Chip } from "@/components/ui/Chip";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const MENSAJES_CARGA = [
  "Leyendo los términos de referencia…",
  "Adaptando tu proyecto a la convocatoria…",
  "Marcando los datos pendientes…",
];

export default function GenerarDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const categoriaPorId = useCategoriaPorId();
  const { id } = use(params);
  const router = useRouter();
  const convocatoria = useAppStore((s) => s.convocatorias.find((c) => c.id === id));
  const proyectos = useProyectosPropios();
  const proyectoParaGenerar = useAppStore((s) => s.proyectoParaGenerar);
  const limpiarProyectoParaGenerar = useAppStore((s) => s.limpiarProyectoParaGenerar);
  const crearDocumento = useAppStore((s) => s.crearDocumento);
  const consumirCredito = useAppStore((s) => s.consumirCredito);
  const registrarGeneracionFallida = useAppStore((s) => s.registrarGeneracionFallida);
  const abrirModalCreditos = useAppStore((s) => s.abrirModalCreditos);
  const { requerirAcceso } = useAccesoSuscripcion();
  const { disponibles, usuarioId } = useCreditos();

  const [seleccionId, setSeleccionId] = useState<string | null>(proyectoParaGenerar);
  const [generando, setGenerando] = useState(false);
  const [mensajeIndex, setMensajeIndex] = useState(0);
  const [error, setError] = useState(false);
  const [forzarError, setForzarError] = useState(false);
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
  const completitudSeleccionado = proyectoSeleccionado ? calcularCompletitud(proyectoSeleccionado) : null;

  const iniciarGeneracion = () => {
    if (!seleccionId) return;
    if (!requerirAcceso("generar un documento con IA")) return;
    if (disponibles <= 0) {
      abrirModalCreditos("generar un documento con IA");
      return;
    }

    setError(false);
    setGenerando(true);
    setMensajeIndex(0);
    let i = 0;
    intervaloRef.current = setInterval(() => {
      i = (i + 1) % MENSAJES_CARGA.length;
      setMensajeIndex(i);
    }, 1100);

    setTimeout(() => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      setGenerando(false);

      if (forzarError) {
        setError(true);
        registrarGeneracionFallida();
        return;
      }

      const doc = crearDocumento(seleccionId, convocatoria.id);
      consumirCredito(usuarioId);
      router.push(`/documentos/${doc.id}`);
    }, 3600);
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
          Te quedan <strong>{disponibles}</strong> {disponibles === 1 ? "crédito" : "créditos"}. Generar consumirá 1.
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
            Ocurrió un error simulado durante la generación. No se descontó ningún crédito.
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

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setForzarError((v) => !v)}
              className="text-xs text-ink-faint/70 hover:text-ink-faint hover:underline"
            >
              {forzarError ? "Modo prueba: la próxima generación fallará" : "¿Ver cómo se ve un error? (modo prueba)"}
            </button>
            <Button variant="teal" size="lg" disabled={!seleccionId} onClick={iniciarGeneracion}>
              <Sparkles className="h-4 w-4" /> Generar documento
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
