"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { peticionAdmin } from "@/lib/admin/peticion";
import { hoyColombia } from "@/lib/fechas";
import { formatFecha } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/identidad/Campo";
import type { TasaAdmin } from "@/lib/admin/tasas";

const claseCampo = "w-full rounded-lg border border-line bg-surface text-ink px-3 py-2 text-sm outline-none focus:border-pri";
const MONEDAS_FRECUENTES = ["USD", "EUR", "GBP", "CHF", "CAD"];
const pesos = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 4 }).format(v);

/**
 * RF-117, RN-40 · Tasas de referencia. Cuántos pesos vale una unidad de cada
 * moneda, para comparar en pesos los montos de las convocatorias en otra
 * moneda (filtro y orden por monto, criterio de monto de las sugerencias) y
 * mostrar «≈ $X COP». Nunca cambian el monto guardado. Quien valida es el
 * servidor (RNF-20).
 */
export function GestionTasas({ tasas, monedas }: { tasas: TasaAdmin[]; monedas: { codigo: string; nombre: string }[] }) {
  const router = useRouter();
  const [moneda, setMoneda] = useState("USD");
  const [tasa, setTasa] = useState("");
  const [fecha, setFecha] = useState(hoyColombia());
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const opciones = [
    ...MONEDAS_FRECUENTES.map((c) => monedas.find((m) => m.codigo === c)).filter((m): m is { codigo: string; nombre: string } => !!m),
    ...monedas.filter((m) => m.codigo !== "COP" && !MONEDAS_FRECUENTES.includes(m.codigo)),
  ];

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setExito(null);
    const r = await peticionAdmin("/api/admin/tasas", "PUT", { moneda, copPorUnidad: tasa, vigenteDesde: fecha });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setExito(`Tasa de ${moneda} guardada.`);
    setTasa("");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <ArrowLeftRight className="h-5 w-5 text-pri-text" />
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">Tasas de referencia</h1>
          <p className="text-sm text-ink-2">
            Cuántos pesos vale una unidad de cada moneda. Solo sirven para comparar en pesos las convocatorias con montos en otra moneda; el monto
            guardado nunca cambia.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      {exito && (
        <div className="mb-4">
          <Aviso tipo="exito">{exito}</Aviso>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">Tasas vigentes</h2>
          {tasas.length === 0 ? (
            <p className="text-sm text-ink-3">
              Todavía no hay ninguna. Sin tasa, una convocatoria en otra moneda no entra en el filtro ni en el orden por monto, y el criterio de monto de las
              sugerencias no coincide.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="py-2 pr-3 font-semibold">Moneda</th>
                    <th className="py-2 pr-3 font-semibold">Pesos por unidad</th>
                    <th className="py-2 pr-3 font-semibold">Vigente desde</th>
                  </tr>
                </thead>
                <tbody>
                  {tasas.map((t) => (
                    <tr key={t.moneda} className="border-t border-line-2">
                      <td className="py-2 pr-3">
                        <span className="font-semibold text-ink">{t.moneda}</span> <span className="text-ink-3">· {t.nombreMoneda}</span>
                      </td>
                      <td className="py-2 pr-3 font-tabular">{pesos(t.copPorUnidad)}</td>
                      <td className="py-2 pr-3 text-ink-2">{formatFecha(t.vigenteDesde)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form onSubmit={guardar} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-sm font-semibold text-ink">Fijar o cambiar una tasa</h2>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-ink-2">Moneda</span>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={claseCampo}>
              {opciones.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.codigo} · {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-ink-2">Pesos colombianos por 1 {moneda}</span>
            <input
              type="text"
              inputMode="decimal"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
              placeholder="Ej. 4.150,25"
              className={claseCampo}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-ink-2">Vigente desde</span>
            <input type="date" value={fecha} max={hoyColombia()} onChange={(e) => setFecha(e.target.value)} className={claseCampo} required />
          </label>
          <p className="text-xs text-ink-3">Si la moneda ya tiene tasa, se reemplaza. Queda quién la cambió y cuándo.</p>
          <Button type="submit" disabled={guardando || !tasa.trim()}>
            {guardando ? "Guardando…" : "Guardar tasa"}
          </Button>
        </form>
      </div>
    </div>
  );
}
