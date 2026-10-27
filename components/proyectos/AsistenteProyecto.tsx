"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine, Sparkles, X } from "lucide-react";
import type { PropuestaProyecto } from "@/lib/types";
import { textoCreditos, useCreditos, useTarifas } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { BotonDictado, dictadoEnVivoDisponible } from "./BotonDictado";
import { cuerpoDeFormulario, desdePropuesta } from "@/components/ProyectoFormModal";

/**
 * CU-43 · Primer paso de "Nuevo proyecto": la empresa cuenta su proyecto,
 * escribiendo o dictando (RF-97), la IA arma la propuesta (RF-96) y el
 * proyecto se guarda enseguida para editarlo en su ficha (RF-98, RN-37). Es
 * opcional: "Llenar el formulario a mano" abre CU-09 vacío, sin costo.
 */

const sinSuscripcion = () => () => {};

const MIN = 80;
const MAX = 8000;

export function AsistenteProyecto({
  onCreado,
  onPropuesta,
  onManual,
  onClose,
}: {
  /** RF-98: el proyecto ya quedó guardado; `faltantes` es lo que la explicación no dijo. */
  onCreado: (id: string, faltantes: string[]) => void;
  /** 6a: si el guardado falla, la propuesta abre el formulario para no perderla. */
  onPropuesta: (p: PropuestaProyecto) => void;
  onManual: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { disponibles, vigente } = useCreditos();
  // RN-17: crear con IA cuesta la tarifa vigente (50 al iniciar la sesión 030).
  const costo = useTarifas().estructuracion;
  const [explicacion, setExplicacion] = useState("");
  // RF-97 en vivo: lo que el navegador aún está reconociendo (puede cambiar).
  const [parcial, setParcial] = useState("");
  const enVivo = useSyncExternalStore(sinSuscripcion, dictadoEnVivoDisponible, () => false);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [etapa, setEtapa] = useState<"armando" | "guardando">("armando");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creando) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, creando]);

  const largo = explicacion.trim().length;
  const sinCredito = !vigente || disponibles < costo;

  const agregarDictado = (texto: string) => {
    setExplicacion((actual) => {
      const junto = actual.trim() ? `${actual.trimEnd()} ${texto}` : texto;
      return junto.slice(0, MAX);
    });
  };

  const crear = async () => {
    setError(null);
    if (largo < MIN) {
      setError("Cuéntanos un poco más: qué hace el proyecto, para quién, dónde y cuánto necesitas.");
      return;
    }
    setCreando(true);
    setEtapa("armando");
    try {
      const r = await fetch("/api/proyectos/estructurar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ explicacion }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.error ?? "No pudimos armar el proyecto con IA. No se descontó ningún crédito.");
        setCreando(false);
        return;
      }
      // El crédito ya se descontó: el indicador de créditos se actualiza.
      router.refresh();
      const propuesta = json.datos as PropuestaProyecto;
      // RF-98: se guarda enseguida por CU-09, con las validaciones de siempre.
      setEtapa("guardando");
      const g = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpoDeFormulario(desdePropuesta(propuesta))),
      }).catch(() => null);
      const gj = g ? await g.json().catch(() => ({})) : {};
      if (g?.ok && gj?.datos?.id) {
        onCreado(gj.datos.id as string, propuesta.faltantes);
        return;
      }
      onPropuesta(propuesta);
    } catch {
      setError("No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.");
      setCreando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo proyecto"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">Nuevo proyecto</h3>
          <button onClick={onClose} disabled={creando} className="text-ink-3 hover:text-ink disabled:opacity-40" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-violet-ink">
          <Sparkles className="h-4 w-4" /> Cuéntanos tu proyecto y la IA lo crea por ti
        </p>

        <label htmlFor="explicacion-proyecto" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
          ¿De qué trata tu proyecto?
        </label>
        <div className="rounded-xl border border-line focus-within:border-violet">
          <textarea
            id="explicacion-proyecto"
            value={parcial ? `${explicacion ? `${explicacion.trimEnd()} ` : ""}${parcial}` : explicacion}
            onChange={(e) => setExplicacion(e.target.value.slice(0, MAX))}
            readOnly={parcial !== ""}
            aria-live="polite"
            disabled={creando}
            rows={8}
            placeholder="Escribe o dicta con el micrófono: qué problema resuelve, a quién beneficia, dónde se ejecuta, qué actividades harás, cuánto dinero buscas, en cuánto tiempo y qué experiencia tiene tu empresa."
            className="block w-full resize-none rounded-t-xl bg-surface px-3 py-2.5 text-sm text-ink outline-none disabled:bg-surface-2"
          />
          <div className="flex items-center justify-between gap-3 border-t border-line-2 px-2 py-1.5">
            <BotonDictado onTexto={agregarDictado} onParcial={setParcial} onError={setError} deshabilitado={creando || sinCredito} />
            <span className={`text-xs ${largo > 0 && largo < MIN ? "text-amber-ink" : "text-ink-3"}`}>
              {largo < MIN ? `${largo}/${MIN} caracteres mínimos` : `${largo.toLocaleString("es-CO")} caracteres`}
            </span>
          </div>
        </div>

        <p className="mt-2 text-xs text-ink-3">
          {enVivo && "Al dictar, las palabras aparecen mientras hablas: las reconoce tu navegador (en Chrome, con el servicio de voz de Google). "}
          La IA usa solo lo que tú cuentes. Creamos el proyecto y lo abrimos para que revises y edites cada parte; lo que no digas queda vacío y marcado. Ni el audio ni el texto se guardan.
        </p>

        {sinCredito && (
          <p className="mt-3 rounded-lg bg-amber/10 px-3 py-2.5 text-sm text-amber-ink">
            {vigente
              ? `Crear con IA cuesta ${textoCreditos(costo)} y te quedan ${textoCreditos(disponibles)}. Puedes llenar el formulario a mano sin costo.`
              : "Necesitas una suscripción vigente para crear el proyecto con IA. Puedes llenar el formulario a mano."}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose/10 px-3 py-2.5 text-sm text-rose-ink">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={onManual} disabled={creando}>
            <PencilLine className="h-4 w-4" /> Llenar el formulario a mano
          </Button>
          <Button variant="ai" onClick={crear} disabled={creando || sinCredito || largo === 0}>
            {creando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {etapa === "armando" ? "Armando tu proyecto…" : "Guardando…"}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Crear con IA · {textoCreditos(costo)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
