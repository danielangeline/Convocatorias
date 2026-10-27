"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Sparkles, X } from "lucide-react";
import type { CuentaSuscripcion, EstadoSuscripcion, Plan, TableroSuscripciones } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { formatearMontoCOP } from "@/lib/montos";
import { hoyColombia } from "@/lib/fechas";
import { cn, formatFecha, ESTADO_SUSCRIPCION_LABEL, ESTADO_SUSCRIPCION_ESTILO } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Aviso } from "@/components/identidad/Campo";

type Filtro = EstadoSuscripcion | "todas" | "sin";

const filtros: Array<{ valor: Filtro; etiqueta: string }> = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "trial", etiqueta: "Trial" },
  { valor: "activa", etiqueta: "Activa" },
  { valor: "en_gracia", etiqueta: "En gracia" },
  { valor: "vencida", etiqueta: "Vencida" },
  { valor: "suspendida", etiqueta: "Suspendida" },
  { valor: "sin", etiqueta: "Sin suscripción" },
];

const CON_ACCESO = new Set<EstadoSuscripcion>(["trial", "activa", "en_gracia"]);
const usd = (v: number) => `USD ${v.toLocaleString("es-CO", { maximumFractionDigits: 4 })}`;

/**
 * CU-31 pasos 2 a 5 · RF-38, RF-42, RF-51 (docs/05 §9.28).
 *
 * Activar registra el pago acordado por fuera (piloto, CU-28 paso 3); los
 * paquetes de créditos solo van a empresas (RN-28); suspender al consultor
 * cancela sus encargos abiertos (RN-29). Las reglas las decide la base.
 */
export function GestionSuscripciones({
  cuentas,
  tablero,
  planes,
}: {
  cuentas: CuentaSuscripcion[];
  tablero: TableroSuscripciones;
  planes: Plan[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [pagoDe, setPagoDe] = useState<CuentaSuscripcion | null>(null);
  const [pago, setPago] = useState({ planId: "", modalidad: "mensual" as "mensual" | "anual", monto: "", fecha: hoyColombia() });
  const [creditosDe, setCreditosDe] = useState<CuentaSuscripcion | null>(null);
  const [paquete, setPaquete] = useState({ cantidad: "10", monto: "" });

  const filtradas = useMemo(
    () =>
      cuentas.filter((c) => (filtro === "todas" ? true : filtro === "sin" ? c.estado === null : c.estado === filtro)),
    [cuentas, filtro]
  );
  const cuenta = (f: Filtro) => (f === "sin" ? cuentas.filter((c) => c.estado === null).length : cuentas.filter((c) => c.estado === f).length);

  const planesPara = (c: CuentaSuscripcion) => planes.filter((p) => p.rol === c.rol && !p.esTrial && p.activo !== false);
  const precioDe = (planId: string, modalidad: "mensual" | "anual") => {
    const p = planes.find((x) => x.id === planId);
    return p ? formatearMontoCOP(modalidad === "anual" ? p.precioAnual : p.precioMensual) : "";
  };

  const abrirPago = (c: CuentaSuscripcion) => {
    const opciones = planesPara(c);
    const planId = opciones.find((p) => p.id === c.planId)?.id ?? opciones[0]?.id ?? "";
    const modalidad = c.modalidad === "anual" ? "anual" : "mensual";
    setPago({ planId, modalidad, monto: precioDe(planId, modalidad), fecha: hoyColombia() });
    setErrorModal(null);
    setPagoDe(c);
  };

  const terminar = (r: { ok: true; aviso: string | null } | { ok: false; error: string }, cerrar: () => void) => {
    setOcupado(false);
    if (!r.ok) return setErrorModal(r.error);
    cerrar();
    setAviso(r.aviso);
    router.refresh();
  };

  const confirmarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagoDe) return;
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await peticionAdmin("/api/admin/suscripciones/activar", "POST", {
      usuarioId: pagoDe.usuarioId,
      planId: pago.planId,
      modalidad: pago.modalidad,
      monto: pago.monto,
      fechaPago: pago.fecha,
    });
    terminar(r, () => setPagoDe(null));
  };

  const confirmarCreditos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditosDe?.suscripcionId) return;
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await peticionAdmin(`/api/admin/suscripciones/${creditosDe.suscripcionId}/creditos`, "POST", {
      cantidad: paquete.cantidad,
      monto: paquete.monto.trim() === "" ? "0" : paquete.monto,
    });
    terminar(r, () => setCreditosDe(null));
  };

  const suspender = async (c: CuentaSuscripcion) => {
    if (!c.suscripcionId) return;
    const extra = c.rol === "consultor" ? " Sus encargos en curso y pendientes se cancelarán." : "";
    if (!window.confirm(`¿Suspender la suscripción de ${c.nombre}? Pierde el acceso hasta una nueva activación.${extra}`)) return;
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await peticionAdmin(`/api/admin/suscripciones/${c.suscripcionId}/suspender`, "POST", {});
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setAviso(r.aviso);
    router.refresh();
  };

  const campo = "w-full rounded-lg border border-line bg-surface text-ink px-3 py-2 text-sm outline-none focus:border-pri";
  const etiqueta = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">Suscripciones</h1>
        <p className="text-sm text-ink-2">Empresas y consultores aprobados, su plan y el consumo de IA del mes.</p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Suscripciones por estado</p>
          <dl className="mt-3 grid grid-cols-5 gap-2 text-center">
            {(
              [
                ["Trial", tablero.trial],
                ["Activas", tablero.activas],
                ["En gracia", tablero.enGracia],
                ["Vencidas", tablero.vencidas],
                ["Suspendidas", tablero.suspendidas],
              ] as const
            ).map(([t, v]) => (
              <div key={t}>
                <dd className="font-tabular text-xl font-bold text-ink">{v}</dd>
                <dt className="text-xs text-ink-3">{t}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-2xl border border-violet/30 bg-violet/10 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-ink">
            <Sparkles className="h-3.5 w-3.5" /> Consumo de IA de este mes
          </p>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["Documentos", tablero.generacionesExitosas.toLocaleString("es-CO")],
                ["Fallidas", tablero.generacionesFallidas.toLocaleString("es-CO")],
                ["Créditos", tablero.creditosDescontados.toLocaleString("es-CO")],
                ["Costo", usd(tablero.costoUsd)],
              ] as const
            ).map(([t, v]) => (
              <div key={t}>
                <dd className="font-tabular text-lg font-bold text-violet-ink">{v}</dd>
                <dt className="text-xs text-ink-3">{t}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-3">
            Más {tablero.ajustes.toLocaleString("es-CO")} {tablero.ajustes === 1 ? "ajuste" : "ajustes"}. Las fallidas no consumen crédito (RN-17).
          </p>
        </div>
      </div>

      {(error || aviso) && <div className="mb-4">{error ? <Aviso tipo="error">{error}</Aviso> : <Aviso tipo="exito">{aviso}</Aviso>}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            aria-pressed={filtro === f.valor}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
              filtro === f.valor ? "bg-pri text-on-pri" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:bg-surface-2"
            )}
          >
            {f.etiqueta}
            {f.valor !== "todas" && <span className="ml-1.5 text-xs opacity-70">({cuenta(f.valor)})</span>}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <EmptyState icon={CreditCard} titulo="No hay cuentas en este estado" descripcion="Cambia el filtro para ver otras." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">
                <th className="px-5 py-3">Cuenta</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Vencimiento</th>
                <th className="px-5 py-3">Créditos IA</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {filtradas.map((c) => (
                <tr key={c.usuarioId} className="hover:bg-surface-2/60">
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{c.nombre}</p>
                    <p className="text-xs text-ink-3">
                      {c.rol === "empresa" ? "Empresa" : "Consultor"} · {c.correo}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-ink-2">
                    {c.planNombre ?? "—"}
                    {c.modalidad && c.modalidad !== "trial" && <span className="text-xs text-ink-3"> · {c.modalidad}</span>}
                  </td>
                  <td className="px-5 py-3">
                    {c.estado ? (
                      <Badge className={ESTADO_SUSCRIPCION_ESTILO[c.estado]}>{ESTADO_SUSCRIPCION_LABEL[c.estado]}</Badge>
                    ) : (
                      <span className="text-xs text-ink-3">Sin suscripción</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-2">{c.fechaVencimiento ? formatFecha(c.fechaVencimiento) : "—"}</td>
                  <td className="px-5 py-3 font-tabular text-ink-2">
                    {c.rol === "consultor" || !c.estado ? (
                      "—"
                    ) : (
                      <span title="Usados del plan / incluidos · más los de paquetes">
                        {c.creditosUsados}/{c.creditosIncluidos}
                        {c.creditosExtra > 0 && <span className="text-violet-ink"> +{c.creditosExtra}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      {c.rol === "empresa" && c.suscripcionId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPaquete({ cantidad: "10", monto: "" });
                            setErrorModal(null);
                            setCreditosDe(c);
                          }}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-violet-ink" /> Créditos
                        </Button>
                      )}
                      {c.estado && CON_ACCESO.has(c.estado) && (
                        <Button variant="ghost" size="sm" className="text-rose-ink hover:bg-rose/10" onClick={() => suspender(c)} disabled={ocupado}>
                          Suspender
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => abrirPago(c)}>
                        {c.estado === "activa" ? "Renovar / cambiar" : "Registrar pago y activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagoDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/ p-4">
          <form onSubmit={confirmarPago} role="dialog" aria-modal="true" aria-labelledby="titulo-pago" className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-pago" className="font-display text-lg font-semibold text-ink">Registrar pago y activar</h3>
              <button type="button" onClick={() => setPagoDe(null)} className="text-ink-3 hover:text-ink" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-ink-2">
              {pagoDe.rol === "empresa" ? "Empresa" : "Consultor"}: <strong>{pagoDe.nombre}</strong>
            </p>
            {planesPara(pagoDe).length === 0 ? (
              <Aviso tipo="advertencia">No hay planes activos para este rol. Crea o activa uno en Planes.</Aviso>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pago-plan" className={etiqueta}>Plan</label>
                    <select
                      id="pago-plan"
                      value={pago.planId}
                      onChange={(e) => setPago({ ...pago, planId: e.target.value, monto: precioDe(e.target.value, pago.modalidad) })}
                      className={campo}
                    >
                      {planesPara(pagoDe).map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pago-modalidad" className={etiqueta}>Modalidad</label>
                    <select
                      id="pago-modalidad"
                      value={pago.modalidad}
                      onChange={(e) => {
                        const modalidad = e.target.value as "mensual" | "anual";
                        setPago({ ...pago, modalidad, monto: precioDe(pago.planId, modalidad) });
                      }}
                      className={campo}
                    >
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="pago-monto" className={etiqueta}>Monto pagado (COP)</label>
                  <input id="pago-monto" inputMode="numeric" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} className={campo} />
                </div>
                <div>
                  <label htmlFor="pago-fecha" className={etiqueta}>Fecha del pago</label>
                  <input id="pago-fecha" type="date" max={hoyColombia()} value={pago.fecha} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} className={campo} />
                </div>
                <p className="text-xs text-ink-3">
                  {pagoDe.estado === "activa" && pagoDe.planId === pago.planId && pagoDe.modalidad === pago.modalidad
                    ? "Renovación: el vencimiento se corre un periodo y el cupo del mes sigue su ciclo."
                    : "Empieza hoy y el cupo de créditos del periodo arranca de cero. Los créditos de paquetes se conservan."}
                </p>
              </div>
            )}
            {errorModal && <div className="mt-4"><Aviso tipo="error">{errorModal}</Aviso></div>}
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setPagoDe(null)}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={ocupado || planesPara(pagoDe).length === 0}>Registrar y activar</Button>
            </div>
          </form>
        </div>
      )}

      {creditosDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/ p-4">
          <form onSubmit={confirmarCreditos} role="dialog" aria-modal="true" aria-labelledby="titulo-creditos" className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-creditos" className="font-display text-lg font-semibold text-ink">Otorgar créditos adicionales</h3>
              <button type="button" onClick={() => setCreditosDe(null)} className="text-ink-3 hover:text-ink" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-ink-2">
              Empresa: <strong>{creditosDe.nombre}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="paquete-cantidad" className={etiqueta}>Créditos (1 a 100)</label>
                <input id="paquete-cantidad" inputMode="numeric" value={paquete.cantidad} onChange={(e) => setPaquete({ ...paquete, cantidad: e.target.value })} className={campo} />
              </div>
              <div>
                <label htmlFor="paquete-monto" className={etiqueta}>Monto pagado (COP)</label>
                <input id="paquete-monto" inputMode="numeric" placeholder="0 = cortesía" value={paquete.monto} onChange={(e) => setPaquete({ ...paquete, monto: e.target.value })} className={campo} />
              </div>
              <p className="text-xs text-ink-3">Los créditos de paquetes no expiran y se gastan después de los del plan.</p>
            </div>
            {errorModal && <div className="mt-4"><Aviso tipo="error">{errorModal}</Aviso></div>}
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setCreditosDe(null)}>Cancelar</Button>
              <Button type="submit" variant="teal" disabled={ocupado}>Otorgar créditos</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
