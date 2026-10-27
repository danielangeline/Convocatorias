"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { textoCreditos, useCreditos, useTarifas } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { BotonDictado } from "./BotonDictado";

/**
 * CU-47, RF-109 · «Editar con IA» dentro de un apartado del proyecto. La
 * persona dice qué quiere cambiar —escribiendo o dictando (RF-97)— y la IA
 * propone el texto nuevo; solo pasa al apartado si la persona lo acepta
 * (RN-37). Cobra la tarifa «editar apartado» solo si la propuesta llega (RN-17).
 */
export function EditarConIA({
  proyectoId,
  apartado,
  textoActual,
  onAceptar,
}: {
  proyectoId: string;
  apartado: string;
  textoActual: string;
  onAceptar: (texto: string) => void;
}) {
  const router = useRouter();
  const { disponibles, vigente } = useCreditos();
  const costo = useTarifas().edicion_apartado;
  const [abierto, setAbierto] = useState(false);
  const [instruccion, setInstruccion] = useState("");
  const [parcial, setParcial] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<{ texto: string; faltantes: string[] } | null>(null);
  const sinCredito = !vigente || disponibles < costo;

  const pedir = async () => {
    setError(null);
    if (instruccion.trim().length < 5) {
      setError("Cuéntale a la IA qué quieres cambiar en este apartado.");
      return;
    }
    setOcupado(true);
    const r = await fetch(`/api/proyectos/${proyectoId}/editar-con-ia`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apartado, instruccion, textoActual }),
    }).catch(() => null);
    const json = r ? await r.json().catch(() => ({})) : {};
    setOcupado(false);
    if (!r?.ok) {
      setError(json.error ?? "No pudimos conectarnos. Revisa tu conexión e intenta de nuevo. No se descontó ningún crédito.");
      return;
    }
    setPropuesta(json.datos);
    // El crédito ya se descontó: el indicador del menú se actualiza.
    router.refresh();
  };

  const cerrar = () => {
    setAbierto(false);
    setPropuesta(null);
    setError(null);
    setParcial("");
  };

  if (!abierto) {
    return (
      <Button type="button" variant="ai" size="sm" onClick={() => setAbierto(true)}>
        <Sparkles className="h-3.5 w-3.5" /> Editar con IA
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-violet/30 bg-violet/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-violet-ink">
          <Sparkles className="h-4 w-4" /> ¿Qué quieres cambiar?
        </p>
        <button
          type="button"
          onClick={cerrar}
          disabled={ocupado}
          aria-label="Cerrar la edición con IA"
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-surface hover:text-ink disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!propuesta ? (
        <>
          <div className="mt-2 rounded-xl border border-line bg-surface focus-within:border-violet">
            <textarea
              value={parcial ? `${instruccion ? `${instruccion.trimEnd()} ` : ""}${parcial}` : instruccion}
              onChange={(e) => setInstruccion(e.target.value.slice(0, 2000))}
              readOnly={parcial !== ""}
              disabled={ocupado}
              rows={3}
              placeholder="Ej.: hazlo más concreto y menciona a las 120 familias; o: divídelo en tres objetivos medibles."
              className="block min-h-[84px] w-full resize-y rounded-t-xl bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none"
            />
            <div className="flex items-center justify-between gap-3 border-t border-line-2 px-2 py-1.5">
              <BotonDictado
                onTexto={(t) => setInstruccion((a) => (a.trim() ? `${a.trimEnd()} ${t}` : t).slice(0, 2000))}
                onParcial={setParcial}
                onError={setError}
                deshabilitado={ocupado || sinCredito}
              />
              <span className="text-xs text-ink-3">Escribe o dicta</span>
            </div>
          </div>
          {sinCredito && (
            <p className="mt-2 rounded-lg bg-amber/10 px-3 py-2 text-[13px] text-amber-ink">
              {vigente
                ? `Editar con IA cuesta ${textoCreditos(costo)} y te quedan ${textoCreditos(disponibles)}. Puedes editarlo a mano.`
                : "Necesitas una suscripción vigente para editar con IA. Puedes editarlo a mano."}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 rounded-lg bg-rose/10 px-3 py-2 text-[13px] text-rose-ink">
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="ai" onClick={pedir} disabled={ocupado || sinCredito || !instruccion.trim()}>
              {ocupado ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Proponiendo…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Proponer cambio · {textoCreditos(costo)}
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs font-bold uppercase tracking-[.07em] text-ink-3">Propuesta de la IA</p>
          <div className="mt-1.5 max-h-[50vh] min-h-[96px] resize-y overflow-auto whitespace-pre-line rounded-xl border border-line bg-surface p-3 text-[14px] leading-relaxed text-ink">
            {propuesta.texto}
          </div>
          {propuesta.faltantes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {propuesta.faltantes.map((f) => (
                <span key={f} className="rounded-full bg-amber/15 px-2.5 py-1 text-xs font-semibold text-amber-ink">
                  Falta: {f}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-ink-3">
            La IA solo usó lo que ya dice tu proyecto. Lo que no sabe quedó como [COMPLETAR: …].
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPropuesta(null)}>
              Descartar
            </Button>
            <Button
              type="button"
              onClick={() => {
                onAceptar(propuesta.texto);
                cerrar();
              }}
            >
              <Check className="h-4 w-4" /> Usar esta versión
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
