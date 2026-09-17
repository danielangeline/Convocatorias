"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, FileStack, X } from "lucide-react";
import type { ConvocatoriaAdminListado, EstadoConvocatoria, FuenteAdmin } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { formatCOP, formatFecha, ESTADO_CONVOCATORIA_LABEL, ESTADO_CONVOCATORIA_ESTILO, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Aviso } from "@/components/identidad/Campo";

const filtros: Array<{ valor: EstadoConvocatoria | "todas"; etiqueta: string }> = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "borrador", etiqueta: "Borrador" },
  { valor: "publicada", etiqueta: "Publicada" },
  { valor: "despublicada", etiqueta: "Despublicada" },
  { valor: "cerrada", etiqueta: "Cerrada" },
];

const claseCampo =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500";
const claseEtiqueta = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint";

const rango = (min: number | null, max: number | null) =>
  min === null && max === null
    ? "—"
    : min !== null && max !== null
      ? `${formatCOP(min)} – ${formatCOP(max)}`
      : formatCOP((max ?? min) as number);

/**
 * CU-02 · Convocatorias en todos sus estados. Crear pide lo mínimo (fuente
 * activa, nombre, entidad y cierre) y lleva al editor en borrador. Ninguna se
 * elimina (RN-07); publicar y despublicar se hacen en el servidor (RF-09).
 */
export function ListadoConvocatorias({
  convocatorias,
  fuentesActivas,
}: {
  convocatorias: ConvocatoriaAdminListado[];
  fuentesActivas: FuenteAdmin[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<EstadoConvocatoria | "todas">("todas");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState({ fuenteId: "", nombre: "", entidadConvocante: "", fechaCierre: "" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const filtradas = useMemo(
    () => (filtro === "todas" ? convocatorias : convocatorias.filter((c) => c.estado === filtro)),
    [convocatorias, filtro]
  );

  const abrirCrear = () => {
    setForm({ fuenteId: fuentesActivas[0]?.id ?? "", nombre: "", entidadConvocante: "", fechaCierre: "" });
    setError(null);
    setModalAbierto(true);
  };

  const crear = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setOcupado(true);
    const r = await peticionAdmin<{ id: string }>("/api/admin/convocatorias", "POST", form);
    if (!r.ok) {
      setOcupado(false);
      setError(r.error);
      return;
    }
    router.push(`/admin/convocatorias/${r.datos.id}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Convocatorias</h1>
          <p className="text-sm text-ink-soft">Administra el ciclo de vida de cada convocatoria.</p>
        </div>
        <Button variant="primary" onClick={abrirCrear}>
          <Plus className="h-4 w-4" /> Nueva convocatoria
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            aria-pressed={filtro === f.valor}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
              filtro === f.valor ? "bg-primary-800 text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-slate-50"
            )}
          >
            {f.etiqueta}
            {f.valor !== "todas" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({convocatorias.filter((c) => c.estado === f.valor).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={FileStack}
          titulo={convocatorias.length === 0 ? "Aún no hay convocatorias" : "No hay convocatorias en este estado"}
          descripcion={
            convocatorias.length === 0
              ? "Crea la primera convocatoria a partir de una fuente activa."
              : "Cambia el filtro o crea una nueva convocatoria para empezar."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3">Convocatoria</th>
                <th className="px-5 py-3">Entidad</th>
                <th className="px-5 py-3">Monto</th>
                <th className="px-5 py-3">Cierre</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtradas.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="max-w-xs px-5 py-3">
                    <Link href={`/admin/convocatorias/${c.id}`} className="font-medium text-ink hover:text-primary-800">
                      {c.nombre}
                    </Link>
                    {c.fuenteNombre && <p className="mt-0.5 text-xs text-ink-faint">{c.fuenteNombre}</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{c.entidadConvocante || "—"}</td>
                  <td className="px-5 py-3 font-tabular text-ink-soft">{rango(c.montoMin, c.montoMax)}</td>
                  <td className="px-5 py-3 text-ink-soft">{formatFecha(c.fechaCierre)}</td>
                  <td className="px-5 py-3">
                    <Badge className={ESTADO_CONVOCATORIA_ESTILO[c.estado]}>{ESTADO_CONVOCATORIA_LABEL[c.estado]}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <LinkButton
                        href={`/admin/convocatorias/${c.id}`}
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${c.nombre}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </LinkButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <form
            onSubmit={crear}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-nueva"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-nueva" className="font-display text-lg font-semibold text-ink">
                Nueva convocatoria
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-ink-faint hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {fuentesActivas.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Necesitas al menos una fuente activa para cargar convocatorias.{" "}
                <Link href="/admin/fuentes" className="font-semibold text-primary-700 hover:underline">
                  Registrar una fuente
                </Link>
              </p>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className={claseEtiqueta}>Fuente</span>
                  <select
                    value={form.fuenteId}
                    onChange={(e) => setForm({ ...form, fuenteId: e.target.value })}
                    className={claseCampo}
                    required
                  >
                    {fuentesActivas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={claseEtiqueta}>Nombre de la convocatoria</span>
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className={claseCampo}
                    required
                    maxLength={300}
                  />
                </label>
                <label className="block">
                  <span className={claseEtiqueta}>Entidad convocante</span>
                  <input
                    value={form.entidadConvocante}
                    onChange={(e) => setForm({ ...form, entidadConvocante: e.target.value })}
                    className={claseCampo}
                    required
                    maxLength={200}
                  />
                </label>
                <label className="block">
                  <span className={claseEtiqueta}>Fecha de cierre</span>
                  <input
                    type="date"
                    value={form.fechaCierre}
                    onChange={(e) => setForm({ ...form, fechaCierre: e.target.value })}
                    className={claseCampo}
                    required
                  />
                </label>
                <p className="text-xs text-ink-faint">Queda en borrador. El resto de la ficha se completa en el editor.</p>
                {error && <Aviso tipo="error">{error}</Aviso>}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              {fuentesActivas.length > 0 && (
                <Button type="submit" variant="primary" disabled={ocupado}>
                  {ocupado ? "Creando…" : "Crear borrador"}
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
