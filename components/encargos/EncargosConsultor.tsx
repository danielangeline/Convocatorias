"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Compass,
  ExternalLink,
  Mail,
  Search,
  Target,
  X as XIcon,
} from "lucide-react";
import type { ContextoEncargo, EncargoConsultor } from "@/lib/types";
import { pedir } from "@/lib/pedir";
import { nombreDepartamento } from "@/lib/departamentos";
import {
  cn,
  formatCOP,
  formatFecha,
  ESTADO_ENCARGO_LABEL,
  ESTADO_ENCARGO_ESTILO,
  TIPO_AYUDA_LABEL,
  TIPO_AYUDA_ESTILO,
} from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RatingStars } from "@/components/RatingStars";

type Pestana = "solicitudes" | "en_curso" | "historial";

/**
 * CU-18 · Bandeja del consultor en tres pestañas. Los datos llegan del
 * servidor con su sesión; aceptar, rechazar, registrar avances y completar los
 * valida la base (RF-30, RF-32), y la pantalla se recarga con
 * `router.refresh()`. El correo de la empresa solo llega tras aceptar (RF-70).
 */
export function EncargosConsultor({ encargos }: { encargos: EncargoConsultor[] }) {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>("solicitudes");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const solicitudes = encargos.filter((e) => e.estado === "pendiente");
  const enCurso = encargos.filter((e) => e.estado === "en_curso");
  const historial = encargos.filter((e) => ["completado", "calificado", "rechazado", "cancelado"].includes(e.estado));

  const pestanas: Array<{ valor: Pestana; etiqueta: string; total: number }> = [
    { valor: "solicitudes", etiqueta: "Solicitudes", total: solicitudes.length },
    { valor: "en_curso", etiqueta: "En curso", total: enCurso.length },
    { valor: "historial", etiqueta: "Historial", total: historial.length },
  ];

  const ejecutar = async (id: string, url: string, cuerpo?: unknown, despues?: () => void) => {
    setError(null);
    setOcupado(id);
    const r = await pedir(url, cuerpo);
    setOcupado(null);
    if (!r.ok) setError(r.error);
    else despues?.();
    router.refresh();
  };

  const responder = (e: EncargoConsultor, acepta: boolean) => {
    if (!acepta && !window.confirm(`¿Rechazar la solicitud "${e.tituloTarea}" de ${e.empresaNombre}?`)) return;
    ejecutar(e.id, `/api/consultor/encargos/${e.id}/responder`, { acepta }, acepta ? () => setPestana("en_curso") : undefined);
  };

  const agregarAvance = (e: EncargoConsultor) =>
    ejecutar(e.id, `/api/consultor/encargos/${e.id}/avances`, { nota: notas[e.id] ?? "" }, () =>
      setNotas((n) => ({ ...n, [e.id]: "" }))
    );

  const completar = (e: EncargoConsultor) => {
    if (!window.confirm(`¿Marcar "${e.tituloTarea}" como completado? Ya no podrás registrar avances y la empresa podrá calificarte.`)) return;
    ejecutar(e.id, `/api/consultor/encargos/${e.id}/completar`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Mis encargos</h1>
        <p className="text-sm text-ink-soft">Gestiona las tareas que las empresas te solicitan.</p>
      </div>

      {error && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="mb-6 flex gap-2 border-b border-line-soft" role="tablist">
        {pestanas.map((p) => (
          <button
            key={p.valor}
            role="tab"
            aria-selected={pestana === p.valor}
            onClick={() => setPestana(p.valor)}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
              pestana === p.valor ? "border-brick-500 text-brick-600" : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            {p.etiqueta} ({p.total})
          </button>
        ))}
      </div>

      {pestana === "solicitudes" &&
        (solicitudes.length === 0 ? (
          <EmptyState icon={ClipboardList} titulo="No tienes solicitudes pendientes" descripcion="Cuando una empresa te solicite, aparecerá aquí." />
        ) : (
          <div className="space-y-4">
            {solicitudes.map((e) => (
              <div key={e.id} className="rounded-2xl border border-line p-5">
                <Encabezado e={e} />
                {e.descripcionTarea && <p className="mt-1.5 whitespace-pre-line text-sm text-ink-soft">{e.descripcionTarea}</p>}
                <p className="mt-2 text-xs text-ink-faint">
                  El correo de la empresa se muestra cuando aceptes. Recibida el {formatFecha(e.fechas.creada)}.
                </p>
                {e.contexto && <Contexto contexto={e.contexto} abierto />}
                <div className="mt-4 flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => responder(e, true)} disabled={ocupado === e.id}>
                    <Check className="h-3.5 w-3.5" /> Aceptar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => responder(e, false)}
                    disabled={ocupado === e.id}
                    className="text-danger hover:bg-danger-bg"
                  >
                    <XIcon className="h-3.5 w-3.5" /> Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {pestana === "en_curso" &&
        (enCurso.length === 0 ? (
          <EmptyState icon={ClipboardList} titulo="No tienes encargos en curso" descripcion="Los encargos que aceptes aparecerán aquí." />
        ) : (
          <div className="space-y-4">
            {enCurso.map((e) => (
              <div key={e.id} className="rounded-2xl border border-line p-5">
                <Encabezado e={e} />
                {e.correoContraparte && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
                    <Mail className="h-3.5 w-3.5 text-primary-700" />
                    <a href={`mailto:${e.correoContraparte}`} className="font-medium text-primary-700 hover:underline">
                      {e.correoContraparte}
                    </a>
                  </p>
                )}
                {e.descripcionTarea && <p className="mt-1.5 whitespace-pre-line text-sm text-ink-soft">{e.descripcionTarea}</p>}
                {e.tipoAyuda === "buscar_convocatoria" && <BusquedaResumen e={e} />}
                {e.contexto && <Contexto contexto={e.contexto} />}

                {e.avances.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-line-soft pt-3">
                    {e.avances.map((a) => (
                      <li key={a.id} className="whitespace-pre-line text-xs text-ink-soft">
                        <span className="font-medium text-ink-faint">{formatFecha(a.fecha)}:</span> {a.nota}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex gap-2">
                  <label htmlFor={`nota-${e.id}`} className="sr-only">
                    Nota de avance
                  </label>
                  <input
                    id={`nota-${e.id}`}
                    value={notas[e.id] ?? ""}
                    onChange={(ev) => setNotas((n) => ({ ...n, [e.id]: ev.target.value }))}
                    maxLength={2000}
                    placeholder="Escribe una nota de avance..."
                    className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => agregarAvance(e)}
                    disabled={ocupado === e.id || !(notas[e.id] ?? "").trim()}
                  >
                    Agregar avance
                  </Button>
                </div>

                <Button variant="primary" size="sm" className="mt-3" onClick={() => completar(e)} disabled={ocupado === e.id}>
                  Marcar como completado
                </Button>
              </div>
            ))}
          </div>
        ))}

      {pestana === "historial" &&
        (historial.length === 0 ? (
          <EmptyState icon={ClipboardList} titulo="Aún no tienes historial" descripcion="Tus encargos completados o cerrados aparecerán aquí." />
        ) : (
          <div className="space-y-4">
            {historial.map((e) => (
              <div key={e.id} className="rounded-2xl border border-line p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-ink-faint">
                      {e.empresaNombre} · Proyecto: <span className="font-medium text-ink-soft">{e.proyectoNombre}</span>
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold text-ink">{e.tituloTarea}</h3>
                  </div>
                  <Badge className={ESTADO_ENCARGO_ESTILO[e.estado]}>{ESTADO_ENCARGO_LABEL[e.estado]}</Badge>
                </div>
                {e.correoContraparte && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
                    <Mail className="h-3.5 w-3.5 text-primary-700" />
                    <a href={`mailto:${e.correoContraparte}`} className="font-medium text-primary-700 hover:underline">
                      {e.correoContraparte}
                    </a>
                  </p>
                )}
                {e.fechas.completado && <p className="mt-1.5 text-xs text-ink-faint">Completado el {formatFecha(e.fechas.completado)}</p>}
                {e.calificacion && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <RatingStars valor={e.calificacion.estrellas} />
                    {e.calificacion.comentario && <p className="mt-1.5 text-xs text-ink-soft">{e.calificacion.comentario}</p>}
                  </div>
                )}
                {e.estado === "cancelado" && e.motivoCancelacion && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint">
                    <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e.motivoCancelacion}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

/** RF-91, RF-92 · En un encargo de búsqueda en curso: a la búsqueda, y cómo van las propuestas. */
function BusquedaResumen({ e }: { e: EncargoConsultor }) {
  const elegida = e.propuestas.find((p) => p.estado === "elegida");
  const abiertas = e.propuestas.filter((p) => p.estado === "propuesta").length;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brick-50/60 px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-xs text-brick-700">
        <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {elegida
          ? `La empresa eligió "${elegida.convocatoriaNombre}". Sigue ayudándola con esa convocatoria.`
          : abiertas > 0
            ? `${abiertas} ${abiertas === 1 ? "propuesta espera" : "propuestas esperan"} a que la empresa elija.`
            : "Busca en el catálogo vigente y propón a la empresa las convocatorias que le sirvan."}
      </p>
      <Link
        href={`/consultor/encargos/${e.id}/convocatorias`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brick-700 ring-1 ring-brick-100 hover:bg-brick-50"
      >
        <Search className="h-3.5 w-3.5" /> {elegida ? "Ver la búsqueda" : "Buscar y proponer"}
      </Link>
    </div>
  );
}

function Encabezado({ e }: { e: EncargoConsultor }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={TIPO_AYUDA_ESTILO[e.tipoAyuda]}>
          {e.tipoAyuda === "convocatoria_especifica" ? <Target className="h-3 w-3" /> : <Compass className="h-3 w-3" />}
          {TIPO_AYUDA_LABEL[e.tipoAyuda]}
        </Badge>
        <span className="text-xs text-ink-faint">{e.empresaNombre}</span>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Proyecto: <span className="font-medium text-ink-soft">{e.proyectoNombre}</span>
        {e.convocatoriaNombre && (
          <>
            {" · Convocatoria: "}
            <span className="font-medium text-ink-soft">{e.convocatoriaNombre}</span>
          </>
        )}
      </p>
      <h3 className="mt-1 font-display text-base font-semibold text-ink">{e.tituloTarea}</h3>
    </>
  );
}

const CAMPOS: Array<{ clave: "problema" | "objetivoGeneral" | "poblacionBeneficiaria" | "actividades" | "resultadosEsperados" | "experienciaEmpresa"; etiqueta: string }> = [
  { clave: "problema", etiqueta: "Problema" },
  { clave: "objetivoGeneral", etiqueta: "Objetivo general" },
  { clave: "poblacionBeneficiaria", etiqueta: "Población beneficiaria" },
  { clave: "actividades", etiqueta: "Actividades" },
  { clave: "resultadosEsperados", etiqueta: "Resultados esperados" },
  { clave: "experienciaEmpresa", etiqueta: "Experiencia de la empresa" },
];

/** RF-68, RF-69, RN-25 · Lo que la base deja leer del proyecto, la convocatoria y el checklist. */
function Contexto({ contexto, abierto = false }: { contexto: ContextoEncargo; abierto?: boolean }) {
  const { proyecto: p, convocatoria: c, checklist } = contexto;
  return (
    <details open={abierto} className="mt-3 rounded-xl border border-line-soft bg-slate-50/60 px-4 py-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-faint">Contexto de la solicitud</summary>

      {/* RF-69: datos de clasificación, sobre todo para "buscar convocatoria" */}
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-ink-faint">Categorías</dt>
          <dd className="font-medium text-ink-soft">{p.categoriasNombres.length ? p.categoriasNombres.join(", ") : "Sin indicar"}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Monto buscado</dt>
          <dd className="font-medium text-ink-soft">{p.montoBuscado !== null ? formatCOP(p.montoBuscado) : "Sin indicar"}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Ubicación</dt>
          <dd className="font-medium text-ink-soft">
            {p.departamento ? nombreDepartamento(p.departamento) : "Sin indicar"}
            {p.ubicacion ? ` · ${p.ubicacion}` : ""}
          </dd>
        </div>
      </dl>

      {/* RF-68: contenido del proyecto */}
      <div className="mt-3 space-y-2">
        {p.descripcion && <p className="whitespace-pre-line text-xs text-ink-soft">{p.descripcion}</p>}
        {CAMPOS.filter(({ clave }) => p[clave]).map(({ clave, etiqueta }) => (
          <div key={clave}>
            <p className="text-xs font-semibold text-ink-faint">{etiqueta}</p>
            <p className="whitespace-pre-line text-xs text-ink-soft">{p[clave]}</p>
          </div>
        ))}
        {p.objetivosEspecificos && p.objetivosEspecificos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-faint">Objetivos específicos</p>
            <ul className="list-disc pl-4 text-xs text-ink-soft">
              {p.objetivosEspecificos.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}
        {(p.duracionMeses || p.presupuestoEstimado) && (
          <p className="text-xs text-ink-soft">
            {p.duracionMeses ? `Duración: ${p.duracionMeses} meses` : ""}
            {p.duracionMeses && p.presupuestoEstimado ? " · " : ""}
            {p.presupuestoEstimado ? `Presupuesto estimado: ${formatCOP(p.presupuestoEstimado)}` : ""}
          </p>
        )}
      </div>

      {/* RN-25: la de un encargo específico o, en uno de búsqueda, la que eligió la empresa (RF-93) */}
      {c && (
        <div className="mt-4 border-t border-line-soft pt-3">
          <p className="text-xs font-semibold text-ink">
            {c.nombre} <span className="font-normal text-ink-faint">· {c.entidad} · cierra el {formatFecha(c.fechaCierre)}</span>
          </p>
          {c.urlPostulacion && (
            <a href={c.urlPostulacion} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
              Portal de la entidad <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {c.requisitos.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold text-ink-faint">Requisitos</p>
              <ul className="list-disc pl-4 text-xs text-ink-soft">
                {c.requisitos.map((r, i) => (
                  <li key={i}>
                    {r.descripcion}
                    {!r.obligatorio && <span className="text-ink-faint"> (opcional)</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {checklist && checklist.length > 0 && (
        <div className="mt-4 border-t border-line-soft pt-3">
          <p className="text-xs font-semibold text-ink-faint">
            Checklist de la postulación ({checklist.filter((i) => i.completado).length}/{checklist.length}) · solo lectura
          </p>
          <ul className="mt-1 space-y-1">
            {checklist.map((i, n) => (
              <li key={n} className="flex items-start gap-1.5 text-xs text-ink-soft">
                {i.completado ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-label="Completado" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-label="Pendiente" />
                )}
                {i.descripcion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
