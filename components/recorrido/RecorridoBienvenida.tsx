"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { pedir } from "@/lib/pedir";
import { cn } from "@/lib/utils";
import { PASOS_EMPRESA } from "./pasos";

/** Lo dispara «Ver el recorrido» en Ajustes (CU-51 6a). */
export const EVENTO_ABRIR_RECORRIDO = "recorrido:abrir";

const ANCHO = 320;
const MARGEN = 16;
const SEPARACION = 14;
const sinSuscripcion = () => () => {};

type Caja = { top: number; left: number; width: number; height: number };

/** El primer elemento visible con ese `data-recorrido` (el menú existe dos veces: fijo y en el drawer). */
function buscarObjetivo(objetivo: string): HTMLElement | null {
  const candidatos = document.querySelectorAll<HTMLElement>(`[data-recorrido="${CSS.escape(objetivo)}"]`);
  for (const el of candidatos) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Al lado derecho si cabe (menú lateral), si no debajo, encima o a la izquierda; siempre dentro de la ventana. */
function ubicarRecuadro(objetivo: Caja | null, alto: number): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(ANCHO, vw - MARGEN * 2);
  const limitar = (v: number, max: number) => Math.max(MARGEN, Math.min(v, max));
  if (!objetivo) return { top: limitar((vh - alto) / 2, vh - alto - MARGEN), left: (vw - ancho) / 2 };

  const centroY = objetivo.top + objetivo.height / 2 - alto / 2;
  const centroX = objetivo.left + objetivo.width / 2 - ancho / 2;
  let top: number;
  let left: number;
  if (objetivo.left + objetivo.width + SEPARACION + ancho <= vw - MARGEN) {
    left = objetivo.left + objetivo.width + SEPARACION;
    top = centroY;
  } else if (objetivo.top + objetivo.height + SEPARACION + alto <= vh - MARGEN) {
    top = objetivo.top + objetivo.height + SEPARACION;
    left = centroX;
  } else if (objetivo.top - SEPARACION - alto >= MARGEN) {
    top = objetivo.top - SEPARACION - alto;
    left = centroX;
  } else {
    left = objetivo.left - SEPARACION - ancho;
    top = centroY;
  }
  return { top: limitar(top, vh - alto - MARGEN), left: limitar(left, vw - ancho - MARGEN) };
}

/**
 * RF-119 · Recorrido guiado de bienvenida del portal Empresa (CU-51). Resalta
 * cada sección del menú y de la barra superior con un recuadro al lado. Al
 * terminar u omitir se registra en la cuenta y no vuelve a abrirse solo.
 */
export function RecorridoBienvenida({ abrirAlInicio }: { abrirAlInicio: boolean }) {
  const router = useRouter();
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const [abierto, setAbierto] = useState(abrirAlInicio);
  const [indice, setIndice] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const recuadro = useRef<HTMLDivElement>(null);
  const registrado = useRef(!abrirAlInicio);

  const paso = PASOS_EMPRESA[indice];
  const total = PASOS_EMPRESA.length;
  const esUltimo = indice === total - 1;

  const cerrar = useCallback(() => {
    setAbierto(false);
    if (!registrado.current) {
      registrado.current = true;
      // CU-51 6b: si falla, el recorrido se cierra igual.
      void pedir("/api/cuenta/recorrido");
    }
  }, []);

  const siguiente = useCallback(() => {
    if (esUltimo) cerrar();
    else setIndice((i) => i + 1);
  }, [esUltimo, cerrar]);
  const anterior = useCallback(() => setIndice((i) => Math.max(0, i - 1)), []);

  // «Ver el recorrido» en Ajustes.
  useEffect(() => {
    const abrir = () => {
      setIndice(0);
      setAbierto(true);
    };
    window.addEventListener(EVENTO_ABRIR_RECORRIDO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_RECORRIDO, abrir);
  }, []);

  // Medir el objetivo y ubicar el recuadro; se repite al cambiar el tamaño o desplazarse.
  useLayoutEffect(() => {
    if (!abierto || !montado) return;
    const el = paso.objetivo ? buscarObjetivo(paso.objetivo) : null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const medir = () => {
      const r = el?.getBoundingClientRect();
      const nueva = r && r.width > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setCaja(nueva);
      setPos(ubicarRecuadro(nueva, recuadro.current?.offsetHeight ?? 220));
    };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [abierto, montado, paso]);

  useEffect(() => {
    if (abierto) recuadro.current?.querySelector<HTMLButtonElement>("[data-principal]")?.focus();
  }, [abierto, indice]);

  useEffect(() => {
    if (!abierto) return;
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      else if (e.key === "ArrowRight") siguiente();
      else if (e.key === "ArrowLeft") anterior();
    };
    document.addEventListener("keydown", teclas);
    return () => document.removeEventListener("keydown", teclas);
  }, [abierto, cerrar, siguiente, anterior]);

  if (!montado || !abierto) return null;

  const HOLGURA = 5;
  return (
    <div className="fixed inset-0 z-[60]">
      {/* Bloquea los clics en la página mientras dura el recorrido. */}
      <div className={cn("absolute inset-0", !caja && "bg-overlay")} aria-hidden />
      {caja && (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[12px] ring-2 ring-pri motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: caja.top - HOLGURA,
            left: caja.left - HOLGURA,
            width: caja.width + HOLGURA * 2,
            height: caja.height + HOLGURA * 2,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
          }}
        />
      )}

      <div
        ref={recuadro}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recorrido-titulo"
        aria-describedby="recorrido-texto"
        className="fixed flex flex-col gap-3 rounded-md border border-line bg-surface p-4 text-ink shadow-[var(--shadow)] motion-safe:transition-[top,left] motion-safe:duration-200"
        style={{
          width: `min(${ANCHO}px, calc(100vw - ${MARGEN * 2}px))`,
          top: pos?.top ?? MARGEN,
          left: pos?.left ?? MARGEN,
          visibility: pos ? "visible" : "hidden",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="font-tabular text-[11px] font-bold uppercase tracking-[.09em] text-pri-text">
            Paso {indice + 1} de {total}
          </div>
          {!esUltimo && (
            <button
              type="button"
              onClick={cerrar}
              className="-mr-1 cursor-pointer rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline"
            >
              Omitir tutorial
            </button>
          )}
        </div>
        <div>
          <h2 id="recorrido-titulo" className="m-0 text-[15px] font-bold leading-tight">
            {paso.titulo}
          </h2>
          <p id="recorrido-texto" className="m-0 mt-1.5 text-[13px] leading-relaxed text-ink-2">
            {paso.texto}
          </p>
        </div>
        <div className="flex gap-1" aria-hidden>
          {PASOS_EMPRESA.map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i <= indice ? "bg-pri" : "bg-line")} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          {esUltimo ? (
            <Button variant="ghost" size="sm" onClick={cerrar} className="-ml-2 px-2">
              Cerrar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {indice > 0 && (
              <Button variant="secondary" size="sm" onClick={anterior}>
                Anterior
              </Button>
            )}
            {esUltimo ? (
              <Button
                data-principal
                size="sm"
                onClick={() => {
                  cerrar();
                  router.push("/proyectos");
                }}
              >
                Ir a Proyectos
              </Button>
            ) : (
              <Button data-principal size="sm" onClick={siguiente}>
                {indice === 0 ? "Empezar" : "Siguiente"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
