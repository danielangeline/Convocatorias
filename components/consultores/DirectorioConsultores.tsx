"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, Briefcase, UserRound, Users } from "lucide-react";
import type { ConsultorDirectorio } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { RatingStars } from "@/components/RatingStars";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Directorio de consultores</h1>
        <p className="text-sm text-ink-soft">
          Encuentra consultores verificados para tareas específicas de tus proyectos.
        </p>
      </div>

      {solicitud && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brick-100 bg-brick-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-brick-700">Buscando consultor para: {solicitud.tituloTarea}</p>
            <p className="text-xs text-brick-600/80">
              Elige un perfil y usa &ldquo;Solicitar para mi tarea&rdquo; en su ficha completa.
            </p>
          </div>
          <button onClick={cancelarSolicitud} className="text-xs font-semibold text-brick-700 hover:underline">
            Cancelar solicitud
          </button>
        </div>
      )}

      {consultores.length === 0 ? (
        <EmptyState
          icon={Users}
          titulo="Aún no hay consultores en el directorio"
          descripcion="Mientras tanto, puedes pedir que el equipo de la plataforma te asigne uno desde la ficha de tu proyecto."
          accion={
            <Link href="/proyectos" className="text-sm font-semibold text-primary-700 hover:underline">
              Ir a mis proyectos
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre..."
                aria-label="Buscar por nombre"
                className="w-full rounded-lg border border-line py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-ink-faint focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="h-max rounded-2xl border border-line p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-ink">Filtros</h2>
                {(especialidadSel.length > 0 || ratingMin > 0) && (
                  <button
                    onClick={() => {
                      setEspecialidadSel([]);
                      setRatingMin(0);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <X className="h-3 w-3" /> Limpiar
                  </button>
                )}
              </div>

              <div className="mb-4 border-b border-line-soft pb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Especialidad</p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {especialidades.map((cat) => (
                    <label key={cat.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        checked={especialidadSel.includes(cat.id)}
                        onChange={() => toggleEspecialidad(cat.id)}
                        className="h-4 w-4 rounded border-line text-primary-700 focus:ring-primary-500"
                      />
                      {cat.nombre}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="rating-min" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Rating mínimo: {ratingMin.toFixed(1)}
                </label>
                <input
                  id="rating-min"
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={ratingMin}
                  onChange={(e) => setRatingMin(Number(e.target.value))}
                  className="w-full accent-primary-700"
                />
              </div>
            </aside>

            <div>
              {resultados.length === 0 ? (
                <EmptyState
                  icon={Search}
                  titulo="No encontramos consultores con esos filtros"
                  descripcion="Ajusta los filtros o la búsqueda para ver más resultados."
                />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {resultados.map((c) => (
                    <Link
                      key={c.id}
                      href={`/consultores/${c.id}`}
                      className="flex flex-col rounded-2xl border border-line p-5 transition-colors hover:border-brick-100 hover:bg-brick-50/30"
                    >
                      <div className="flex items-center gap-3">
                        {c.fotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage
                          <img src={c.fotoUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-line" />
                        ) : (
                          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-ink-faint ring-1 ring-line">
                            <UserRound className="h-6 w-6" />
                          </span>
                        )}
                        <div>
                          <h3 className="font-display text-sm font-semibold text-ink">{c.nombreProfesional}</h3>
                          <RatingStars valor={c.ratingPromedio} />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {c.especialidades.slice(0, 3).map((e) => (
                          <Chip key={e.id} tono={e.tipo}>
                            {e.nombre}
                          </Chip>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center gap-1.5 border-t border-line-soft pt-4 text-xs text-ink-faint">
                        <Briefcase className="h-3.5 w-3.5" /> {c.totalEncargosCompletados} encargos completados
                      </div>

                      <span className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-gold-700 ring-1 ring-inset ring-gold-500">
                        Ver perfil y solicitar
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
