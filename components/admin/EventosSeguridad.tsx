"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ShieldCheck, Lock, Filter, Unlock } from "lucide-react";
import { peticionAdmin } from "@/lib/admin/peticion";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/identidad/Campo";
import type { EventoSeguridad, TipoEventoSeguridad } from "@/lib/types";
import { TIPO_EVENTO_SEGURIDAD_LABEL, TIPO_EVENTO_SEGURIDAD_ESTILO, cn } from "@/lib/utils";
import { fechaHoraColombia } from "@/lib/fechas";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * CU-39 · RF-65 · Bitácora de eventos de seguridad, con los datos reales que
 * entrega el servidor. Los bloqueos activos por límite de tasa (CU-40) se
 * pueden liberar antes de que expiren (RF-67): el servidor borra el contador en
 * Upstash y deja el evento vencido con quién lo liberó.
 */

const FILTROS: Array<TipoEventoSeguridad | "todos"> = [
  "todos",
  "login_fallido",
  "acceso_denegado",
  "mfa_activado",
  "mfa_fallido",
  "admin_invitado",
  "invitacion_cancelada",
  "admin_revocado",
  "limite_tasa",
];

export function EventosSeguridad({ eventos, ahora, limite }: { eventos: EventoSeguridad[]; ahora: number; limite: number }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<TipoEventoSeguridad | "todos">("todos");
  const [liberando, setLiberando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const liberar = async (e: EventoSeguridad) => {
    if (!window.confirm(`¿Liberar el bloqueo de ${e.usuarioNombre ?? e.ip}? Podrá volver a intentarlo de inmediato.`)) return;
    setLiberando(e.id);
    setMensaje(null);
    const r = await peticionAdmin(`/api/admin/seguridad/${e.id}/liberar`, "POST", {});
    setLiberando(null);
    setMensaje(r.ok ? { tipo: "exito", texto: r.aviso ?? "Bloqueo liberado." } : { tipo: "error", texto: r.error });
    if (r.ok) router.refresh();
  };

  const bloqueosActivos = eventos.filter(
    (e) => e.tipo === "limite_tasa" && e.bloqueadoHasta && new Date(e.bloqueadoHasta).getTime() > ahora
  );
  const eventosFiltrados = filtro === "todos" ? eventos : eventos.filter((e) => e.tipo === filtro);
  const cuenta = (t: TipoEventoSeguridad | "todos") => (t === "todos" ? eventos.length : eventos.filter((e) => e.tipo === t).length);

  return (
    <div>
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700">
          <ShieldAlert className="h-3.5 w-3.5" /> Seguridad y auditoría
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Eventos de seguridad</h1>
        <p className="text-sm text-ink-soft">
          Logins fallidos, accesos denegados, verificación en dos pasos y gestión de administradores (CU-39, RF-65). Se
          muestran los {limite.toLocaleString("es-CO")} más recientes.
        </p>
      </div>

      {/* Bloqueos activos (CU-40) */}
      <div className="mb-8 rounded-2xl border border-line p-4 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <Lock className="h-4 w-4 text-brick-600" /> Bloqueos activos por límite de tasa
        </h2>
        {mensaje && (
          <div className="mt-3">
            <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>
          </div>
        )}
        {bloqueosActivos.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">No hay bloqueos activos en este momento.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {bloqueosActivos.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brick-100 bg-brick-50/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {e.usuarioNombre ?? "Sin usuario resuelto"} · {e.ip}
                  </p>
                  <p className="break-words text-xs text-ink-faint">
                    {e.ruta} — {e.detalle}
                  </p>
                  <p className="mt-0.5 text-xs text-brick-700">
                    Bloqueado hasta {e.bloqueadoHasta ? fechaHoraColombia(e.bloqueadoHasta) : "—"}
                  </p>
                </div>
                <Button variant="outline-gold" size="sm" onClick={() => liberar(e)} disabled={liberando === e.id}>
                  <Unlock className="h-3.5 w-3.5" /> {liberando === e.id ? "Liberando…" : "Liberar ahora"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bitácora de eventos (CU-39) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-ink-faint" />
        {FILTROS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            onClick={() => setFiltro(f)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              filtro === f ? "bg-primary-800 text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-slate-50"
            )}
          >
            {f === "todos" ? "Todos" : TIPO_EVENTO_SEGURIDAD_LABEL[f]} ({cuenta(f).toLocaleString("es-CO")})
          </button>
        ))}
      </div>

      {eventosFiltrados.length === 0 ? (
        <EmptyState icon={ShieldCheck} titulo="Sin eventos" descripcion="No hay eventos de seguridad para este filtro." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">Ruta</th>
                <th className="px-5 py-3">Detalle</th>
                <th className="px-5 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {eventosFiltrados.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Badge className={TIPO_EVENTO_SEGURIDAD_ESTILO[e.tipo]}>{TIPO_EVENTO_SEGURIDAD_LABEL[e.tipo]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{e.usuarioNombre ?? "—"}</td>
                  <td className="px-5 py-3 font-tabular text-ink-soft">{e.ip}</td>
                  <td className="break-all px-5 py-3 text-ink-soft">{e.ruta}</td>
                  <td className="max-w-xs px-5 py-3 text-ink-soft">{e.detalle}</td>
                  <td className="whitespace-nowrap px-5 py-3 font-tabular text-xs text-ink-faint">{fechaHoraColombia(e.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
