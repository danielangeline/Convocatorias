"use client";

import { useState } from "react";
import { Receipt, Check, Sparkles, Info, Lock } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccesoSuscripcion, useCreditos, usePlanEfectivo, useTarifas } from "@/lib/hooks";
import type { Pago, RolPlan } from "@/lib/types";
import { cn, formatCOP, formatFecha, ESTADO_SUSCRIPCION_LABEL, ESTADO_SUSCRIPCION_ESTILO } from "@/lib/utils";
import { beneficiosDePlan, CONTRATAR_EN_PILOTO, FUNCIONES, funcionesNoIncluidas } from "@/lib/planes";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import { BloqueCreditos } from "@/components/BloqueCreditos";

/**
 * CU-28 · CU-30 · RF-41, RF-82 · "Mi suscripción" de la empresa y del consultor.
 *
 * Plan, estado y fechas vienen de la sesión; los planes activos del rol y el
 * historial de pagos, del servidor (docs/05 §9.28). El cupo de créditos solo
 * aparece en los planes que lo incluyen (RF-41): el consultor no lo tiene
 * (RN-28). En el piloto no se contrata desde aquí (CU-28 paso 3).
 *
 * Sesión 042 (RN-41, RF-120): la empresa compara Gratis, Esencial y Pro con sus
 * funciones; «Mejorar plan» llega con `?plan=<id>` y ese plan queda señalado.
 */
export function VistaSuscripcion({ rol, pagos, planSenalado }: { rol: RolPlan; pagos: Pago[]; planSenalado?: string | null }) {
  const tarifas = useTarifas();
  const tarifaDocumento = tarifas.generacion;
  const { suscripcion, diasRestantes } = useAccesoSuscripcion();
  const { disponibles: creditosDisponibles, incluidos, extra } = useCreditos();
  // RF-82: en el portal Empresa, los planes de la petición (contexto); si no, el store.
  const planesStore = useAppStore((s) => s.planes);
  const { planes: planesCtx, planEfectivo } = usePlanEfectivo();
  const planes = planesCtx ?? planesStore;
  const [modalidad, setModalidad] = useState<"mensual" | "anual">("mensual");
  const [elegido, setElegido] = useState<string | null>(planSenalado ?? null);

  // RN-16: pasada la gracia, la base ya trata a la empresa como Gratis aunque el
  // job de la medianoche no haya movido la fila; la pantalla dice lo mismo.
  const bajoAGratis = rol === "empresa" && !!suscripcion && !!planEfectivo && planEfectivo.planId !== suscripcion.planId;
  const planActual = bajoAGratis
    ? planes.find((p) => p.id === planEfectivo!.planId)
    : suscripcion ? planes.find((p) => p.id === suscripcion.planId) : undefined;
  const disponibles = planes
    .filter((p) => p.rol === rol && p.activo !== false)
    .sort((a, b) => a.precioMensual - b.precioMensual);
  const vencida = suscripcion?.estado === "vencida" || suscripcion?.estado === "suspendida";

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
      <PageHeader
        titulo="Plan y créditos"
        descripcion={rol === "empresa" ? "El plan de tu empresa en la plataforma." : "Tu plan como consultor en la plataforma."}
      />

      <section aria-labelledby="plan-actual" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-px overflow-hidden rounded-md border border-line bg-line">
        <div className="bg-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-ink-3">Tu plan</p>
          <h2 id="plan-actual" className="mt-1 font-display text-2xl font-semibold text-ink">
            {planActual?.nombre ?? "Sin plan activo"}
          </h2>
          {suscripcion && (
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <Badge className={ESTADO_SUSCRIPCION_ESTILO[bajoAGratis ? "gratis" : suscripcion.estado]}>
                {ESTADO_SUSCRIPCION_LABEL[bajoAGratis ? "gratis" : suscripcion.estado]}
              </Badge>
              <span className="text-sm text-ink-2">
                {suscripcion.fechaVencimiento ? (
                  <>
                    {suscripcion.estado === "vencida" || bajoAGratis ? "Su plan de pago venció el" : "Vence el"}{" "}
                    <span className="font-tabular font-medium text-ink">{formatFecha(suscripcion.fechaVencimiento)}</span>
                  </>
                ) : (
                  "Sin vencimiento"
                )}
              </span>
            </div>
          )}
          {suscripcion && suscripcion.modalidad !== "gratis" && !bajoAGratis && (
            <p className="mt-1 text-sm text-ink-3">
              {suscripcion.modalidad === "anual" ? "Anual" : "Mensual"} · desde el {formatFecha(suscripcion.fechaInicio)}
            </p>
          )}
          <p className="mt-3 text-sm leading-[1.55] text-ink-2">
            {!suscripcion
              ? rol === "consultor"
                ? "Aún no tienes un plan. Mientras dure el piloto, puedes aparecer en el directorio y recibir encargos sin él."
                : "No tienes un plan activo."
              : bajoAGratis
                ? "Su plan de pago venció y terminó el periodo de gracia: la cuenta está en el plan Gratis. No se borró nada; puede ver y descargar lo que creó. Al renovar, vuelven las funciones de pago."
                : suscripcion.estado === "suspendida"
                ? "Tu suscripción está suspendida. Escríbenos para reactivarla."
                : suscripcion.estado === "vencida"
                  ? rol === "empresa"
                    ? "Tu suscripción está vencida: no puedes postular, ver sugerencias, solicitar consultores ni generar documentos con IA. El catálogo sigue disponible."
                    : "Tu suscripción está vencida."
                  : suscripcion.estado === "gratis"
                    ? "Con el plan Gratis puede explorar el catálogo, guardar convocatorias y registrar sus proyectos a mano. Para usar la IA, las sugerencias y las postulaciones, mejore a Esencial; para trabajar con consultores, a Pro. Si tuvo un plan de pago, todo lo que creó sigue aquí."
                    : suscripcion.estado === "en_gracia" && rol === "empresa"
                      ? "Su plan venció y está en periodo de gracia. Si no se renueva, la cuenta pasa al plan Gratis: no se borra nada, pero las funciones de pago quedan bloqueadas."
                      : diasRestantes !== null && diasRestantes >= 0
                        ? `Termina en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}.`
                        : null}
          </p>
        </div>
        {rol === "empresa" && !bajoAGratis && incluidos + extra > 0 && (
          <div className="bg-surface p-6">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-ink-3">Créditos de IA</p>
            <p className="mt-1">
              <span className="font-tabular text-[34px] font-medium leading-none text-ink">{creditosDisponibles.toLocaleString("es-CO")}</span>
              <span className="text-sm text-ink-3"> de {Math.max(incluidos + extra, creditosDisponibles).toLocaleString("es-CO")} créditos de IA</span>
            </p>
            <ProgressBar
              porcentaje={(creditosDisponibles / Math.max(incluidos + extra, creditosDisponibles, 1)) * 100}
              altura={8}
              className="mt-3"
            />
            <p className="mt-3 text-sm leading-[1.55] text-ink-2">
              Te alcanzan para{" "}
              <strong className="font-semibold text-ink">
                {(tarifaDocumento > 0 ? Math.floor(creditosDisponibles / tarifaDocumento) : 0).toLocaleString("es-CO")}{" "}
                {(tarifaDocumento > 0 ? Math.floor(creditosDisponibles / tarifaDocumento) : 0) === 1 ? "documento" : "documentos"}
              </strong>
              . Un documento usa {tarifaDocumento.toLocaleString("es-CO")} créditos; un ajuste, {tarifas.ajuste.toLocaleString("es-CO")}.
            </p>
          </div>
        )}
      </section>

      {rol === "empresa" && <BloqueCreditos />}

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">Planes disponibles</h2>
          <Segmented
            etiqueta="Modalidad"
            valor={modalidad}
            onChange={setModalidad}
            opciones={[
              { valor: "mensual", etiqueta: "Mensual" },
              { valor: "anual", etiqueta: "Anual" },
            ]}
          />
        </div>

        {disponibles.length === 0 ? (
          <p className="text-sm text-ink-3">No hay planes disponibles en este momento.</p>
        ) : (
          <div className={cn("grid gap-4 sm:grid-cols-2", disponibles.length >= 3 && "lg:grid-cols-3")}>
            {disponibles.map((plan) => {
              const precio = modalidad === "anual" ? plan.precioAnual : plan.precioMensual;
              const ahorro = plan.precioMensual * 12 - plan.precioAnual;
              const esActual = planActual?.id === plan.id && !vencida;
              const senalado = planSenalado === plan.id && !esActual;
              return (
                <div
                  key={plan.id}
                  id={`plan-${plan.id}`}
                  className={cn(
                    "flex flex-col rounded-md border bg-surface p-5",
                    esActual ? "border-line border-t-[3px] border-t-pri" : senalado ? "border-pri ring-2 ring-pri/30" : "border-line"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold text-ink">{plan.nombre}</h3>
                    {esActual ? <Badge tono="ok">Su plan</Badge> : senalado ? <Badge tono="pri">Incluye lo que buscaba</Badge> : null}
                  </div>
                  <p className="mt-2">
                    {plan.esGratuito ? (
                      <>
                        <span className="font-tabular text-2xl font-medium text-ink">$0</span>
                        <span className="text-sm text-ink-3"> · sin vencimiento</span>
                      </>
                    ) : (
                      <>
                        <span className="font-tabular text-2xl font-medium text-ink">{formatCOP(precio)}</span>
                        <span className="text-sm text-ink-3"> / {modalidad === "anual" ? "año" : "mes"}</span>
                      </>
                    )}
                  </p>
                  {!plan.esGratuito && modalidad === "anual" && ahorro > 0 && (
                    <p className="text-xs font-semibold text-amber-ink">Ahorras {formatCOP(ahorro)} frente a pagar mes a mes</p>
                  )}
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-2">
                    {beneficiosDePlan(plan, tarifaDocumento).map((b) => (
                      <li key={b.texto} className={cn("flex items-start gap-2", b.destacado && "font-semibold text-pri-text")}>
                        {b.destacado ? <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pri-text" />}
                        {b.texto}
                      </li>
                    ))}
                    {funcionesNoIncluidas(plan).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-ink-3">
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          <span className="sr-only">No incluye: </span>
                          <span className="line-through">{FUNCIONES[f].beneficio}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {plan.esGratuito ? (
                    <p className="mt-5 rounded-[4px] bg-surface-2 px-3 py-2 text-center text-xs text-ink-3">
                      {esActual ? "Es su plan actual." : "Toda empresa vuelve a Gratis cuando vence su plan de pago."}
                    </p>
                  ) : (
                  <Button
                    variant={esActual ? "secondary" : "primary"}
                    size="lg"
                    className="mt-5 w-full"
                    disabled={esActual}
                    onClick={() => setElegido(plan.id)}
                  >
                    {esActual ? "Plan actual" : "Quiero este plan"}
                  </Button>
                  )}
                  {elegido === plan.id && (
                    <p role="status" className="mt-3 flex items-start gap-2 rounded-[4px] bg-surface-2 px-3 py-2 text-xs text-ink-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {CONTRATAR_EN_PILOTO}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <Receipt className="h-4 w-4" /> Historial de pagos
        </h2>
        {pagos.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">Aún no hay pagos registrados.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Concepto</th>
                  <th className="px-5 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 text-ink-2">{formatFecha(p.fecha)}</td>
                    <td className="px-5 py-3 text-ink-2">
                      {p.concepto === "paquete"
                        ? `Paquete de ${p.creditos} créditos de IA`
                        : `${p.planNombre ?? "Plan"}${p.modalidad ? ` · ${p.modalidad}` : ""}`}
                    </td>
                    <td className="px-5 py-3 text-right font-tabular font-medium text-ink">
                      {p.monto === 0 ? "Cortesía" : formatCOP(p.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-[13px] leading-[1.55] text-ink-3">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
        {CONTRATAR_EN_PILOTO}
      </p>
    </div>
  );
}
