"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Info, Sparkles } from "lucide-react";
import type { PlantillaAdmin } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { cn } from "@/lib/utils";
import { fechaHoraColombia } from "@/lib/fechas";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/identidad/Campo";

const usd = (v: number | null, decimales = 4) => (v === null ? "—" : `USD ${v.toLocaleString("es-CO", { maximumFractionDigits: decimales })}`);
const entero = (v: number | null) => (v === null ? "—" : Math.round(v).toLocaleString("es-CO"));

/**
 * CU-37 · RF-63 · Versiones de la plantilla de generación.
 *
 * Una versión no se edita (docs/05 §9.27): el formulario parte de la elegida y
 * guarda la siguiente, inactiva. Activar deja una sola activa. Las cifras de
 * cada versión salen de sus documentos y consumos (CU-37 paso 4). Quien decide
 * todo es el servidor; la pantalla solo muestra su respuesta (RNF-20).
 *
 * Sesión 030 (RF-99): la misma pantalla administra, en otra pestaña, la
 * plantilla de creación de proyectos (CU-43), que no tiene tope de TDR y cuyas
 * cifras son propuestas entregadas, no documentos.
 */
export type TipoPlantilla = "documento" | "proyecto";

const TEXTOS: Record<TipoPlantilla, { api: string; descripcion: string; aviso: string; usa: string; hechos: string }> = {
  documento: {
    api: "/api/admin/plantillas",
    descripcion: "La instrucción, el modelo y los precios con que la IA redacta el documento base.",
    aviso:
      "Una versión guardada no se modifica: al editar se crea la siguiente, inactiva. Cada documento registra con qué versión se generó, así que activar otra no cambia los ya generados.",
    usa: "Las próximas generaciones la usarán.",
    hechos: "Documentos",
  },
  proyecto: {
    api: "/api/admin/plantillas/proyecto",
    descripcion: "La instrucción, el modelo y los precios con que la IA arma un proyecto a partir de lo que la empresa cuenta o dicta.",
    aviso:
      "Una versión guardada no se modifica: al editar se crea la siguiente, inactiva. La forma de la respuesta, las listas de departamentos y categorías y la regla de no guardar nada sin que la empresa confirme las fija el servidor: la instrucción no las cambia. Conserva las reglas de veracidad (RN-37).",
    usa: "Los próximos proyectos creados con IA la usarán.",
    hechos: "Propuestas",
  },
};

export function GestionPlantillas({ plantillas, tipo = "documento" }: { plantillas: PlantillaAdmin[]; tipo?: TipoPlantilla }) {
  const textos = TEXTOS[tipo];
  const router = useRouter();
  const inicial = plantillas.find((p) => p.activa) ?? plantillas[0];
  const [seleccionadaId, setSeleccionadaId] = useState(inicial?.id ?? "");
  const seleccionada = plantillas.find((p) => p.id === seleccionadaId) ?? inicial;
  const desde = (p: PlantillaAdmin | undefined) => ({
    contenido: p?.contenido ?? "",
    modelo: p?.modelo ?? "gpt-5.4-mini",
    entrada: String(p?.precioEntradaUsdMtok ?? ""),
    salida: String(p?.precioSalidaUsdMtok ?? ""),
    tope: String(p?.topeCaracteresTdr ?? 60000),
  });
  const [borrador, setBorrador] = useState(desde(seleccionada));
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const elegir = (p: PlantillaAdmin) => {
    setSeleccionadaId(p.id);
    setBorrador(desde(p));
    setError(null);
    setAviso(null);
  };

  const sinCambios =
    !!seleccionada &&
    borrador.contenido.trim() === seleccionada.contenido.trim() &&
    borrador.modelo.trim() === seleccionada.modelo &&
    Number(borrador.entrada) === seleccionada.precioEntradaUsdMtok &&
    Number(borrador.salida) === seleccionada.precioSalidaUsdMtok &&
    (tipo === "proyecto" || Number(borrador.tope) === seleccionada.topeCaracteresTdr);

  const guardar = async () => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await peticionAdmin<{ id: string }>(textos.api, "POST", {
      contenido: borrador.contenido,
      modelo: borrador.modelo,
      precioEntradaUsdMtok: Number(borrador.entrada),
      precioSalidaUsdMtok: Number(borrador.salida),
      ...(tipo === "documento" ? { topeCaracteresTdr: Number(borrador.tope) } : {}),
    });
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setAviso(r.aviso);
    setSeleccionadaId(r.datos.id);
    router.refresh();
  };

  const activar = async (p: PlantillaAdmin) => {
    if (!window.confirm(`¿Activar la versión ${p.version}? ${textos.usa}`)) return;
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await peticionAdmin(`${textos.api}/${p.id}/activar`, "POST", {});
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setAviso(r.aviso);
    router.refresh();
  };

  const campo = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal-500";

  return (
    <div>
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <Sparkles className="h-3.5 w-3.5" /> Módulo de IA
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Plantillas de la IA</h1>
        <p className="text-sm text-ink-soft">{textos.descripcion}</p>
      </div>

      <nav aria-label="Plantillas" className="mb-5 flex gap-1 border-b border-line">
        {(
          [
            ["documento", "Documento base", "/admin/plantillas"],
            ["proyecto", "Creación de proyectos", "/admin/plantillas?tipo=proyecto"],
          ] as const
        ).map(([clave, nombre, href]) => (
          <Link
            key={clave}
            href={href}
            aria-current={tipo === clave ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              tipo === clave ? "border-teal-600 text-teal-700" : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            {nombre}
          </Link>
        ))}
      </nav>

      <div className="mb-6 flex items-start gap-2 rounded-xl border border-line-soft bg-slate-50 px-4 py-3 text-xs text-ink-faint">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {textos.aviso}
      </div>

      {(error || aviso) && (
        <div className="mb-4">
          {error ? <Aviso tipo="error">{error}</Aviso> : <Aviso tipo="exito">{aviso}</Aviso>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-2">
          {plantillas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegir(p)}
              className={cn(
                "block w-full rounded-xl border p-4 text-left transition-colors",
                seleccionada?.id === p.id ? "border-teal-400 bg-teal-50/40" : "border-line hover:border-teal-200"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold text-ink">Versión {p.version}</span>
                {p.activa && <Badge className="bg-teal-50 text-teal-700 ring-teal-200">Activa</Badge>}
              </div>
              <p className="mt-1 break-words text-xs text-ink-faint">
                {p.modelo} · creada el {fechaHoraColombia(p.creadoAt)}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-soft">
                <dt>{textos.hechos}</dt>
                <dd className="text-right font-medium text-ink">{p.documentos.toLocaleString("es-CO")}</dd>
                <dt>Fallidas</dt>
                <dd className="text-right font-medium text-ink">{p.generacionesFallidas.toLocaleString("es-CO")}</dd>
                <dt>Costo medio</dt>
                <dd className="text-right font-medium text-ink">{usd(p.costoPromedioUsd)}</dd>
                <dt>Tokens (ent./sal.)</dt>
                <dd className="text-right font-medium text-ink">
                  {entero(p.tokensEntradaPromedio)} / {entero(p.tokensSalidaPromedio)}
                </dd>
                {tipo === "documento" && (
                  <>
                    <dt>Pendientes medios</dt>
                    <dd className="text-right font-medium text-ink">
                      {p.pendientesPromedio === null ? "—" : p.pendientesPromedio.toLocaleString("es-CO")}
                    </dd>
                  </>
                )}
              </dl>
            </button>
          ))}
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <label htmlFor="plantilla-contenido" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Instrucción {seleccionada && `(a partir de la versión ${seleccionada.version})`}
          </label>
          <textarea
            id="plantilla-contenido"
            value={borrador.contenido}
            onChange={(e) => setBorrador({ ...borrador, contenido: e.target.value })}
            rows={18}
            className="w-full resize-y rounded-lg border border-line px-4 py-3 font-mono text-sm leading-relaxed outline-none focus:border-teal-500"
          />
          <p className="mt-1 text-right text-xs text-ink-faint">{borrador.contenido.trim().length.toLocaleString("es-CO")} caracteres</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">Modelo de OpenAI</span>
              <input className={campo} value={borrador.modelo} onChange={(e) => setBorrador({ ...borrador, modelo: e.target.value })} />
            </label>
            {tipo === "documento" && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">Tope del TDR (caracteres)</span>
                <input className={campo} inputMode="numeric" value={borrador.tope} onChange={(e) => setBorrador({ ...borrador, tope: e.target.value })} />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">Precio de entrada (USD por millón de tokens)</span>
              <input className={campo} inputMode="decimal" value={borrador.entrada} onChange={(e) => setBorrador({ ...borrador, entrada: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">Precio de salida (USD por millón de tokens)</span>
              <input className={campo} inputMode="decimal" value={borrador.salida} onChange={(e) => setBorrador({ ...borrador, salida: e.target.value })} />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Los precios se copian de la tabla del proveedor y sirven para el costo estimado de cada uso.</p>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            {seleccionada && !seleccionada.activa && (
              <Button variant="secondary" onClick={() => activar(seleccionada)} disabled={ocupado}>
                <Check className="h-4 w-4" /> Activar la versión {seleccionada.version}
              </Button>
            )}
            <Button variant="teal" onClick={guardar} disabled={ocupado || sinCambios}>
              Guardar como versión nueva
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
