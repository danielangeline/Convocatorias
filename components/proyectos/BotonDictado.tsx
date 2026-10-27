"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RF-97 · Dictado por voz: graba en el navegador y, al detener, el servidor
 * transcribe el audio y el texto se entrega a quien lo usa (se añade al cuadro
 * de la explicación). Hasta 5 minutos; el audio no se guarda en ninguna parte.
 */

const MAX_SEGUNDOS = 300;
const TIPOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

type Estado = "inactivo" | "grabando" | "transcribiendo";

function formatoTiempo(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function BotonDictado({
  onTexto,
  onError,
  deshabilitado,
}: {
  onTexto: (texto: string) => void;
  onError: (mensaje: string | null) => void;
  deshabilitado?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [segundos, setSegundos] = useState(0);
  const grabador = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicio = useRef(0);

  // Al desmontar (cerrar el modal) se suelta el micrófono.
  useEffect(
    () => () => {
      if (reloj.current) clearInterval(reloj.current);
      const g = grabador.current;
      if (g && g.state !== "inactive") {
        g.onstop = null;
        g.stop();
      }
      g?.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const enviar = async (audio: Blob, duracion: number) => {
    setEstado("transcribiendo");
    const formulario = new FormData();
    formulario.append("audio", audio, "dictado");
    formulario.append("segundos", String(duracion));
    try {
      const r = await fetch("/api/proyectos/transcribir", { method: "POST", body: formulario });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) onError(json.error ?? "No pudimos transcribir el audio. Intenta de nuevo o escribe.");
      else onTexto(json.datos.texto as string);
    } catch {
      onError("No pudimos transcribir el audio. Revisa tu conexión e intenta de nuevo.");
    }
    setEstado("inactivo");
  };

  const detener = () => {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
    grabador.current?.stop();
  };

  const grabar = async () => {
    onError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError("Tu navegador no permite grabar audio. Puedes escribir la explicación.");
      return;
    }
    let flujo: MediaStream;
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("No tenemos permiso para usar el micrófono. Actívalo en tu navegador o escribe la explicación.");
      return;
    }
    const tipo = TIPOS.find((t) => MediaRecorder.isTypeSupported(t));
    const g = new MediaRecorder(flujo, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 32_000 });
    trozos.current = [];
    g.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.current.push(e.data);
    };
    g.onstop = () => {
      flujo.getTracks().forEach((t) => t.stop());
      const duracion = Math.round((Date.now() - inicio.current) / 1000);
      const audio = new Blob(trozos.current, { type: (g.mimeType || tipo || "audio/webm").split(";")[0] });
      if (audio.size === 0) {
        setEstado("inactivo");
        onError("No se grabó nada. Intenta de nuevo.");
        return;
      }
      void enviar(audio, duracion);
    };
    grabador.current = g;
    inicio.current = Date.now();
    setSegundos(0);
    g.start(1000);
    setEstado("grabando");
    reloj.current = setInterval(() => {
      const s = Math.round((Date.now() - inicio.current) / 1000);
      setSegundos(s);
      // CU-43 2b: a los 5 minutos se detiene sola y se transcribe lo grabado.
      if (s >= MAX_SEGUNDOS) detener();
    }, 250);
  };

  if (estado === "transcribiendo") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-violet/10 px-3 py-1.5 text-xs font-semibold text-violet-ink" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribiendo…
      </span>
    );
  }

  if (estado === "grabando") {
    return (
      <button
        type="button"
        onClick={detener}
        className="inline-flex items-center gap-2 rounded-full bg-rose/10 px-3 py-1.5 text-xs font-semibold text-rose-ink ring-1 ring-inset ring-rose/30 hover:bg-red-100"
        aria-label="Detener la grabación y transcribir"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        {formatoTiempo(segundos)}
        <Square className="h-3 w-3 fill-current" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={grabar}
      disabled={deshabilitado}
      title="Dictar con tu voz"
      aria-label="Dictar con tu voz"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 ring-1 ring-inset ring-line transition-colors",
        "hover:bg-violet/10 hover:text-violet-ink hover:ring-violet/30 disabled:cursor-not-allowed disabled:opacity-40"
      )}
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}
