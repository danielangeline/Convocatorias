"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ClipboardList, Compass, Copy, Mail, Target, X } from "lucide-react";
import type { SolicitudEquipo } from "@/lib/types";
import { pedir } from "@/lib/pedir";
import { nombreDepartamento } from "@/lib/departamentos";
import { cn, formatCOP, TIPO_AYUDA_LABEL, TIPO_AYUDA_ESTILO } from "@/lib/utils";
import { fechaHoraColombia } from "@/lib/fechas";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

type Pestana = "esperando" | "atendidas";

/**
 * CU-26, RF-90 · Solicitudes al equipo de la plataforma. El administrador
 * escribe a la empresa por correo, fuera de la plataforma, y la marca como
 * contactada con una nota interna opcional. Lo valida la base
 * (`atender_solicitud_equipo`); la pantalla se recarga con `router.refresh()`.
 */
export function SolicitudesEquipo({ esperando, atendidas }: { esperando: SolicitudEquipo[]; atendidas: SolicitudEquipo[] }) {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>("esperando");
  const [aMarcar, setAMarcar] = useState<SolicitudEquipo | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = async (correo: string) => {
    await navigator.clipboard?.writeText(correo).catch(() => undefined);
    setCopiado(correo);
    setTimeout(() => setCopiado(null), 1500);
  };

  const marcar = async () => {
    if (!aMarcar) return;
    setEnviando(true);
    setError(null);
    const r = await pedir(`/api/admin/encargos/${aMarcar.id}/atender`, { nota });
    setEnviando(false);
    if (!r.ok) setError(r.error);
    else setAviso(`"${aMarcar.tituloTarea}" quedó como contactada.`);
    setAMarcar(null);
    router.refresh();
  };

  const lista = pestana === "esperando" ? esperando : atendidas;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Solicitudes al equipo</h1>
        <p className="text-sm text-ink-soft">
          Empresas que pidieron ayuda a nuestro equipo. Escríbeles por correo y marca la solicitud como contactada.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {aviso && !error && (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {aviso}
        </p>
      )}

      <div className="mb-6 flex gap-2 border-b border-line-soft" role="tablist">
        {(
          [
            ["esperando", `Esperando (${esperando.length})`],
            ["atendidas", `Contactadas (${atendidas.length})`],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={pestana === valor}
            onClick={() => setPestana(valor)}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
              pestana === valor ? "border-primary-700 text-primary-800" : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          titulo={pestana === "esperando" ? "No hay solicitudes esperando" : "Aún no hay solicitudes contactadas"}
          descripcion={
            pestana === "esperando"
              ? "Cuando una empresa pida ayuda a nuestro equipo, aparecerá aquí."
              : "Las solicitudes que marques como contactadas quedan aquí."
          }
        />
      ) : (
        <div className="space-y-4">
          {lista.map((s) => (
            <div key={s.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className={TIPO_AYUDA_ESTILO[s.tipoAyuda]}>
                  {s.tipoAyuda === "convocatoria_especifica" ? <Target className="h-3 w-3" /> : <Compass className="h-3 w-3" />}
                  {TIPO_AYUDA_LABEL[s.tipoAyuda]}
                </Badge>
                <span className="text-xs text-ink-faint">Recibida el {fechaHoraColombia(s.creadaAt)}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-ink">{s.empresaNombre}</p>
                {s.empresaContacto && s.empresaContacto !== s.empresaNombre && (
                  <p className="text-xs text-ink-faint">{s.empresaContacto}</p>
                )}
                <a href={`mailto:${s.empresaCorreo}`} className="flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
                  <Mail className="h-3.5 w-3.5" /> {s.empresaCorreo}
                </a>
                <button
                  onClick={() => copiar(s.empresaCorreo)}
                  className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
                  aria-label={`Copiar ${s.empresaCorreo}`}
                >
                  <Copy className="h-3 w-3" /> {copiado === s.empresaCorreo ? "Copiado" : "Copiar"}
                </button>
              </div>

              <h3 className="mt-2 font-display text-base font-semibold text-ink">{s.tituloTarea}</h3>
              {s.descripcionTarea && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{s.descripcionTarea}</p>}
              {s.convocatoriaNombre && <p className="mt-1 text-xs text-ink-faint">Convocatoria: {s.convocatoriaNombre}</p>}

              {s.proyecto && (
                <details className="mt-3 rounded-xl border border-line-soft bg-slate-50/60 px-4 py-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Proyecto: {s.proyecto.nombre}
                  </summary>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-ink-faint">Categorías</dt>
                      <dd className="text-ink-soft">{s.proyecto.categoriasNombres.join(", ") || "Sin indicar"}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Monto buscado</dt>
                      <dd className="text-ink-soft">{s.proyecto.montoBuscado !== null ? formatCOP(s.proyecto.montoBuscado) : "Sin indicar"}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Departamento</dt>
                      <dd className="text-ink-soft">{s.proyecto.departamento ? nombreDepartamento(s.proyecto.departamento) : "Sin indicar"}</dd>
                    </div>
                  </dl>
                  {s.proyecto.descripcion && <p className="mt-2 whitespace-pre-line text-xs text-ink-soft">{s.proyecto.descripcion}</p>}
                  {s.proyecto.problema && (
                    <p className="mt-2 whitespace-pre-line text-xs text-ink-soft">
                      <span className="font-semibold text-ink-faint">Problema: </span>
                      {s.proyecto.problema}
                    </p>
                  )}
                  {s.proyecto.objetivoGeneral && (
                    <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">
                      <span className="font-semibold text-ink-faint">Objetivo: </span>
                      {s.proyecto.objetivoGeneral}
                    </p>
                  )}
                </details>
              )}

              {pestana === "esperando" ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setError(null);
                    setAviso(null);
                    setNota("");
                    setAMarcar(s);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como contactada
                </Button>
              ) : (
                <div className="mt-4 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
                  Contactada {s.atendidoAt ? `el ${fechaHoraColombia(s.atendidoAt)}` : ""}
                  {s.atendidoPorNombre ? ` por ${s.atendidoPorNombre}` : ""}
                  {s.notaInterna && <p className="mt-1 whitespace-pre-line text-emerald-900">{s.notaInterna}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {aMarcar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-marcar" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="titulo-marcar" className="font-display text-lg font-semibold text-ink">
                Marcar como contactada
              </h3>
              <button onClick={() => setAMarcar(null)} className="text-ink-faint hover:text-ink" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-ink-soft">
              Confirma que ya le escribiste a <strong>{aMarcar.empresaNombre}</strong> ({aMarcar.empresaCorreo}). La empresa la verá como
              atendida por nuestro equipo.
            </p>
            <label htmlFor="nota-interna" className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Nota interna (opcional)
            </label>
            <textarea
              id="nota-interna"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Qué se habló, a quién se le asignó, próximos pasos… Solo la ven los administradores."
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setAMarcar(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={marcar} disabled={enviando}>
                Marcar como contactada
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
