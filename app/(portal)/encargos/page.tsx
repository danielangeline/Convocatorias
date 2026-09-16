"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Star, X, User, Mail, Target, Compass, Ban } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useEncargosPropios, useProyectosPropios } from "@/lib/hooks";
import {
  formatFecha,
  ESTADO_ENCARGO_LABEL,
  ESTADO_ENCARGO_ESTILO,
  TIPO_AYUDA_LABEL,
  TIPO_AYUDA_ESTILO,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RatingStars } from "@/components/RatingStars";

const CONTACTO_VISIBLE = new Set(["en_curso", "completado", "calificado"]);

export default function EncargosPage() {
  const encargos = useEncargosPropios();
  const proyectos = useProyectosPropios();
  const consultores = useAppStore((s) => s.consultores);
  const convocatorias = useAppStore((s) => s.convocatorias);
  const calificaciones = useAppStore((s) => s.calificaciones);
  const calificarEncargo = useAppStore((s) => s.calificarEncargo);

  const [encargoAcalificar, setEncargoAcalificar] = useState<string | null>(null);
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState("");

  const abrirCalificar = (encargoId: string) => {
    setEncargoAcalificar(encargoId);
    setEstrellas(5);
    setComentario("");
  };

  const enviarCalificacion = () => {
    if (!encargoAcalificar) return;
    calificarEncargo(encargoAcalificar, estrellas, comentario);
    setEncargoAcalificar(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Mis encargos</h1>
        <p className="text-sm text-ink-soft">Consultores contratados o solicitados para tus proyectos.</p>
      </div>

      {encargos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          titulo="Aún no tienes encargos"
          descripcion="Desde la página de un proyecto puedes solicitar un consultor para una tarea específica."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {encargos.map((e) => {
            const proyecto = proyectos.find((p) => p.id === e.proyectoId);
            const consultor = e.consultorId ? consultores.find((c) => c.id === e.consultorId) : undefined;
            const convocatoria = e.convocatoriaId ? convocatorias.find((c) => c.id === e.convocatoriaId) : undefined;
            const calificacion = calificaciones.find((c) => c.encargoId === e.id);

            return (
              <div key={e.id} className="flex flex-col rounded-2xl border border-line p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Badge className={ESTADO_ENCARGO_ESTILO[e.estado]}>{ESTADO_ENCARGO_LABEL[e.estado]}</Badge>
                  <Badge className={TIPO_AYUDA_ESTILO[e.tipoAyuda]}>
                    {e.tipoAyuda === "convocatoria_especifica" ? (
                      <Target className="h-3 w-3" />
                    ) : (
                      <Compass className="h-3 w-3" />
                    )}
                    {TIPO_AYUDA_LABEL[e.tipoAyuda]}
                  </Badge>
                </div>

                <h3 className="mt-3 font-display text-base font-semibold leading-snug text-ink">{e.tituloTarea}</h3>
                <p className="mt-1 text-xs text-ink-faint">
                  Proyecto:{" "}
                  <Link href={`/proyectos/${e.proyectoId}`} className="font-medium text-primary-700 hover:underline">
                    {proyecto?.nombre ?? "Proyecto no disponible"}
                  </Link>
                  {convocatoria && (
                    <>
                      {" · "}
                      <Link href={`/convocatorias/${convocatoria.id}`} className="font-medium text-teal-700 hover:underline">
                        {convocatoria.nombre}
                      </Link>
                    </>
                  )}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{e.descripcionTarea}</p>

                <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-4">
                  {consultor ? (
                    <>
                      <img src={consultor.fotoUrl} alt="" className="h-8 w-8 rounded-full ring-1 ring-line" />
                      <span className="text-sm font-medium text-ink">{consultor.nombreProfesional}</span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-ink-faint">
                      <User className="h-4 w-4" /> Esperando asignación de nuestro equipo
                    </span>
                  )}
                </div>

                {consultor && CONTACTO_VISIBLE.has(e.estado) && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
                    <Mail className="h-3.5 w-3.5 text-primary-700" />
                    <a href={`mailto:${consultor.correo}`} className="font-medium text-primary-700 hover:underline">
                      {consultor.correo}
                    </a>
                  </p>
                )}

                {(e.estado === "en_curso" || e.estado === "completado" || e.estado === "calificado") && (
                  <ul className="mt-3 space-y-0.5 text-xs text-ink-faint">
                    {e.fechas.aceptado && <li>Aceptado: {formatFecha(e.fechas.aceptado)}</li>}
                    {e.fechas.completado && <li>Completado: {formatFecha(e.fechas.completado)}</li>}
                    {e.avances.length > 0 && <li>{e.avances.length} nota(s) de avance registradas</li>}
                  </ul>
                )}

                {e.estado === "cancelado" && e.motivoCancelacion && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint">
                    <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e.motivoCancelacion}
                  </p>
                )}

                {e.estado === "completado" && (
                  <Button variant="outline-gold" size="sm" className="mt-4 w-full" onClick={() => abrirCalificar(e.id)}>
                    <Star className="h-3.5 w-3.5" /> Calificar
                  </Button>
                )}

                {e.estado === "calificado" && calificacion && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <RatingStars valor={calificacion.estrellas} />
                    {calificacion.comentario && <p className="mt-1.5 text-xs text-ink-soft">{calificacion.comentario}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {encargoAcalificar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">Calificar encargo</h3>
              <button onClick={() => setEncargoAcalificar(null)} className="text-ink-faint hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Estrellas</p>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setEstrellas(n)} aria-label={`${n} estrellas`}>
                  <Star
                    className={cn("h-7 w-7", n <= estrellas ? "fill-gold-500 text-gold-500" : "fill-transparent text-line")}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            <label className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Comentario
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              placeholder="Cuéntanos cómo fue tu experiencia con este consultor"
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
            />

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEncargoAcalificar(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={enviarCalificacion}>
                Enviar calificación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
