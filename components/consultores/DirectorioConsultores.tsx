"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Users } from "lucide-react";
import type { ConsultorDirectorio } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { pedir } from "@/lib/pedir";

const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const normalizar = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * CU-20 · Directorio (RF-26). La lista llega del servidor ya filtrada por la
 * regla de quién aparece (aprobados, sin el equipo interno); aquí solo se
 * busca y se filtra sobre ella. Las especialidades del filtro son las que
 * tienen los consultores del directorio, no el catálogo entero.
 */
export function DirectorioConsultores({ consultores }: { consultores: ConsultorDirectorio[] }) {
  const solicitud = useAppStore((s) => s.solicitudConsultorEnCurso);
  const cancelarSolicitud = useAppStore((s) => s.cancelarSolicitudConsultor);
  const router = useRouter();
  const [enviandoAlEquipo, setEnviandoAlEquipo] = useState(false);
  const [errorEquipo, setErrorEquipo] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [especialidadSel, setEspecialidadSel] = useState<string[]>([]);
  const [ratingMin, setRatingMin] = useState(0);

  const especialidades = useMemo(() => {
    const mapa = new Map<string, ConsultorDirectorio["especialidades"][number]>();
    for (const c of consultores) for (const e of c.especialidades) mapa.set(e.id, e);
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [consultores]);

  const toggleEspecialidad = (id: string) => {
    setEspecialidadSel((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const resultados = useMemo(() => {
    const q = normalizar(busqueda);
    return consultores
      .filter((c) => !q || normalizar(c.nombreProfesional).includes(q))
      .filter((c) => !especialidadSel.length || c.especialidades.some((e) => especialidadSel.includes(e.id)))
      .filter((c) => c.ratingPromedio >= ratingMin);
  }, [consultores, busqueda, especialidadSel, ratingMin]);

  // CU-20 1a · Sin consultores en el directorio, la tarea que la empresa ya
  // describió (CU-19) se envía al equipo de la plataforma (CU-23, RF-90).
  const pedirAyudaAlEquipo = async () => {
    if (!solicitud) return;
    setErrorEquipo(null);
    setEnviandoAlEquipo(true);
    const r = await pedir("/api/encargos", {
      proyectoId: solicitud.proyectoId,
      tipoAyuda: solicitud.tipoAyuda,
      convocatoriaId: solicitud.convocatoriaId,
      titulo: solicitud.tituloTarea,
      descripcion: solicitud.descripcionTarea,
    });
    setEnviandoAlEquipo(false);
    if (!r.ok) {
      setErrorEquipo(r.error);
      return;
    }
    cancelarSolicitud();
    router.push("/encargos");
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Directorio de consultores"
        descripcion="Consultores verificados para tareas específicas de tus proyectos."
      />

      {solicitud && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-pri-soft px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-pri-text">Buscando consultor para: {solicitud.tituloTarea}</p>
            <p className="text-xs text-pri-text/80">
              Elige un perfil y usa &ldquo;Solicitar para mi tarea&rdquo; en su ficha completa.
            </p>
          </div>
          <button onClick={cancelarSolicitud} className="min-h-11 cursor-pointer text-xs font-semibold text-pri-text hover:underline">
            Cancelar solicitud
          </button>
        </div>
      )}

      {consultores.length === 0 ? (
        <EmptyState
          icon={Users}
          titulo="Aún no hay consultores en el directorio"
          descripcion={
            solicitud
              ? "Nuestro equipo puede ayudarte con esta tarea: te escribiremos por correo."
              : "Mientras tanto, nuestro equipo puede ayudarte: en la ficha de tu proyecto, usa “Solicitar consultor” y elige “Pedir ayuda a nuestro equipo”."
          }
          accion={
            solicitud ? (
              <div className="flex flex-col items-center gap-2">
                <Button variant="primary" onClick={pedirAyudaAlEquipo} disabled={enviandoAlEquipo}>
                  {enviandoAlEquipo ? "Enviando…" : "Pedir ayuda a nuestro equipo"}
                </Button>
                {errorEquipo && (
                  <p role="alert" className="max-w-sm text-xs text-rose">
                    {errorEquipo}
                  </p>
                )}
              </div>
            ) : (
              <Link href="/proyectos" className="text-sm font-semibold text-pri-text hover:underline">
                Ir a mis proyectos
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre..."
                aria-label="Buscar por nombre"
                className="h-12 w-full rounded-[4px] border border-line-strong bg-surface pl-10 pr-4 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-pri focus:ring-2 focus:ring-pri-soft"
              />
            </div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
              Calificación mínima
              <select
                value={ratingMin}
                onChange={(e) => setRatingMin(Number(e.target.value))}
                className="min-h-12 rounded-[4px] border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-pri"
              >
                {[0, 3, 3.5, 4, 4.5].map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? "Cualquiera" : `${v.toString().replace(".", ",")} o más`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Chips de especialidad (las que tienen los consultores del directorio). */}
          <div role="group" aria-label="Especialidad" className="barra-desplazable -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {especialidades.map((cat) => {
              const activa = especialidadSel.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => toggleEspecialidad(cat.id)}
                  className={`min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition-colors ${
                    activa ? "border-pri bg-pri text-on-pri" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  {cat.nombre}
                </button>
              );
            })}
            {(especialidadSel.length > 0 || ratingMin > 0) && (
              <button
                onClick={() => {
                  setEspecialidadSel([]);
                  setRatingMin(0);
                }}
                className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1 px-2 text-xs font-semibold text-pri-text hover:underline"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>

          {resultados.length === 0 ? (
            <EmptyState
              icon={Search}
              titulo="No encontramos consultores con esos filtros"
              descripcion="Ajusta los filtros o la búsqueda para ver más resultados."
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
              {resultados.map((c) => (
                <article key={c.id} className="flex flex-col rounded-md border border-line bg-surface p-5 transition-colors hover:border-pri">
                  <div className="flex items-center gap-3.5">
                    {c.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage
                      <img src={c.fotoUrl} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
                    ) : (
                      <span aria-hidden className="grid h-12 w-12 flex-none place-items-center rounded-full bg-pri text-base font-semibold text-on-pri">
                        {iniciales(c.nombreProfesional)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                        <Link href={`/consultores/${c.id}`} className="hover:text-pri-text hover:underline">
                          {c.nombreProfesional}
                        </Link>
                      </h3>
                      <p className="font-tabular flex items-center gap-2 text-[13px] text-ink-3">
                        <span className="font-medium text-ink-2">★ {c.ratingPromedio.toFixed(1).replace(".", ",")}</span>
                        <span>·</span>
                        <span>
                          {c.totalEncargosCompletados} {c.totalEncargosCompletados === 1 ? "encargo" : "encargos"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.especialidades.slice(0, 3).map((e) => (
                      <span key={e.id} className="rounded-[3px] bg-pri-soft px-2 py-1 text-xs font-semibold text-pri-text">
                        {e.nombre}
                      </span>
                    ))}
                  </div>

                  <Link
                    href={`/consultores/${c.id}`}
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[4px] bg-pri px-4 text-sm font-semibold text-on-pri hover:bg-pri-hover"
                  >
                    Ver perfil y solicitar
                  </Link>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
