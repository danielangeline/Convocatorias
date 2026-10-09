"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Ban, CheckCircle2, ClipboardList, Compass, FileCheck2, Mail, Star, Target, Undo2, Users, X } from "lucide-react";
import type { EncargoDetalle, PropuestaEncargo } from "@/lib/types";
import { pedir } from "@/lib/pedir";
import {
  cn,
  formatFecha,
  ESTADO_ENCARGO_LABEL,
  ESTADO_ENCARGO_ESTILO,
  ESTADO_PROPUESTA_LABEL,
  ESTADO_PROPUESTA_ESTILO,
  TIPO_AYUDA_LABEL,
  TIPO_AYUDA_ESTILO,
} from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RatingStars } from "@/components/RatingStars";

/**
 * CU-22..24 · Los encargos de la empresa. Los datos llegan del servidor con su
 * sesión (RN-30); retirar (RF-89) y calificar (RF-33) los valida la API y la
 * base, y la pantalla se recarga con `router.refresh()`. El correo del
 * consultor solo llega del servidor tras la aceptación (RF-70, RN-26).
 */
export function EncargosEmpresa({ encargos }: { encargos: EncargoDetalle[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aCalificar, setACalificar] = useState<EncargoDetalle | null>(null);
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState("");

  const retirar = async (e: EncargoDetalle) => {
    const quien = e.consultor ? e.consultor.nombre : "nuestro equipo";
    if (!window.confirm(`¿Retirar la solicitud "${e.tituloTarea}"? ${quien} ya no podrá atenderla.`)) return;
    setError(null);
    setOcupado(e.id);
    const r = await pedir(`/api/encargos/${e.id}/retirar`);
    setOcupado(null);
    if (!r.ok) setError(r.error);
    router.refresh();
  };

  const abrirCalificar = (e: EncargoDetalle) => {
    setError(null);
    setACalificar(e);
    setEstrellas(5);
    setComentario("");
  };

  const enviarCalificacion = async () => {
    if (!aCalificar) return;
    setOcupado(aCalificar.id);
    const r = await pedir(`/api/encargos/${aCalificar.id}/calificar`, { estrellas, comentario });
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setACalificar(null);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Mis encargos</h1>
        <p className="text-sm text-ink-soft">Consultores contratados o solicitados para tus proyectos.</p>
      </div>

      {error && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {encargos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          titulo="Aún no tienes encargos"
          descripcion="Desde la página de un proyecto puedes solicitar un consultor para una tarea específica."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {encargos.map((e) => (
            <div key={e.id} className="flex flex-col rounded-2xl border border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Badge className={ESTADO_ENCARGO_ESTILO[e.estado]}>{ESTADO_ENCARGO_LABEL[e.estado]}</Badge>
                <Badge className={TIPO_AYUDA_ESTILO[e.tipoAyuda]}>
                  {e.tipoAyuda === "convocatoria_especifica" ? <Target className="h-3 w-3" /> : <Compass className="h-3 w-3" />}
                  {TIPO_AYUDA_LABEL[e.tipoAyuda]}
                </Badge>
              </div>

              <h3 className="mt-3 font-display text-base font-semibold leading-snug text-ink">{e.tituloTarea}</h3>
              <p className="mt-1 text-xs text-ink-faint">
                Proyecto:{" "}
                <Link href={`/proyectos/${e.proyectoId}`} className="font-medium text-primary-700 hover:underline">
                  {e.proyectoNombre}
                </Link>
                {e.convocatoriaId && e.convocatoriaNombre && (
                  <>
                    {" · "}
                    <Link href={`/convocatorias/${e.convocatoriaId}`} className="font-medium text-teal-700 hover:underline">
                      {e.convocatoriaNombre}
                    </Link>
                  </>
                )}
              </p>
              {e.descripcionTarea && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{e.descripcionTarea}</p>}

              <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-4">
                {e.consultor ? (
                  <>
                    {e.consultor.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage (RNF-16)
                      <img src={e.consultor.fotoUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-line" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brick-50 text-xs font-bold text-brick-600">
                        {e.consultor.nombre.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <Link href={`/consultores/${e.consultor.id}`} className="text-sm font-medium text-ink hover:underline">
                      {e.consultor.nombre}
                    </Link>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-ink-faint">
                    <Users className="h-4 w-4" />
                    {e.estado === "atendido"
                      ? `Nuestro equipo te contactó por correo${e.atendidoAt ? ` el ${formatFecha(e.atendidoAt)}` : ""}`
                      : e.estado === "esperando_asignacion"
                        ? "Nuestro equipo la revisará y te escribirá por correo"
                        : "Solicitud a nuestro equipo"}
                  </span>
                )}
              </div>

              {e.estado === "pendiente" && (
                <p className="mt-2 text-xs text-ink-faint">
                  Su correo, sitio web y redes se muestran cuando acepte tu solicitud.
                </p>
              )}

              {e.correoContraparte && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
                  <Mail className="h-3.5 w-3.5 text-primary-700" />
                  <a href={`mailto:${e.correoContraparte}`} className="font-medium text-primary-700 hover:underline">
                    {e.correoContraparte}
                  </a>
                </p>
              )}

              {(e.fechas.aceptado || e.fechas.completado) && (
                <ul className="mt-3 space-y-0.5 text-xs text-ink-faint">
                  {e.fechas.aceptado && <li>Aceptado: {formatFecha(e.fechas.aceptado)}</li>}
                  {e.fechas.completado && <li>Completado: {formatFecha(e.fechas.completado)}</li>}
                </ul>
              )}

              {e.avances.length > 0 && (
                <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-medium text-ink-soft">
                    {e.avances.length} nota(s) de avance
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {e.avances.map((a) => (
                      <li key={a.id} className="whitespace-pre-line text-ink-soft">
                        <span className="font-medium text-ink-faint">{formatFecha(a.fecha)}:</span> {a.nota}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {e.tipoAyuda === "buscar_convocatoria" && e.consultor && (e.estado === "en_curso" || e.propuestas.length > 0) && (
                <Propuestas e={e} onError={setError} />
              )}

              {e.estado === "cancelado" && e.motivoCancelacion && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint">
                  <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e.motivoCancelacion}
                </p>
              )}

              <div className="mt-auto pt-4">
                {(e.estado === "pendiente" || e.estado === "esperando_asignacion") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-ink-soft"
                    disabled={ocupado === e.id}
                    onClick={() => retirar(e)}
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Retirar solicitud
                  </Button>
                )}

                {e.estado === "completado" && (
                  <Button variant="outline-gold" size="sm" className="w-full" onClick={() => abrirCalificar(e)}>
                    <Star className="h-3.5 w-3.5" /> Calificar
                  </Button>
                )}

                {e.estado === "calificado" && e.calificacion && (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <RatingStars valor={e.calificacion.estrellas} />
                    {e.calificacion.comentario && <p className="mt-1.5 text-xs text-ink-soft">{e.calificacion.comentario}</p>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {aCalificar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-calificar" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-calificar" className="font-display text-lg font-semibold text-ink">
                Calificar a {aCalificar.consultor?.nombre ?? "el consultor"}
              </h3>
              <button onClick={() => setACalificar(null)} className="text-ink-faint hover:text-ink" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Estrellas</p>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setEstrellas(n)} aria-label={`${n} estrellas`} aria-pressed={n === estrellas}>
                  <Star
                    className={cn("h-7 w-7", n <= estrellas ? "fill-gold-500 text-gold-500" : "fill-transparent text-line")}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            <label htmlFor="comentario-calificacion" className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Comentario (opcional)
            </label>
            <textarea
              id="comentario-calificacion"
              value={comentario}
              onChange={(ev) => setComentario(ev.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Cuéntanos cómo fue tu experiencia con este consultor"
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-ink-faint">La calificación no se puede cambiar después de enviarla.</p>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setACalificar(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={enviarCalificacion} disabled={ocupado === aCalificar.id}>
                Enviar calificación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * RF-92, RF-93, CU-22 pasos 5 a 7 · Las convocatorias que propuso el consultor,
 * con su nota y la compatibilidad calculada ahora. La empresa elige una: queda
 * como la convocatoria del encargo, que sigue en curso, y se le ofrece postular
 * con el proyecto; la postulación se vincula sola al encargo.
 */
function Propuestas({ e, onError }: { e: EncargoDetalle; onError: (error: string | null) => void }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const elegida = e.propuestas.find((p) => p.estado === "elegida");
  const abiertas = e.propuestas.filter((p) => p.estado === "propuesta");
  const visibles = elegida ? [elegida] : abiertas;

  const elegir = async (p: PropuestaEncargo) => {
    if (!window.confirm(`¿Elegir "${p.convocatoriaNombre}"? Quedará como la convocatoria de este encargo y no podrás cambiarla.`)) return;
    onError(null);
    setOcupado(true);
    const r = await pedir(`/api/encargos/${e.id}/propuestas/${p.id}/elegir`);
    setOcupado(false);
    if (!r.ok) onError(r.error);
    router.refresh();
  };

  // RF-17, RN-35: la crea el servidor o devuelve la que ya está en curso.
  const postular = async (convocatoriaId: string) => {
    onError(null);
    setOcupado(true);
    const r = await pedir<{ id: string; creada: boolean }>("/api/postulaciones", { convocatoriaId, proyectoId: e.proyectoId });
    setOcupado(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    router.push(`/postulaciones/${r.datos.id}${r.datos.creada ? "" : "?existente=1"}`);
    router.refresh();
  };

  return (
    <div className="mt-3 rounded-lg border border-brick-100 bg-brick-50/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brick-700">
        {elegida ? "Convocatoria elegida" : `Propuestas del consultor (${abiertas.length})`}
      </p>
      {visibles.length === 0 ? (
        <p className="mt-1 text-xs text-ink-soft">
          {e.estado === "en_curso" ? "El consultor aún no te ha propuesto convocatorias." : "No eligiste ninguna propuesta."}
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {visibles.map((p) => (
            <li key={p.id} className="text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={ESTADO_PROPUESTA_ESTILO[p.estado]}>
                  {p.estado === "elegida" && <CheckCircle2 className="h-3 w-3" />}
                  {ESTADO_PROPUESTA_LABEL[p.estado]}
                </Badge>
                {p.porcentaje !== null && <span className="font-semibold text-ink-soft">{p.porcentaje}% compatible</span>}
                {!p.vigente && <span className="text-ink-faint">· ya no está vigente</span>}
              </div>
              <Link href={`/convocatorias/${p.convocatoriaId}`} className="mt-1 block text-sm font-semibold text-teal-700 hover:underline">
                {p.convocatoriaNombre}
              </Link>
              <p className="text-ink-faint">
                {p.entidad} · cierra el {formatFecha(p.fechaCierre)}
              </p>
              <p className="mt-1 whitespace-pre-line text-ink-soft">{p.nota}</p>

              {p.estado === "propuesta" && e.estado === "en_curso" && (
                <Button variant="secondary" size="sm" className="mt-2" disabled={ocupado || !p.vigente} onClick={() => elegir(p)}>
                  Elegir esta convocatoria
                </Button>
              )}
              {p.estado === "elegida" && e.estado === "en_curso" && (
                e.postulacionId ? (
                  <Link
                    href={`/postulaciones/${e.postulacionId}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Ver la postulación
                  </Link>
                ) : (
                  <Button variant="primary" size="sm" className="mt-2" disabled={ocupado || !p.vigente} onClick={() => postular(p.convocatoriaId)}>
                    Postular con este proyecto
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
