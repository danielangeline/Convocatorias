"use client";

import { use, useState } from "react";
import Link from "next/link";
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
import {
  dividirPorPendientes,
  extraerPendientes,
  exportarDocumentoWord,
  postulacionParaProyectoConv,
  ESTADO_DOCUMENTO_LABEL,
  ESTADO_DOCUMENTO_ESTILO,
  EJEMPLOS_AJUSTE,
} from "@/lib/documentos";
import { useAccesoSuscripcion, useCreditos, useConsultorActual } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { SeccionDocumento } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const documento = useAppStore((s) => s.documentos.find((d) => d.id === id));
  const proyecto = useAppStore((s) => (documento ? s.proyectos.find((p) => p.id === documento.proyectoId) : undefined));
  const convocatoria = useAppStore((s) => (documento ? s.convocatorias.find((c) => c.id === documento.convocatoriaId) : undefined));
  const postulaciones = useAppStore((s) => s.postulaciones);
  const promptVersiones = useAppStore((s) => s.promptVersiones);
  const encargos = useAppStore((s) => s.encargos);
  const consultores = useAppStore((s) => s.consultores);

  const actualizarSeccionDocumento = useAppStore((s) => s.actualizarSeccionDocumento);
  const marcarDocumentoExportado = useAppStore((s) => s.marcarDocumentoExportado);
  const regenerarDocumento = useAppStore((s) => s.regenerarDocumento);
  const aplicarAjusteIA = useAppStore((s) => s.aplicarAjusteIA);
  const consumirCredito = useAppStore((s) => s.consumirCredito);
  const abrirModalCreditos = useAppStore((s) => s.abrirModalCreditos);
  const compartirDocumento = useAppStore((s) => s.compartirDocumento);
  const revocarCompartirDocumento = useAppStore((s) => s.revocarCompartirDocumento);
  const { requerirAcceso, rol } = useAccesoSuscripcion();
  const { disponibles, usuarioId } = useCreditos();
  const { consultorId } = useConsultorActual();

  const [seccionActivaId, setSeccionActivaId] = useState<string | null>(null);
  const [seccionEditandoId, setSeccionEditandoId] = useState<string | null>(null);
  const [confirmandoRegenerar, setConfirmandoRegenerar] = useState(false);
  const [instruccion, setInstruccion] = useState("");
  const [ajustando, setAjustando] = useState(false);

  // RN-30: una empresa solo abre documentos propios; uno ajeno se trata como
  // inexistente para no confirmar que el identificador existe.
  const ajenoAEmpresa = rol === "empresa" && documento?.usuarioId !== usuarioId;

  if (!documento || !proyecto || !convocatoria || ajenoAEmpresa) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">No encontramos este documento.</p>
        <Link href="/documentos" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
          Volver a mis documentos
        </Link>
      </div>
    );
  }

  // RN-22/RN-27 (v5): un consultor solo ve este documento si está autorizado
  // explícitamente por la empresa — el encargo activo no es suficiente.
  const esConsultor = rol === "consultor";
  const autorizado = !esConsultor || (!!consultorId && documento.compartidoConConsultorId === consultorId);
  const autor: "empresa" | "consultor" = esConsultor ? "consultor" : "empresa";

  if (esConsultor && !autorizado) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EmptyState
          icon={Lock}
          titulo="No tienes acceso a este documento"
          descripcion="La empresa aún no te ha dado acceso a este documento. Pídele que lo comparta contigo desde la vista del documento."
        />
      </div>
    );
  }

  // Encargo en curso sobre este proyecto — usado para el interruptor de compartir
  // (empresa) y para saber a qué cupo de créditos cargar los ajustes del consultor.
  const encargoRelacionado = encargos.find(
    (e) => e.proyectoId === documento.proyectoId && e.estado === "en_curso" && e.consultorId
  );
  const consultorDelEncargo = encargoRelacionado?.consultorId
    ? consultores.find((c) => c.id === encargoRelacionado.consultorId)
    : undefined;
  // El crédito sale siempre del cupo de la empresa dueña del documento, también
  // cuando el ajuste lo pide el consultor: se resuelve por el propietario del
  // documento, sin respaldo que cargue el consumo a quien dispara la acción (RN-28, RN-30).
  const usuarioIdCredito = documento.usuarioId;

  const pendientes = extraerPendientes(documento.secciones);
  const postulacion = postulacionParaProyectoConv(documento.proyectoId, documento.convocatoriaId, postulaciones);
  const promptUsado = promptVersiones.find((p) => p.id === documento.promptVersionId);
  const ajustesGratisRestantes = Math.max(0, 3 - documento.ajustesGratisUsados);

  const irAPendiente = (seccionId: string) => {
    setSeccionActivaId(seccionId);
    setSeccionEditandoId(seccionId);
    const el = window.document.getElementById(`seccion-${seccionId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportar = () => {
    exportarDocumentoWord(documento);
    marcarDocumentoExportado(documento.id);
  };

  const confirmarRegenerar = () => {
    setConfirmandoRegenerar(false);
    if (!requerirAcceso("regenerar este documento")) return;
    if (disponibles <= 0) {
      abrirModalCreditos("regenerar este documento");
      return;
    }
    consumirCredito(usuarioId);
    regenerarDocumento(documento.id);
  };

  const enviarAjuste = () => {
    if (!instruccion.trim()) return;
    if (ajustesGratisRestantes === 0 && !esConsultor) {
      if (!requerirAcceso("pedir un ajuste a la IA")) return;
      if (disponibles <= 0) {
        abrirModalCreditos("pedir un ajuste a la IA");
        return;
      }
    }
    setAjustando(true);
    setTimeout(() => {
      if (ajustesGratisRestantes === 0) consumirCredito(usuarioIdCredito);
      aplicarAjusteIA(documento.id, instruccion.trim(), autor);
      setInstruccion("");
      setAjustando(false);
    }, 2000);
  };

  const alternarCompartir = () => {
    if (documento.compartidoConConsultorId) {
      revocarCompartirDocumento(documento.id);
    } else if (encargoRelacionado?.consultorId) {
      compartirDocumento(documento.id, encargoRelacionado.consultorId);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/documentos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a mis documentos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className={ESTADO_DOCUMENTO_ESTILO[documento.estado]}>{ESTADO_DOCUMENTO_LABEL[documento.estado]}</Badge>
            <span className="font-tabular text-xs text-ink-faint">versión {documento.version}</span>
            {promptUsado && <span className="text-xs text-ink-faint">· plantilla v{promptUsado.version}</span>}
          </div>
          <h1 className="mt-2 font-display text-xl font-bold leading-snug text-ink sm:text-2xl">{documento.titulo}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            <Link href={`/proyectos/${proyecto.id}`} className="font-medium text-primary-700 hover:underline">
              {proyecto.nombre}
            </Link>{" "}
            →{" "}
            <Link href={`/convocatorias/${convocatoria.id}`} className="font-medium text-primary-700 hover:underline">
              {convocatoria.nombre}
            </Link>
          </p>
          {postulacion && (
            <Link href={`/postulaciones/${postulacion.id}`} className="mt-1 inline-block text-xs font-semibold text-teal-700 hover:underline">
              Ver postulación relacionada →
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {esConsultor ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint ring-1 ring-inset ring-line">
              <Lock className="h-3.5 w-3.5" /> Puedes editar, pero no descargar ni regenerar
            </span>
          ) : (
            <>
              {encargoRelacionado?.consultorId && (
                <Button
                  variant={documento.compartidoConConsultorId ? "outline-gold" : "secondary"}
                  onClick={alternarCompartir}
                >
                  {documento.compartidoConConsultorId ? (
                    <>
                      <ShieldOff className="h-4 w-4" /> Dejar de compartir
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" /> Compartir con {consultorDelEncargo?.nombreProfesional ?? "el consultor"}
                    </>
                  )}
                </Button>
              )}
              <Button variant="secondary" onClick={exportar}>
                <Download className="h-4 w-4" /> Exportar a Word
              </Button>
              <Button variant="ghost" onClick={() => setConfirmandoRegenerar(true)}>
                <RotateCcw className="h-4 w-4" /> Regenerar
              </Button>
            </>
          )}
        </div>
      </div>

      {!esConsultor && documento.compartidoConConsultorId && consultorDelEncargo && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-700 ring-1 ring-inset ring-gold-200">
          <Share2 className="h-3.5 w-3.5" /> Compartido con {consultorDelEncargo.nombreProfesional}: puede leer, editar
          y pedir ajustes con IA, pero no descargarlo ni regenerarlo. Puedes dejar de compartirlo cuando quieras.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          {documento.secciones.map((seccion) => (
            <SeccionEditable
              key={seccion.id}
              seccion={seccion}
              resaltada={seccionActivaId === seccion.id}
              editando={seccionEditandoId === seccion.id}
              onIniciarEdicion={() => setSeccionEditandoId(seccion.id)}
              onCancelar={() => setSeccionEditandoId(null)}
              onGuardar={(contenido) => {
                actualizarSeccionDocumento(documento.id, seccion.id, contenido, autor);
                setSeccionEditandoId(null);
                if (seccionActivaId === seccion.id) setSeccionActivaId(null);
              }}
            />
          ))}

          <div className="rounded-2xl border border-teal-100 bg-teal-50/30 p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-teal-800">
              <Sparkles className="h-4 w-4" /> Pedir ajuste a la IA
            </p>
            <p className="mt-1 text-xs text-teal-800/70">
              {ajustesGratisRestantes > 0
                ? `${ajustesGratisRestantes} de 3 ajustes gratis restantes.`
                : "Ya usaste tus 3 ajustes gratis para este documento. El siguiente consumirá 1 crédito."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {EJEMPLOS_AJUSTE.map((ej) => (
                <button
                  key={ej}
                  onClick={() => setInstruccion(ej)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-200 hover:bg-teal-50"
                >
                  {ej}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={instruccion}
                onChange={(e) => setInstruccion(e.target.value)}
                placeholder="Ej. hazlo más breve"
                className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <Button variant="teal" onClick={enviarAjuste} disabled={!instruccion.trim() || ajustando}>
                {ajustando ? "Aplicando…" : "Aplicar ajuste"}
              </Button>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-xs text-ink-faint">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Este documento es una base editable. Verifícalo y complétalo antes de radicarlo en el portal de la
            entidad convocante.
          </p>
        </div>

        <aside className="h-max rounded-2xl border border-line p-5 lg:sticky lg:top-24">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ClipboardList className="h-4 w-4 text-amber-600" /> {pendientes.length} datos por completar
          </p>
          {pendientes.length === 0 ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-success">
              <FileCheck2 className="h-4 w-4" /> Todo el contenido está completo.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendientes.map((p, idx) => (
                <li key={`${p.seccionId}-${idx}`}>
                  <button
                    onClick={() => irAPendiente(p.seccionId)}
                    className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-100"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">Regenerar documento</h3>
              <button onClick={() => setConfirmandoRegenerar(false)} className="text-ink-faint hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-ink-soft">
              Esto consumirá 1 crédito y reescribirá el contenido a partir de los datos actuales del proyecto.
              Perderás las ediciones y ajustes que hayas hecho en esta versión.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmandoRegenerar(false)}>
                Cancelar
              </Button>
              <Button variant="teal" onClick={confirmarRegenerar}>
                Regenerar (1 crédito)
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
  onIniciarEdicion,
  onCancelar,
  onGuardar,
}: {
  seccion: SeccionDocumento;
  resaltada: boolean;
  editando: boolean;
  onIniciarEdicion: () => void;
  onCancelar: () => void;
  onGuardar: (contenido: string) => void;
}) {
  const partes = dividirPorPendientes(seccion.contenido);

  return (
    <div
      id={`seccion-${seccion.id}`}
      className={cn("scroll-mt-24 rounded-2xl border p-5", resaltada && !editando ? "border-amber-300" : "border-line")}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">{seccion.titulo}</h2>
        {!editando && (
          <button onClick={onIniciarEdicion} className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        )}
      </div>

      {editando ? (
        <EditorSeccion contenidoInicial={seccion.contenido} onCancelar={onCancelar} onGuardar={onGuardar} />
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
          {partes.map((parte, i) =>
            parte.pendiente ? (
              <span key={i} className="rounded bg-amber-200/60 px-1 font-medium text-amber-900">
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
  onCancelar,
  onGuardar,
}: {
  contenidoInicial: string;
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
        className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary-500"
        autoFocus
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" onClick={() => onGuardar(borrador)}>
          <Check className="h-3.5 w-3.5" /> Guardar
        </Button>
      </div>
    </div>
  );
}
