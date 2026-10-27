"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Sparkles,
  Pencil,
  Check,
  X,
  AlertTriangle,
  ClipboardList,
  FileCheck2,
  Share2,
  ShieldOff,
  Lock,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { dividirPorPendientes, extraerPendientes, ESTADO_DOCUMENTO_LABEL, ESTADO_DOCUMENTO_ESTILO, EJEMPLOS_AJUSTE } from "@/lib/documentos";
import { textoCreditos, useAccesoSuscripcion, useCreditos, useTarifas } from "@/lib/hooks";
import { pedir } from "@/lib/pedir";
import { cn } from "@/lib/utils";
import type { DocumentoServidor, SeccionDocumento } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * CU-34 · Revisar, editar, ajustar con IA y exportar un documento generado.
 * Lo usan la empresa dueña y el consultor autorizado (RN-22): el consultor no
 * ve exportar, regenerar ni compartir. La pantalla no decide nada: cada acción
 * va al servidor, que vuelve a comprobar acceso, cupo y dueño (RNF-20).
 */
export function EditorDocumento({
  documento: inicial,
  rol,
  consultorEncargo,
  volverHref,
  volverTexto,
  proyectoHref,
  convocatoriaHref,
}: {
  documento: DocumentoServidor;
  rol: "empresa" | "consultor";
  /** Empresa: el consultor con encargo en curso sobre el proyecto, a quien puede autorizar (RF-71). */
  consultorEncargo?: { id: string; nombre: string } | null;
  volverHref: string;
  volverTexto: string;
  proyectoHref?: string;
  convocatoriaHref?: string;
}) {
  const router = useRouter();
  const abrirModalCreditos = useAppStore((s) => s.abrirModalCreditos);
  const { requerirAcceso } = useAccesoSuscripcion();
  const { disponibles } = useCreditos();
  // RN-17: tarifas vigentes del ajuste (desde el cuarto) y de regenerar.
  const tarifas = useTarifas();
  const esConsultor = rol === "consultor";

  const [documento, setDocumento] = useState(inicial);
  const [seccionActivaId, setSeccionActivaId] = useState<string | null>(null);
  const [seccionEditandoId, setSeccionEditandoId] = useState<string | null>(null);
  const [confirmandoRegenerar, setConfirmandoRegenerar] = useState(false);
  const [instruccion, setInstruccion] = useState("");
  const [ocupado, setOcupado] = useState<null | "guardar" | "ajustar" | "regenerar" | "exportar" | "compartir">(null);
  const [error, setError] = useState<string | null>(null);

  const pendientes = extraerPendientes(documento.secciones);
  const ajustesGratisRestantes = Math.max(0, 3 - documento.ajustesUsados);

  const irAPendiente = (seccionId: string) => {
    setSeccionActivaId(seccionId);
    setSeccionEditandoId(seccionId);
    window.document.getElementById(`seccion-${seccionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // RF-58 · Edición libre, sin costo.
  const guardarSeccion = async (seccionId: string, contenido: string) => {
    setOcupado("guardar");
    setError(null);
    const secciones = documento.secciones.map((s) => (s.id === seccionId ? { ...s, contenido } : s));
    const r = await pedir<DocumentoServidor>(`/api/documentos/${documento.id}`, { secciones }, "PATCH");
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    setDocumento(r.datos);
    setSeccionEditandoId(null);
    if (seccionActivaId === seccionId) setSeccionActivaId(null);
    router.refresh();
  };

  // RF-59, RF-77 · Ajuste con IA: el servidor decide si es gratis o cobra a la empresa dueña.
  const enviarAjuste = async () => {
    if (!instruccion.trim()) return;
    if (!esConsultor && ajustesGratisRestantes === 0) {
      if (!requerirAcceso("pedir un ajuste a la IA")) return;
      if (disponibles < tarifas.ajuste) return abrirModalCreditos("pedir un ajuste a la IA");
    }
    setOcupado("ajustar");
    setError(null);
    const r = await pedir<DocumentoServidor>(`/api/documentos/${documento.id}/ajustar`, { indicacion: instruccion.trim() });
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    setDocumento(r.datos);
    setInstruccion("");
    router.refresh();
  };

  // CU-34 5a · Regenerar: versión nueva, la anterior se conserva (RF-61).
  const confirmarRegenerar = async () => {
    setConfirmandoRegenerar(false);
    if (!requerirAcceso("regenerar este documento")) return;
    if (disponibles < tarifas.generacion) return abrirModalCreditos("regenerar este documento");
    setOcupado("regenerar");
    setError(null);
    const r = await pedir<{ id: string }>("/api/documentos/generar", {
      proyectoId: documento.proyectoId,
      convocatoriaId: documento.convocatoriaId,
    });
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    router.push(`/documentos/${r.datos.id}`);
    router.refresh();
  };

  // RF-60, RF-72 · Solo la empresa dueña descarga el .docx.
  const exportar = async () => {
    setOcupado("exportar");
    setError(null);
    const respuesta = await fetch(`/api/documentos/${documento.id}/exportar`).catch(() => null);
    setOcupado(null);
    if (!respuesta?.ok) {
      const json = respuesta ? await respuesta.json().catch(() => ({})) : {};
      return setError(json.error ?? "No pudimos exportar el documento. Intenta de nuevo.");
    }
    const nombre = /filename="([^"]+)"/.exec(respuesta.headers.get("Content-Disposition") ?? "")?.[1] ?? "documento.docx";
    const url = URL.createObjectURL(await respuesta.blob());
    const enlace = window.document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    window.document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
    setDocumento((d) => ({ ...d, estado: "exportado" }));
    router.refresh();
  };

  // RF-71 · Autorizar o quitar al consultor del encargo en curso.
  const alternarCompartir = async () => {
    setOcupado("compartir");
    setError(null);
    const r = documento.compartidoConConsultorId
      ? await pedir<DocumentoServidor>(`/api/documentos/${documento.id}/revocar`)
      : await pedir<DocumentoServidor>(`/api/documentos/${documento.id}/compartir`, { consultorId: consultorEncargo?.id });
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    setDocumento(r.datos);
    router.refresh();
  };

  const compartidoConEncargo = !!documento.compartidoConConsultorId && documento.compartidoConConsultorId === consultorEncargo?.id;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={volverHref} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-pri-text">
        <ArrowLeft className="h-4 w-4" /> {volverTexto}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge className={ESTADO_DOCUMENTO_ESTILO[documento.estado]}>{ESTADO_DOCUMENTO_LABEL[documento.estado]}</Badge>
            <span className="font-tabular text-xs text-ink-3">versión {documento.version}</span>
          </div>
          <h1 className="mt-2 font-display text-xl font-bold leading-snug text-ink sm:text-2xl">{documento.titulo}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {proyectoHref ? (
              <Link href={proyectoHref} className="font-medium text-pri-text hover:underline">
                {documento.proyectoNombre}
              </Link>
            ) : (
              documento.proyectoNombre
            )}{" "}
            →{" "}
            {convocatoriaHref ? (
              <Link href={convocatoriaHref} className="font-medium text-pri-text hover:underline">
                {documento.convocatoriaNombre}
              </Link>
            ) : (
              documento.convocatoriaNombre
            )}
          </p>
          {!esConsultor && documento.postulacionId && (
            <Link href={`/postulaciones/${documento.postulacionId}`} className="mt-1 inline-block text-xs font-semibold text-violet-ink hover:underline">
              Ver postulación relacionada →
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {esConsultor ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-3 ring-1 ring-inset ring-line">
              <Lock className="h-3.5 w-3.5" /> Puedes editar y pedir ajustes, pero no descargar ni regenerar
            </span>
          ) : (
            <>
              {consultorEncargo && (
                <Button variant={compartidoConEncargo ? "outline-amber" : "secondary"} onClick={alternarCompartir} disabled={ocupado !== null}>
                  {compartidoConEncargo ? (
                    <>
                      <ShieldOff className="h-4 w-4" /> Dejar de compartir
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" /> Compartir con {consultorEncargo.nombre}
                    </>
                  )}
                </Button>
              )}
              <Button variant="secondary" onClick={exportar} disabled={ocupado !== null}>
                <Download className="h-4 w-4" /> {ocupado === "exportar" ? "Preparando…" : "Exportar a Word"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmandoRegenerar(true)} disabled={ocupado !== null}>
                <RotateCcw className="h-4 w-4" /> {ocupado === "regenerar" ? "Regenerando…" : "Regenerar"}
              </Button>
            </>
          )}
        </div>
      </div>

      {!esConsultor && compartidoConEncargo && consultorEncargo && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber-ink ring-1 ring-inset ring-amber/30">
          <Share2 className="h-3.5 w-3.5 shrink-0" /> Compartido con {consultorEncargo.nombre}: puede leer, editar y pedir ajustes con IA
          (que se cobran a tu cupo), pero no descargarlo ni regenerarlo. Pierde el acceso al terminar el encargo.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose-ink">
          {error}
        </p>
      )}

      {ocupado === "regenerar" && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet/30 bg-violet/10 px-4 py-3 text-sm text-violet-ink">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet/30 border-t-violet" />
          Generando la versión nueva. Puede tardar hasta dos minutos; si falla, no se descuenta ningún crédito.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-5">
          {documento.secciones.map((seccion) => (
            <SeccionEditable
              key={`${documento.actualizadoAt}-${seccion.id}`}
              seccion={seccion}
              resaltada={seccionActivaId === seccion.id}
              editando={seccionEditandoId === seccion.id}
              guardando={ocupado === "guardar"}
              onIniciarEdicion={() => setSeccionEditandoId(seccion.id)}
              onCancelar={() => setSeccionEditandoId(null)}
              onGuardar={(contenido) => guardarSeccion(seccion.id, contenido)}
            />
          ))}

          <div className="rounded-2xl border border-violet/30 bg-violet/10 p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-ink">
              <Sparkles className="h-4 w-4" /> Pedir ajuste a la IA
            </p>
            <p className="mt-1 text-xs text-violet-ink/70">
              {ajustesGratisRestantes > 0
                ? `${ajustesGratisRestantes} de 3 ajustes gratis restantes.`
                : esConsultor
                  ? `Ya se usaron los 3 ajustes gratis de este documento. Cada ajuste más consume ${textoCreditos(tarifas.ajuste)} de la empresa.`
                  : `Ya usaste tus 3 ajustes gratis para este documento. Cada ajuste más consume ${textoCreditos(tarifas.ajuste)}.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {EJEMPLOS_AJUSTE.map((ej) => (
                <button
                  key={ej}
                  onClick={() => setInstruccion(ej)}
                  className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-violet-ink ring-1 ring-inset ring-violet/30 hover:bg-violet/10"
                >
                  {ej}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={instruccion}
                onChange={(e) => setInstruccion(e.target.value)}
                maxLength={1000}
                placeholder="Ej. hazlo más breve"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-violet"
              />
              <Button variant="ai" onClick={enviarAjuste} disabled={!instruccion.trim() || ocupado !== null}>
                {ocupado === "ajustar" ? "Aplicando… (hasta 2 min)" : "Aplicar ajuste"}
              </Button>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-xs text-ink-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Este documento es una base generada con IA y sujeta a revisión humana. Verifícalo y complétalo antes de
            radicarlo en el portal de la entidad convocante.
          </p>
        </div>

        <aside className="h-max rounded-2xl border border-line p-5 lg:sticky lg:top-24 bg-surface shadow-card">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ClipboardList className="h-4 w-4 text-amber-ink" /> {pendientes.length} datos por completar
          </p>
          {pendientes.length === 0 ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-pri-text">
              <FileCheck2 className="h-4 w-4" /> Todo el contenido está completo.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendientes.map((p, idx) => (
                <li key={`${p.seccionId}-${idx}`}>
                  <button
                    onClick={() => irAPendiente(p.seccionId)}
                    className="w-full rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-left text-xs text-amber-ink hover:bg-amber/20"
                  >
                    <span className="block font-semibold">{p.seccionTitulo}</span>
                    <span className="block">{p.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {confirmandoRegenerar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-regenerar" className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-regenerar" className="font-display text-lg font-semibold text-ink">Regenerar documento</h3>
              <button onClick={() => setConfirmandoRegenerar(false)} className="text-ink-3 hover:text-ink" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-ink-2">
              Esto consumirá {textoCreditos(tarifas.generacion)} y creará la versión {documento.version + 1} a partir de los datos actuales del
              proyecto. Esta versión, con sus ediciones, se conserva.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmandoRegenerar(false)}>
                Cancelar
              </Button>
              <Button variant="ai" onClick={confirmarRegenerar}>
                Regenerar ({textoCreditos(tarifas.generacion)})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeccionEditable({
  seccion,
  resaltada,
  editando,
  guardando,
  onIniciarEdicion,
  onCancelar,
  onGuardar,
}: {
  seccion: SeccionDocumento;
  resaltada: boolean;
  editando: boolean;
  guardando: boolean;
  onIniciarEdicion: () => void;
  onCancelar: () => void;
  onGuardar: (contenido: string) => void;
}) {
  const partes = dividirPorPendientes(seccion.contenido);

  return (
    <div id={`seccion-${seccion.id}`} className={cn("scroll-mt-24 rounded-2xl border p-5", resaltada && !editando ? "border-amber/30" : "border-line")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-ink">{seccion.titulo}</h2>
        {!editando && (
          <button onClick={onIniciarEdicion} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-pri-text hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        )}
      </div>

      {editando ? (
        <EditorSeccion contenidoInicial={seccion.contenido} guardando={guardando} onCancelar={onCancelar} onGuardar={onGuardar} />
      ) : (
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-2">
          {partes.map((parte, i) =>
            parte.pendiente ? (
              <span key={i} className="rounded bg-amber-200/60 px-1 font-medium text-amber-ink">
                {parte.texto}
              </span>
            ) : (
              <span key={i}>{parte.texto}</span>
            )
          )}
        </p>
      )}
    </div>
  );
}

function EditorSeccion({
  contenidoInicial,
  guardando,
  onCancelar,
  onGuardar,
}: {
  contenidoInicial: string;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (contenido: string) => void;
}) {
  const [borrador, setBorrador] = useState(contenidoInicial);

  return (
    <div>
      <textarea
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        rows={Math.max(3, Math.ceil(borrador.length / 70))}
        className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-pri bg-surface text-ink"
        autoFocus
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" onClick={() => onGuardar(borrador)} disabled={guardando}>
          <Check className="h-3.5 w-3.5" /> {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
