"use client";

import Link from "next/link";
import { FileStack, CheckCircle2, EyeOff, Archive, AlertTriangle, UserCheck, ClipboardList, CreditCard, Sparkles, XCircle, Wallet } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  diasRestantes,
  formatCOP,
  formatFecha,
  ESTADO_CONVOCATORIA_LABEL,
  ESTADO_CONVOCATORIA_ESTILO,
  ESTADO_SUSCRIPCION_LABEL,
  ESTADO_SUSCRIPCION_ESTILO,
} from "@/lib/utils";
import type { EstadoSuscripcion } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const ESTADOS_SUSCRIPCION: EstadoSuscripcion[] = ["trial", "activa", "en_gracia", "vencida", "suspendida"];

/**
 * Dashboard del panel. `perfilesEnRevision` (RF-34) y `solicitudesEquipo`
 * (RF-90) llegan del servidor; lo demás sigue en el store.
 */
export function DashboardPanel({
  perfilesEnRevision,
  solicitudesEquipo,
}: {
  perfilesEnRevision: number;
  solicitudesEquipo: number;
}) {
  const convocatorias = useAppStore((s) => s.convocatorias);
  const suscripciones = useAppStore((s) => s.suscripciones);
  const estadisticasIA = useAppStore((s) => s.estadisticasIA);

  const totales = {
    borrador: convocatorias.filter((c) => c.estado === "borrador").length,
    publicada: convocatorias.filter((c) => c.estado === "publicada").length,
    despublicada: convocatorias.filter((c) => c.estado === "despublicada").length,
    cerrada: convocatorias.filter((c) => c.estado === "cerrada").length,
  };

  const proximasAVencer = convocatorias
    .filter((c) => c.estado === "publicada")
    .map((c) => ({ c, dias: diasRestantes(c.fechaCierre) }))
    .filter((x) => x.dias >= 0 && x.dias < 15)
    .sort((a, b) => a.dias - b.dias);

  return (
    <div>
      <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">Panel general</h1>
      <p className="text-sm text-ink-2">Resumen del estado de las convocatorias en la plataforma.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <TarjetaTotal
          icon={FileStack}
          etiqueta="Borrador"
          valor={totales.borrador}
          tono="text-ink-2 bg-surface-2"
        />
        <TarjetaTotal
          icon={CheckCircle2}
          etiqueta="Publicadas"
          valor={totales.publicada}
          tono="text-pri-text bg-pri-soft"
        />
        <TarjetaTotal
          icon={EyeOff}
          etiqueta="Despublicadas"
          valor={totales.despublicada}
          tono="text-amber-ink bg-amber/10"
        />
        <TarjetaTotal
          icon={Archive}
          etiqueta="Cerradas"
          valor={totales.cerrada}
          tono="text-ink-3 bg-surface-2"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/consultores/revision" className="block">
          <TarjetaTotal
            icon={UserCheck}
            etiqueta="Perfiles de consultor en revisión"
            valor={perfilesEnRevision}
            tono="text-sky-ink bg-sky/10"
          />
        </Link>
        <Link href="/admin/encargos" className="block">
          <TarjetaTotal
            icon={ClipboardList}
            etiqueta="Solicitudes al equipo"
            valor={solicitudesEquipo}
            tono="text-sky-ink bg-sky/10"
          />
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-pri-text" />
          <h2 className="font-display text-base font-semibold text-ink">Suscripciones por estado</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ESTADOS_SUSCRIPCION.map((estado) => (
            <Link
              key={estado}
              href="/admin/suscripciones"
              className="rounded-xl border border-line-2 p-3 text-center hover:bg-surface-2"
            >
              <p className="font-tabular text-2xl font-bold text-ink">
                {suscripciones.filter((s) => s.estado === estado).length}
              </p>
              <Badge className={ESTADO_SUSCRIPCION_ESTILO[estado]}>{ESTADO_SUSCRIPCION_LABEL[estado]}</Badge>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-violet/30 bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-ink" />
          <h2 className="font-display text-base font-semibold text-ink">Consumo de IA del periodo</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TarjetaTotal icon={Sparkles} etiqueta="Generaciones" valor={estadisticasIA.generaciones} tono="text-violet-ink bg-violet/10" />
          <TarjetaTotal icon={ClipboardList} etiqueta="Ajustes" valor={estadisticasIA.ajustes} tono="text-violet-ink bg-violet/10" />
          <TarjetaTotal icon={XCircle} etiqueta="Fallidas (sin costo)" valor={estadisticasIA.fallidas} tono="text-ink-3 bg-surface-2" />
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber/10 text-amber-ink">
              <Wallet className="h-5 w-5" />
            </div>
            <p className="font-display font-tabular text-2xl font-bold text-ink">{formatCOP(estadisticasIA.costoEstimadoCOP)}</p>
            <p className="text-xs text-ink-3">Costo estimado acumulado</p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-ink" />
          <h2 className="font-display text-base font-semibold text-ink">
            Próximas a vencer (menos de 15 días)
          </h2>
        </div>

        {proximasAVencer.length === 0 ? (
          <p className="text-sm text-ink-2">No hay convocatorias por vencer en el corto plazo.</p>
        ) : (
          <div className="divide-y divide-line-2">
            {proximasAVencer.map(({ c, dias }) => (
              <Link
                key={c.id}
                href={`/admin/convocatorias/${c.id}`}
                className="flex items-center justify-between gap-4 py-3 hover:bg-surface-2"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{c.nombre}</p>
                  <p className="text-xs text-ink-3">{c.entidadConvocante}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-3">Cierra {formatFecha(c.fechaCierre)}</span>
                  <Badge className="bg-amber/10 text-amber-ink ring-amber/30">
                    {dias} {dias === 1 ? "día" : "días"}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 font-display text-base font-semibold text-ink">Todas las convocatorias</h2>
        <div className="divide-y divide-line-2">
          {convocatorias.map((c) => (
            <Link
              key={c.id}
              href={`/admin/convocatorias/${c.id}`}
              className="flex items-center justify-between gap-4 py-3 hover:bg-surface-2"
            >
              <p className="text-sm font-medium text-ink">{c.nombre}</p>
              <Badge className={ESTADO_CONVOCATORIA_ESTILO[c.estado]}>
                {ESTADO_CONVOCATORIA_LABEL[c.estado]}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function TarjetaTotal({
  icon: Icon,
  etiqueta,
  valor,
  tono,
}: {
  icon: React.ElementType;
  etiqueta: string;
  valor: number;
  tono: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tono}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-display font-tabular text-3xl font-bold text-ink">{valor}</p>
      <p className="text-xs text-ink-3">{etiqueta}</p>
    </div>
  );
}
