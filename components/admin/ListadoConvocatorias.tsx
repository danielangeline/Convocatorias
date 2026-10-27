"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, FileStack, X } from "lucide-react";
import type { ConvocatoriaAdminListado, EstadoConvocatoria, FuenteAdmin } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { diasRestantes, formatCOP, formatFecha, ESTADO_CONVOCATORIA_LABEL, ESTADO_CONVOCATORIA_ESTILO } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { DeadlineChip } from "@/components/viz/Deadline";
import { Aviso } from "@/components/identidad/Campo";

const filtros: Array<{ valor: EstadoConvocatoria | "todas"; etiqueta: string }> = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "borrador", etiqueta: "Borrador" },
  { valor: "publicada", etiqueta: "Publicada" },
  { valor: "despublicada", etiqueta: "Despublicada" },
  { valor: "cerrada", etiqueta: "Cerrada" },
];

const claseCampo =
  "w-full rounded-lg border border-line bg-surface text-ink px-3 py-2 text-sm outline-none focus:border-pri";
const claseEtiqueta = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3";

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
      <PageHeader
        className="mb-5"
        titulo="Convocatorias"
        descripcion="Administra el ciclo de vida de cada convocatoria."
        accion={
          <Button variant="primary" onClick={abrirCrear}>
            <Plus className="h-4 w-4" /> Nueva convocatoria
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        etiqueta="Estado"
        valor={filtro}
        onChange={setFiltro}
        pestanas={filtros.map((f) => ({
          valor: f.valor,
          etiqueta: f.etiqueta,
          conteo: f.valor === "todas" ? convocatorias.length : convocatorias.filter((c) => c.estado === f.valor).length,
        }))}
      />

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
        <DataTable
          etiqueta="Convocatorias"
          filas={filtradas}
          clave={(c) => c.id}
          alHacerClic={(c) => router.push(`/admin/convocatorias/${c.id}`)}
          columnas={[
            {
              clave: "nombre",
              titulo: "Convocatoria",
              ancho: "minmax(0,2.6fr)",
              celda: (c) => (
                <>
                  <Link href={`/admin/convocatorias/${c.id}`} className="block truncate font-bold text-ink hover:text-pri-text">
                    {c.nombre}
                  </Link>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">{c.entidadConvocante || c.fuenteNombre || "—"}</span>
                </>
              ),
            },
            {
              clave: "monto",
              titulo: "Monto",
              ancho: "minmax(0,1.3fr)",
              celda: (c) => <span className="font-tabular font-semibold text-ink-2">{rango(c.montoMin, c.montoMax)}</span>,
            },
            {
              clave: "cierre",
              titulo: "Cierre",
              ancho: "130px",
              celda: (c) => {
                const d = diasRestantes(c.fechaCierre);
                return c.estado === "publicada" && d >= 0 && d < 15 ? (
                  <DeadlineChip dias={d} />
                ) : (
                  <span className="text-ink-2">{formatFecha(c.fechaCierre)}</span>
                );
              },
            },
            {
              clave: "estado",
              titulo: "Estado",
              ancho: "130px",
              celda: (c) => <Badge className={ESTADO_CONVOCATORIA_ESTILO[c.estado]}>{ESTADO_CONVOCATORIA_LABEL[c.estado]}</Badge>,
            },
            {
              clave: "acciones",
              titulo: "",
              ancho: "56px",
              alinear: "derecha",
              celda: (c) => (
                <LinkButton href={`/admin/convocatorias/${c.id}`} variant="ghost" size="sm" aria-label={`Editar ${c.nombre}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </LinkButton>
              ),
            },
          ]}
        />
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={crear}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-nueva"
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-nueva" className="font-display text-lg font-semibold text-ink">
                Nueva convocatoria
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-ink-3 hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {fuentesActivas.length === 0 ? (
              <p className="text-sm text-ink-2">
                Necesitas al menos una fuente activa para cargar convocatorias.{" "}
                <Link href="/admin/fuentes" className="font-semibold text-pri-text hover:underline">
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
                <p className="text-xs text-ink-3">Queda en borrador. El resto de la ficha se completa en el editor.</p>
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
