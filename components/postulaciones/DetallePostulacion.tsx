"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, FileText, Info, Pencil, Sparkles, UserPlus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { EstadoPostulacion, PostulacionConConvocatoria, Proyecto } from "@/lib/types";
import { documentoParaProyectoConv, ESTADO_DOCUMENTO_LABEL, ESTADO_DOCUMENTO_ESTILO } from "@/lib/documentos";
import { useAccesoSuscripcion, useDocumentosPropios } from "@/lib/hooks";
import { cn, diasRestantes, formatFecha, ESTADO_POSTULACION_LABEL, ESTADO_POSTULACION_ESTILO, estadosAlcanzables, ESTADOS_POSTULACION_TERMINALES } from "@/lib/utils";
import { ETAPA_LABEL, etapaDe, type EtapaPostulacion } from "@/lib/etapas-postulacion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SolicitarConsultorModal } from "@/components/SolicitarConsultorModal";

/** Las cuatro etapas del stepper; «resuelta» se pinta como la última, completada. */
const ETAPAS_STEPPER: EtapaPostulacion[] = ["preparacion", "documentos", "lista", "radicada"];

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
  // CU-11 1c: el aviso sale una vez. Se quita `?existente=1` de la dirección
  // (recargar o compartir el enlace no lo repite) y la primera acción lo oculta.
  const [avisoExistente, setAvisoExistente] = useState(existente);
  useEffect(() => {
    if (existente) window.history.replaceState(null, "", window.location.pathname);
  }, [existente]);
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
        <p className="text-ink-2">No encontramos esta postulación.</p>
        <Link href="/postulaciones" className="mt-3 inline-block text-sm font-semibold text-pri-text hover:underline">
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
    setAvisoExistente(false);
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
    setAvisoExistente(false);
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
    setAvisoExistente(false);
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

  // Stepper de 4 etapas: sale de `etapaDe()` con el avance vivo del checklist,
  // así que marcar un requisito lo mueve al instante (RF-104).
  const etapa = etapaDe(postulacion.estado, completados, total);
  const indiceEtapa = etapa === "resuelta" ? 3 : Math.min(3, ETAPAS_STEPPER.indexOf(etapa));
  const pendientes = checklist.filter((i) => !i.completado);
  const completa = total > 0 && pendientes.length === 0;
  const puedeRadicar = alcanzables.includes("presentada");
  const dias = convocatoria ? diasRestantes(convocatoria.fechaCierre) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <div>
        <Link
          href="/postulaciones"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-pri-text"
        >
          <ArrowLeft className="h-4 w-4" /> Postulaciones
        </Link>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[.06em] text-ink-3">
          {convocatoria?.entidadConvocante ?? "—"} · {proyecto ? `Proyecto: ${proyecto.nombre}` : "Sin proyecto asociado"}
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink sm:text-[30px]">
            {convocatoria?.nombre ?? "Convocatoria no disponible"}
          </h1>
          <Badge className={ESTADO_POSTULACION_ESTILO[postulacion.estado]}>{ESTADO_POSTULACION_LABEL[postulacion.estado]}</Badge>
        </div>
      </div>

      {/* Stepper horizontal: hecha = relleno con ✓, actual = borde y número, futura = borde suave. */}
      <ol aria-label="Etapas de la postulación" className="m-0 flex list-none items-start rounded-md border border-line bg-surface p-4 sm:px-6">
        {ETAPAS_STEPPER.map((e, i) => {
          const hecha = i < indiceEtapa || (etapa === "resuelta" && i === 3);
          const actual = i === indiceEtapa && !hecha;
          return (
            <li key={e} className="flex flex-1 flex-col items-center gap-2 text-center first:items-start last:items-end sm:items-center">
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= indiceEtapa ? "bg-pri" : "bg-line")} />
                <span
                  aria-current={actual ? "step" : undefined}
                  className={cn(
                    "font-tabular grid h-7 w-7 flex-none place-items-center rounded-full border-2 text-xs font-medium",
                    hecha ? "border-pri bg-pri text-on-pri" : actual ? "border-pri text-pri-text" : "border-line text-ink-3"
                  )}
                >
                  {hecha ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-label="Hecha" /> : i + 1}
                </span>
                <span className={cn("h-0.5 flex-1", i === ETAPAS_STEPPER.length - 1 ? "bg-transparent" : i < indiceEtapa ? "bg-pri" : "bg-line")} />
              </div>
              <span className={cn("text-xs leading-tight", actual ? "font-semibold text-ink" : "text-ink-3")}>{ETAPA_LABEL[e]}</span>
            </li>
          );
        })}
      </ol>

      {avisoExistente && (
        <p className="flex items-start gap-2 rounded-[4px] bg-pri-soft px-4 py-2.5 text-sm text-pri-text">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Ya tenías esta postulación en curso con el mismo proyecto, así que la abrimos en lugar de crear otra.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-[4px] bg-rose-soft px-4 py-2.5 text-sm text-rose">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-6">
          <section aria-labelledby="req-titulo" className="rounded-md border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="req-titulo" className="font-display text-xl font-semibold text-ink">
                Requisitos
              </h2>
              <span className="font-tabular text-sm font-medium text-ink-2">
                {completados} de {total}
              </span>
            </div>
            <ProgressBar porcentaje={porcentaje} altura={6} className="mt-3" />
            {cerrada && <p className="mt-3 text-xs text-ink-3">La postulación está cerrada: el checklist queda como constancia y ya no se modifica.</p>}
            <ul className="m-0 mt-3 list-none divide-y divide-line-2 p-0">
              {checklist.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.completado}
                    onClick={() => marcar(item.id, !item.completado)}
                    disabled={cerrada}
                    className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 py-2 text-left transition-colors enabled:hover:bg-surface-2 disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 flex-none place-items-center rounded-[4px] border-2",
                        item.completado ? "border-pri bg-pri text-on-pri" : "border-line-strong bg-surface"
                      )}
                    >
                      {item.completado && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("text-[15px]", item.completado ? "text-ink-3 line-through" : "text-ink")}>{item.descripcion}</span>
                      {item.obligatorio && !item.completado && <span className="ml-2 text-xs font-semibold text-ink-3">Obligatorio</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="doc-ia" className="rounded-md border border-line bg-surface p-5 sm:p-6">
            <h2 id="doc-ia" className="font-display text-xl font-semibold text-ink">
              Documento con IA
            </h2>
            {documento ? (
              <button
                onClick={irAGenerarOEditar}
                className="mt-3 flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[4px] border border-pri bg-pri-soft px-4 py-3 text-left hover:bg-pri-soft/70"
              >
                <FileText className="h-5 w-5 flex-none text-pri-text" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{documento.titulo}</span>
                  <span className="font-tabular block text-xs text-ink-3">v{documento.version}</span>
                </span>
                <Badge className={ESTADO_DOCUMENTO_ESTILO[documento.estado]}>{ESTADO_DOCUMENTO_LABEL[documento.estado]}</Badge>
                <Pencil className="h-4 w-4 shrink-0 text-pri-text" aria-hidden />
              </button>
            ) : postulacion.proyectoId ? (
              <button
                onClick={irAGenerarOEditar}
                className="mt-3 flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[4px] border border-dashed border-pri bg-pri-soft px-4 py-3 text-left hover:bg-pri-soft/70"
              >
                <Sparkles className="h-5 w-5 flex-none text-pri-text" aria-hidden />
                <span className="flex-1 text-sm font-semibold text-pri-text">Generar documento con IA para esta postulación</span>
              </button>
            ) : (
              <div className="mt-3 rounded-[4px] border border-dashed border-line-strong px-4 py-3">
                <p className="text-sm text-ink-2">
                  Vincula un proyecto para poder generar el documento con IA o solicitar un consultor. El proyecto se vincula una sola vez: después no se
                  puede cambiar.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={proyectoParaVincular}
                    onChange={(e) => setProyectoParaVincular(e.target.value)}
                    aria-label="Proyecto a vincular"
                    className="min-h-11 flex-1 rounded-[4px] border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-pri"
                  >
                    <option value="">Selecciona un proyecto...</option>
                    {proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <Button variant="primary" size="sm" onClick={vincularYContinuar} disabled={!proyectoParaVincular || ocupado}>
                    Vincular y generar
                  </Button>
                  <Button variant="outline" size="sm" onClick={vincularYSolicitarConsultor} disabled={!proyectoParaVincular || ocupado}>
                    Vincular y solicitar consultor
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:sticky lg:top-20">
          {/* Siguiente paso: lo que sigue ahora, según el avance real. */}
          <section aria-labelledby="sig-paso" className="rounded-md bg-pri-soft p-5">
            <h2 id="sig-paso" className="font-display text-xl font-semibold text-ink">
              Siguiente paso
            </h2>
            {cerrada ? (
              <p className="mt-2 text-sm text-ink-2">Esta postulación está cerrada.</p>
            ) : completa ? (
              <>
                <p className="mt-2 text-[15px] font-semibold text-ink">Ya puedes radicar</p>
                <p className="mt-1 text-sm text-ink-2">Todos los requisitos están listos. La radicación se hace en el portal de la entidad.</p>
                <div className="mt-4 flex flex-col gap-2">
                  {convocatoria?.urlPostulacion && (
                    <a href={convocatoria.urlPostulacion} target="_blank" rel="noreferrer">
                      <Button variant="primary" size="lg" className="w-full">
                        <ExternalLink className="h-4 w-4" /> Ir al portal oficial
                      </Button>
                    </a>
                  )}
                  {puedeRadicar && postulacion.estado === "en_preparacion" && (
                    <Button variant="outline" className="w-full" disabled={ocupado} onClick={() => pedirCambioEstado("presentada")}>
                      Marcar como radicada
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-[15px] font-semibold text-ink">
                  Te faltan {pendientes.length} {pendientes.length === 1 ? "requisito" : "requisitos"}
                </p>
                <ul className="m-0 mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {pendientes.slice(0, 3).map((i) => (
                    <li key={i.id}>{i.descripcion}</li>
                  ))}
                </ul>
                {pendientes.length > 3 && <p className="mt-1 text-xs text-ink-3">y {pendientes.length - 3} más</p>}
                {dias !== null && dias >= 0 && (
                  <p className={cn("mt-3 text-xs font-semibold", dias < 10 ? "text-rose" : "text-ink-3")}>
                    Cierra en {dias} {dias === 1 ? "día" : "días"} · {formatFecha(convocatoria!.fechaCierre)}
                  </p>
                )}
              </>
            )}
            <p className="mt-3 text-xs text-ink-3">La plataforma no radica por ti: aquí preparas y haces seguimiento.</p>
          </section>

          <section className="rounded-md border border-line bg-surface p-5">
            <label htmlFor="cambiar-estado" className="block text-[13px] font-semibold text-ink">
              Estado de la postulación
            </label>
            <select
              id="cambiar-estado"
              value={postulacion.estado}
              onChange={(e) => pedirCambioEstado(e.target.value as EstadoPostulacion)}
              disabled={alcanzables.length === 0 || ocupado}
              className="mt-1.5 min-h-11 w-full rounded-[4px] border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-pri disabled:bg-surface-2 disabled:text-ink-3"
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
              <p className="mt-1.5 text-xs text-ink-3">Esta postulación ya está cerrada: no admite más cambios de estado.</p>
            )}
            {proyecto && (
              <Button variant="ghost" className="mt-3 w-full text-pri-text hover:bg-pri-soft" onClick={abrirSolicitudConsultor}>
                <UserPlus className="h-4 w-4" /> Pedir ayuda a un consultor
              </Button>
            )}
          </section>

          <section aria-labelledby="historial" className="rounded-md border border-line bg-surface p-5">
            <h2 id="historial" className="font-display text-xl font-semibold text-ink">
              Historial
            </h2>
            <ol className="m-0 mt-3 list-none space-y-3 p-0">
              {postulacion.historial.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <span className="font-tabular w-[72px] flex-none pt-px text-xs text-ink-3">{formatFecha(h.fecha)}</span>
                  <span className="text-ink">
                    {h.estadoAnterior ? (
                      <>
                        {ESTADO_POSTULACION_LABEL[h.estadoAnterior]} → {ESTADO_POSTULACION_LABEL[h.estadoNuevo]}
                      </>
                    ) : (
                      <>Creada · {ESTADO_POSTULACION_LABEL[h.estadoNuevo]}</>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-cerrar" className="w-full max-w-md rounded-md border border-line bg-surface p-6 shadow-card">
            <h3 id="titulo-cerrar" className="font-display text-xl font-semibold text-ink">
              ¿Cerrar esta postulación?
            </h3>
            <p className="mt-2 text-sm leading-[1.55] text-ink-2">
              Una postulación cerrada deja de admitir cambios de estado. El checklist, el historial y el documento generado se conservan, pero no podrás
              reabrirla desde aquí.
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
