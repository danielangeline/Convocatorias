"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Layers, Pencil, Plus, X } from "lucide-react";
import type { Plan, RolPlan } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { formatearMontoCOP } from "@/lib/montos";
import { formatCOP } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Aviso } from "@/components/identidad/Campo";

type Formulario = {
  nombre: string;
  rol: RolPlan;
  precioMensual: string;
  precioAnual: string;
  creditosIaMensuales: string;
  diasTrial: string;
  activo: boolean;
};

const vacio: Formulario = { nombre: "", rol: "empresa", precioMensual: "", precioAnual: "", creditosIaMensuales: "0", diasTrial: "", activo: true };

/**
 * CU-31 paso 1 · RF-36 · Planes administrables sin despliegue (docs/05 §9.28).
 *
 * Un plan no se borra —tiene suscripciones y pagos que lo citan—: se desactiva
 * y sale del comparador. El plan de prueba solo cambia nombre, créditos y días.
 * Quien decide es el servidor; la pantalla muestra su respuesta (RNF-20).
 */
export function GestionPlanes({ planes }: { planes: Plan[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Plan | null>(null);
  const [form, setForm] = useState<Formulario>(vacio);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const abrir = (p: Plan | null) => {
    setEditando(p);
    setForm(
      p
        ? {
            nombre: p.nombre,
            rol: p.rol,
            precioMensual: formatearMontoCOP(p.precioMensual),
            precioAnual: formatearMontoCOP(p.precioAnual),
            creditosIaMensuales: String(p.creditosIaMensuales),
            diasTrial: p.diasTrial ? String(p.diasTrial) : "",
            activo: p.activo !== false,
          }
        : vacio
    );
    setErrorModal(null);
    setAbierto(true);
  };

  const enviar = async (datos: Formulario, plan: Plan | null) => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    setErrorModal(null);
    const r = await peticionAdmin<{ id: string }>(plan ? `/api/admin/planes/${plan.id}` : "/api/admin/planes", plan ? "PATCH" : "POST", {
      nombre: datos.nombre,
      rol: datos.rol,
      precioMensual: datos.precioMensual,
      precioAnual: datos.precioAnual,
      creditosIaMensuales: datos.creditosIaMensuales,
      activo: datos.activo,
      diasTrial: plan?.esTrial ? datos.diasTrial : null,
    });
    setOcupado(false);
    return r;
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await enviar(form, editando);
    if (!r.ok) return setErrorModal(r.error);
    setAbierto(false);
    setAviso(r.aviso);
    router.refresh();
  };

  const alternarActivo = async (p: Plan) => {
    const activar = p.activo === false;
    if (!activar && !window.confirm(`¿Desactivar «${p.nombre}»? Sale del comparador; sus suscripciones actuales siguen igual.`)) return;
    const r = await enviar(
      {
        nombre: p.nombre,
        rol: p.rol,
        precioMensual: String(p.precioMensual),
        precioAnual: String(p.precioAnual),
        creditosIaMensuales: String(p.creditosIaMensuales),
        diasTrial: "",
        activo: activar,
      },
      p
    );
    if (!r.ok) return setError(r.error);
    setAviso(activar ? `«${p.nombre}» vuelve a aparecer en el comparador.` : `«${p.nombre}» quedó inactivo.`);
    router.refresh();
  };

  const campo = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pri disabled:bg-surface-2 disabled:text-ink-3";
  const etiqueta = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3";
  const esTrial = editando?.esTrial === true;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">Planes</h1>
          <p className="text-sm text-ink-2">Planes de suscripción para empresas y consultores.</p>
        </div>
        <Button variant="primary" onClick={() => abrir(null)}>
          <Plus className="h-4 w-4" /> Nuevo plan
        </Button>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-xl border border-line-2 bg-surface-2 px-4 py-3 text-xs text-ink-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Los cambios rigen sin desplegar: un cambio de créditos alcanza desde ya a todos los suscriptores del plan. Un plan
        no se borra; al desactivarlo sale del comparador y sus suscripciones actuales siguen igual. El plan de consultor no
        incluye créditos de IA (RN-28).
      </div>

      {(error || aviso) && <div className="mb-4">{error ? <Aviso tipo="error">{error}</Aviso> : <Aviso tipo="exito">{aviso}</Aviso>}</div>}

      {planes.length === 0 ? (
        <EmptyState icon={Layers} titulo="No hay planes" descripcion="Crea el primer plan de suscripción." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Rol</th>
                <th className="px-5 py-3">Precio mensual</th>
                <th className="px-5 py-3">Precio anual</th>
                <th className="px-5 py-3">Créditos IA/mes</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {planes.map((p) => (
                <tr key={p.id} className={p.activo === false ? "opacity-60" : undefined}>
                  <td className="px-5 py-3 font-medium text-ink">
                    {p.nombre}
                    {p.esTrial && <span className="ml-2 text-xs font-normal text-ink-3">{p.diasTrial} días · al registrarse</span>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge className={p.rol === "empresa" ? "bg-pri-soft text-pri-text ring-pri-soft" : "bg-sky/10 text-sky-ink ring-sky/30"}>
                      {p.rol === "empresa" ? "Empresa" : "Consultor"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 font-tabular text-ink-2">{p.esTrial ? "Gratis" : formatCOP(p.precioMensual)}</td>
                  <td className="px-5 py-3 font-tabular text-ink-2">{p.esTrial ? "—" : formatCOP(p.precioAnual)}</td>
                  <td className="px-5 py-3 font-tabular text-violet-ink">{p.rol === "consultor" ? "—" : p.creditosIaMensuales}</td>
                  <td className="px-5 py-3">
                    {p.activo === false ? (
                      <Badge className="bg-surface-2 text-ink-3 ring-line">Inactivo</Badge>
                    ) : (
                      <Badge className="bg-violet/10 text-violet-ink ring-violet/30">Activo</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      {!p.esTrial && (
                        <Button variant="ghost" size="sm" onClick={() => alternarActivo(p)} disabled={ocupado}>
                          {p.activo === false ? "Activar" : "Desactivar"}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => abrir(p)} aria-label={`Editar ${p.nombre}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={guardar}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-plan"
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-plan" className="font-display text-lg font-semibold text-ink">
                {editando ? `Editar ${editando.nombre}` : "Nuevo plan"}
              </h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-ink-3 hover:text-ink" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="plan-nombre" className={etiqueta}>Nombre</label>
                <input id="plan-nombre" required maxLength={80} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={campo} />
              </div>
              <div>
                <label htmlFor="plan-rol" className={etiqueta}>Rol</label>
                <select
                  id="plan-rol"
                  value={form.rol}
                  disabled={esTrial}
                  onChange={(e) => {
                    const rol = e.target.value as RolPlan;
                    setForm({ ...form, rol, creditosIaMensuales: rol === "consultor" ? "0" : form.creditosIaMensuales });
                  }}
                  className={campo}
                >
                  <option value="empresa">Empresa</option>
                  <option value="consultor">Consultor</option>
                </select>
              </div>
              {!esTrial && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="plan-mensual" className={etiqueta}>Precio mensual (COP)</label>
                    <input id="plan-mensual" inputMode="numeric" placeholder="89.000" value={form.precioMensual} onChange={(e) => setForm({ ...form, precioMensual: e.target.value })} className={campo} />
                  </div>
                  <div>
                    <label htmlFor="plan-anual" className={etiqueta}>Precio anual (COP)</label>
                    <input id="plan-anual" inputMode="numeric" placeholder="890.000" value={form.precioAnual} onChange={(e) => setForm({ ...form, precioAnual: e.target.value })} className={campo} />
                  </div>
                </div>
              )}
              <div className={esTrial ? "grid grid-cols-2 gap-4" : undefined}>
                <div>
                  <label htmlFor="plan-creditos" className={etiqueta}>Créditos de IA por mes</label>
                  <input
                    id="plan-creditos"
                    inputMode="numeric"
                    value={form.creditosIaMensuales}
                    disabled={form.rol === "consultor"}
                    onChange={(e) => setForm({ ...form, creditosIaMensuales: e.target.value })}
                    className={campo}
                  />
                  {form.rol === "consultor" && <p className="mt-1 text-xs text-ink-3">El consultor no tiene cupo de IA (RN-28).</p>}
                </div>
                {esTrial && (
                  <div>
                    <label htmlFor="plan-dias" className={etiqueta}>Días de prueba</label>
                    <input id="plan-dias" inputMode="numeric" value={form.diasTrial} onChange={(e) => setForm({ ...form, diasTrial: e.target.value })} className={campo} />
                  </div>
                )}
              </div>
              {esTrial && <p className="text-xs text-ink-3">El plan de prueba es gratis, de empresa y siempre activo: sin él no se pueden registrar empresas.</p>}
            </div>

            {errorModal && <div className="mt-4"><Aviso tipo="error">{errorModal}</Aviso></div>}

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={ocupado}>
                {editando ? "Guardar cambios" : "Crear plan"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
