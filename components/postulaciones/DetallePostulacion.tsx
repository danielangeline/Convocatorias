"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Wallet,
  CheckSquare,
  Square,
  FileText,
  Sparkles,
  Pencil,
  ExternalLink,
  UserPlus,
  Info,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { EstadoPostulacion, PostulacionConConvocatoria, Proyecto } from "@/lib/types";
import { documentoParaProyectoConv, ESTADO_DOCUMENTO_LABEL, ESTADO_DOCUMENTO_ESTILO } from "@/lib/documentos";
import { useAccesoSuscripcion, useDocumentosPropios } from "@/lib/hooks";
import { formatFecha, ESTADO_POSTULACION_LABEL, ESTADO_POSTULACION_ESTILO, estadosAlcanzables, ESTADOS_POSTULACION_TERMINALES, formatRangoCOP } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SolicitarConsultorModal } from "@/components/SolicitarConsultorModal";
import { textoCobertura } from "@/lib/departamentos";

type Respuesta = { ok: true; datos: unknown } | { ok: false; error: string };

async function pedir(url: string, method: "PATCH" | "POST", cuerpo: unknown): Promise<Respuesta> {
  const respuesta = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  const json = respuesta ? await respuesta.json().catch(() => ({})) : {};
  if (!respuesta?.ok) return { ok: false, error: json.error ?? "No pudimos completar la acción. Intenta de nuevo." };
  return { ok: true, datos: json.datos };
}

/**
 * CU-12, CU-13 · Detalle de la postulación. Los datos llegan del servidor, leídos
 * con la sesión de la empresa (RN-30); cada cambio —marcar el checklist, cambiar
 * el estado, vincular el proyecto— lo valida la API y la base (RF-18, RF-83,
 * RN-35), y la pantalla se recarga con `router.refresh()`.
 */
export function DetallePostulacion({
  postulacion,
  proyectos,
  existente,
}: {
  postulacion: PostulacionConConvocatoria | null;
  proyectos: Proyecto[];
  existente: boolean;
}) {
  const router = useRouter();
  const convocatoria = postulacion?.convocatoria ?? null;
  const proyecto = postulacion?.proyectoId ? proyectos.find((p) => p.id === postulacion.proyectoId) : undefined;
  // Marcas aún no confirmadas por el servidor, para que el clic se vea al instante.
  const [marcas, setMarcas] = useState<Record<string, boolean>>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setProyectoParaGenerar = useAppStore((s) => s.setProyectoParaGenerar);
  const documentos = useDocumentosPropios();
  const { requerirAcceso } = useAccesoSuscripcion();
  const [proyectoParaVincular, setProyectoParaVincular] = useState("");
  const [modalConsultorAbierto, setModalConsultorAbierto] = useState(false);
  // RF-83: los estados terminales se confirman antes de aplicarse.
  const [estadoAConfirmar, setEstadoAConfirmar] = useState<EstadoPostulacion | null>(null);

  if (!postulacion) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">No encontramos esta postulación.</p>
        <Link href="/postulaciones" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
          Volver a mis postulaciones
        </Link>
      </div>
    );
  }

  const checklist = postulacion.checklist.map((i) => ({ ...i, completado: marcas[i.id] ?? i.completado }));
  const total = checklist.length;
  const completados = checklist.filter((i) => i.completado).length;
  // RN-35, CU-12 2a: cerrada, el checklist es de solo lectura.
  const cerrada = postulacion.estado === "cerrada";
  const porcentaje = total ? Math.round((completados / total) * 100) : 0;

  // RF-83: solo se ofrecen los estados a los que se puede llegar desde el
  // actual, y los terminales pasan por una confirmación.
  const alcanzables = estadosAlcanzables(postulacion.estado);

  const aplicarEstado = async (nuevo: EstadoPostulacion, confirmado: boolean) => {
    setError(null);
    setOcupado(true);
    const r = await pedir(`/api/postulaciones/${postulacion.id}/estado`, "POST", { estado: nuevo, confirmado });
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  };

  const pedirCambioEstado = (nuevo: EstadoPostulacion) => {
    if (nuevo === postulacion.estado) return;
    if (ESTADOS_POSTULACION_TERMINALES.includes(nuevo)) {
      setEstadoAConfirmar(nuevo);
      return;
    }
    void aplicarEstado(nuevo, false);
  };

  const confirmarCambioEstado = () => {
    if (!estadoAConfirmar) return;
    const nuevo = estadoAConfirmar;
    setEstadoAConfirmar(null);
    void aplicarEstado(nuevo, true);
  };

  // RF-18 · Marca o desmarca; si el servidor lo rechaza, vuelve a lo que había.
  const marcar = async (itemId: string, completado: boolean) => {
    setError(null);
    setMarcas((m) => ({ ...m, [itemId]: completado }));
    const r = await pedir(`/api/checklist/${itemId}`, "PATCH", { completado });
    if (!r.ok) {
      setMarcas((m) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== itemId)));
      setError(r.error);
      return;
    }
    router.refresh();
  };

  // CU-13 3a/5a, RN-35 · Vincula el proyecto (una sola vez) antes de continuar.
  const vincular = async (): Promise<boolean> => {
    if (!proyectoParaVincular) return false;
    setError(null);
    setOcupado(true);
    const r = await pedir(`/api/postulaciones/${postulacion.id}`, "PATCH", { proyectoId: proyectoParaVincular });
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    router.refresh();
    return true;
  };
  const documento = postulacion.proyectoId
    ? documentoParaProyectoConv(postulacion.proyectoId, postulacion.convocatoriaId, documentos)
    : undefined;

  const irAGenerarOEditar = () => {
    if (documento) {
      router.push(`/documentos/${documento.id}`);
      return;
    }
    if (!postulacion.proyectoId) return; // el botón de abajo pide vincular uno primero
    if (!requerirAcceso("generar un documento con IA")) return;
    setProyectoParaGenerar(postulacion.proyectoId);
    router.push(`/convocatorias/${postulacion.convocatoriaId}/generar`);
  };

  const vincularYContinuar = async () => {
    if (!(await vincular())) return;
    if (!requerirAcceso("generar un documento con IA")) return;
    setProyectoParaGenerar(proyectoParaVincular);
    router.push(`/convocatorias/${postulacion.convocatoriaId}/generar`);
  };

  const abrirSolicitudConsultor = () => {
    if (!requerirAcceso("solicitar un consultor")) return;
    setModalConsultorAbierto(true);
  };

  const vincularYSolicitarConsultor = async () => {
    if (!(await vincular())) return;
    if (!requerirAcceso("solicitar un consultor")) return;
    setModalConsultorAbierto(true);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/postulaciones"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a mis postulaciones
      </Link>

      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className={ESTADO_POSTULACION_ESTILO[postulacion.estado]}>
              {ESTADO_POSTULACION_LABEL[postulacion.estado]}
            </Badge>
            <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-ink">
              {convocatoria?.nombre ?? "Convocatoria no disponible"}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {proyecto ? `Proyecto: ${proyecto.nombre}` : "Sin proyecto asociado"}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-56">
            {/* RF-73: radicar en el portal de la entidad es la acción principal
                de esta pantalla; todo lo demás queda por debajo. */}
            {convocatoria?.urlPostulacion && (
              <a href={convocatoria.urlPostulacion} target="_blank" rel="noreferrer" className="w-full">
                <Button variant="primary" size="lg" className="w-full">
                  <ExternalLink className="h-4 w-4" /> Ir al portal de la entidad
                </Button>
              </a>
            )}
            {proyecto && (
              <Button variant="ghost" className="w-full text-brick-600 hover:bg-brick-50" onClick={abrirSolicitudConsultor}>
                <UserPlus className="h-4 w-4" /> Solicitar consultor
              </Button>
            )}
            <div>
              <label htmlFor="cambiar-estado" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Cambiar estado
              </label>
              <select
                id="cambiar-estado"
                value={postulacion.estado}
                onChange={(e) => pedirCambioEstado(e.target.value as EstadoPostulacion)}
                disabled={alcanzables.length === 0 || ocupado}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-slate-50 disabled:text-ink-faint"
              >
                {/* RF-83: solo los estados alcanzables desde el actual. */}
                <option value={postulacion.estado}>{ESTADO_POSTULACION_LABEL[postulacion.estado]}</option>
                {alcanzables.map((estado) => (
                  <option key={estado} value={estado}>
                    {ESTADO_POSTULACION_LABEL[estado]}
                  </option>
                ))}
              </select>
              {alcanzables.length === 0 && (
                <p className="mt-1.5 text-xs text-ink-faint">
                  Esta postulación ya está cerrada: no admite más cambios de estado.
                </p>
              )}
            </div>
          </div>
        </div>

        {existente && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-primary-50 px-4 py-2.5 text-sm text-primary-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Ya tenías esta postulación en curso con el mismo proyecto, así que la abrimos en lugar de crear otra.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-brick-50 px-4 py-2.5 text-sm text-brick-700">
            {error}
          </p>
        )}

        <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-line px-4 py-2.5 text-xs text-ink-faint">
          La postulación se radica en el portal de la entidad convocante. Esta plataforma te ayuda a prepararla, pero no la presenta por ti.
        </p>

        {convocatoria && (
          <div className="mt-6 flex flex-wrap gap-6 border-y border-line-soft py-4 text-sm text-ink-soft">
            <span className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              <span className="font-tabular">
                {formatRangoCOP(convocatoria.montoMin, convocatoria.montoMax)}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {textoCobertura(convocatoria)}
            </span>
            <span>Cierra el {formatFecha(convocatoria.fechaCierre)}</span>
          </div>
        )}

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Checklist de la postulación</h2>
            <span className="font-tabular text-sm font-semibold text-primary-800">
              {completados}/{total} · {porcentaje}%
            </span>
          </div>
          <ProgressBar porcentaje={porcentaje} className="mb-4" />
          {cerrada && (
            <p className="mb-3 text-xs text-ink-faint">La postulación está cerrada: el checklist queda como constancia y ya no se modifica.</p>
          )}
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => marcar(item.id, !item.completado)}
                  disabled={cerrada}
                  aria-pressed={item.completado}
                  className="flex w-full items-start gap-3 rounded-lg border border-line-soft px-4 py-3 text-left transition-colors enabled:hover:border-primary-200 enabled:hover:bg-primary-50/30 disabled:cursor-default"
                >
                  {item.completado ? (
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                  ) : (
                    <Square className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                  )}
                  <span>
                    <span className={item.completado ? "text-sm text-ink-faint line-through" : "text-sm text-ink"}>
                      {item.descripcion}
                    </span>
                    {item.obligatorio && (
                      <span className="ml-2 text-xs font-medium text-gold-700">obligatorio</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <h2 className="font-display text-base font-semibold text-ink">Documento generado con IA</h2>

          {documento ? (
            <button
              onClick={irAGenerarOEditar}
              className="mt-3 flex w-full items-center gap-3 rounded-lg border border-teal-100 bg-teal-50/40 px-4 py-3 text-left transition-colors hover:bg-teal-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                <FileText className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-ink">{documento.titulo}</span>
                <span className="block text-xs text-ink-faint">Versión {documento.version}</span>
              </span>
              <Badge className={ESTADO_DOCUMENTO_ESTILO[documento.estado]}>{ESTADO_DOCUMENTO_LABEL[documento.estado]}</Badge>
              <Pencil className="h-4 w-4 shrink-0 text-teal-700" />
            </button>
          ) : postulacion.proyectoId ? (
            <button
              onClick={irAGenerarOEditar}
              className="mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-teal-200 bg-teal-50/20 px-4 py-3 text-left transition-colors hover:bg-teal-50/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-medium text-teal-800">Generar documento con IA para esta postulación</span>
            </button>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-line px-4 py-3">
              <p className="text-sm text-ink-soft">
                Vincula un proyecto para poder generar el documento con IA o solicitar un consultor. El proyecto se
                vincula una sola vez: después no se puede cambiar.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  value={proyectoParaVincular}
                  onChange={(e) => setProyectoParaVincular(e.target.value)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
                >
                  <option value="">Selecciona un proyecto...</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <Button variant="teal" size="sm" onClick={vincularYContinuar} disabled={!proyectoParaVincular || ocupado}>
                  Vincular y generar
                </Button>
                <Button variant="brick" size="sm" onClick={vincularYSolicitarConsultor} disabled={!proyectoParaVincular || ocupado}>
                  Vincular y solicitar consultor
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="font-display text-base font-semibold text-ink">Línea de tiempo</h2>
          <ol className="mt-4 space-y-0">
            {postulacion.historial.map((h, idx) => (
              <li key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
                {idx !== postulacion.historial.length - 1 && (
                  <span className="absolute left-[7px] top-4 h-full w-px bg-line" />
                )}
                <span className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary-700 bg-white" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {h.estadoAnterior ? (
                      <>
                        {ESTADO_POSTULACION_LABEL[h.estadoAnterior]} → {ESTADO_POSTULACION_LABEL[h.estadoNuevo]}
                      </>
                    ) : (
                      <>Postulación creada · {ESTADO_POSTULACION_LABEL[h.estadoNuevo]}</>
                    )}
                  </p>
                  <p className="text-xs text-ink-faint">{formatFecha(h.fecha)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {proyecto && (
        <SolicitarConsultorModal
          proyecto={proyecto}
          open={modalConsultorAbierto}
          onClose={() => setModalConsultorAbierto(false)}
          convocatoriaFijaId={postulacion.convocatoriaId}
        />
      )}

      {/* RF-83: confirmación antes de una transición terminal. */}
      {estadoAConfirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-semibold text-ink">
              ¿Cerrar esta postulación?
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              Una postulación cerrada deja de admitir cambios de estado. El checklist, el historial y el
              documento generado se conservan, pero no podrás reabrirla desde aquí.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEstadoAConfirmar(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirmarCambioEstado}>
                Sí, cerrar postulación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
