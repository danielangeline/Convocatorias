"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RF-97 · Dictado por voz.
 *
 * - **En vivo** (sesión 031): si el navegador trae reconocimiento de voz, las
 *   palabras se entregan mientras la persona habla (`onParcial` con lo que aún
 *   puede cambiar y `onTexto` con cada frase ya fija). Lo procesa el servicio
 *   de voz del navegador, no esta plataforma; no consume crédito.
 * - **Grabación**: si no, graba en el navegador y, al detener, el servidor
 *   transcribe el audio con el proveedor de IA y el texto llega por `onTexto`.
 *
 * Hasta 5 minutos; el audio no se guarda en ninguna parte.
 */

const MAX_SEGUNDOS = 300;
const TIPOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

type Estado = "inactivo" | "grabando" | "transcribiendo";

interface ResultadoVoz {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoVoz {
  resultIndex: number;
  results: { length: number; [i: number]: ResultadoVoz };
}
interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type ClaseReconocedor = new () => Reconocedor;

function claseReconocedor(): ClaseReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ClaseReconocedor; webkitSpeechRecognition?: ClaseReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** ¿Este navegador puede dictar en vivo? (para el aviso junto al micrófono). */
export function dictadoEnVivoDisponible(): boolean {
  return claseReconocedor() !== null;
}

function formatoTiempo(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function BotonDictado({
  onTexto,
  onParcial,
  onError,
  deshabilitado,
}: {
  onTexto: (texto: string) => void;
  /** Con esta prop, y si el navegador puede, el dictado es en vivo. */
  onParcial?: (texto: string) => void;
  onError: (mensaje: string | null) => void;
  deshabilitado?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [segundos, setSegundos] = useState(0);
  const [modo, setModo] = useState<"vivo" | "grabacion">("grabacion");
  const grabador = useRef<MediaRecorder | null>(null);
  const reconocedor = useRef<Reconocedor | null>(null);
  const escuchando = useRef(false);
  const trozos = useRef<Blob[]>([]);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicio = useRef(0);

  // Al desmontar (cerrar el modal) se suelta el micrófono.
  useEffect(
    () => () => {
      if (reloj.current) clearInterval(reloj.current);
      escuchando.current = false;
      reconocedor.current?.abort();
      const g = grabador.current;
      if (g && g.state !== "inactive") {
        g.onstop = null;
        g.stop();
      }
      g?.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const arrancarReloj = (alLlegarAlMaximo: () => void) => {
    inicio.current = Date.now();
    setSegundos(0);
    reloj.current = setInterval(() => {
      const s = Math.round((Date.now() - inicio.current) / 1000);
      setSegundos(s);
      // CU-43 2b: a los 5 minutos se detiene solo.
      if (s >= MAX_SEGUNDOS) alLlegarAlMaximo();
    }, 250);
  };

  const pararReloj = () => {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
  };

  // ---------------------------------------------------------------- En vivo
  const detenerEnVivo = () => {
    pararReloj();
    escuchando.current = false;
    reconocedor.current?.stop();
  };

  const dictarEnVivo = (Clase: ClaseReconocedor) => {
    const r = new Clase();
    r.lang = "es-CO";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const resultado = e.results[i];
        const texto = resultado[0].transcript.trim();
        if (!texto) continue;
        if (resultado.isFinal) onTexto(texto);
        else parcial += (parcial ? " " : "") + texto;
      }
      onParcial?.(parcial);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      escuchando.current = false;
      pararReloj();
      onError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "No tenemos permiso para usar el micrófono. Actívalo en tu navegador o escribe la explicación."
          : "El dictado en vivo se interrumpió. Lo que alcanzaste a decir quedó en el cuadro; puedes seguir escribiendo o volver a dictar."
      );
    };
    // El navegador corta tras un silencio: si la persona no ha detenido, se reanuda.
    r.onend = () => {
      if (escuchando.current) {
        try {
          r.start();
          return;
        } catch {
          escuchando.current = false;
        }
      }
      pararReloj();
      onParcial?.("");
      setEstado("inactivo");
    };
    reconocedor.current = r;
    escuchando.current = true;
    try {
      r.start();
    } catch {
      escuchando.current = false;
      onError("No pudimos iniciar el dictado. Intenta de nuevo o escribe la explicación.");
      return;
    }
    setModo("vivo");
    setEstado("grabando");
    arrancarReloj(detenerEnVivo);
  };

  // -------------------------------------------------------------- Grabación
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

  const detenerGrabacion = () => {
    pararReloj();
    grabador.current?.stop();
  };

  const grabar = async () => {
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
    g.start(1000);
    setModo("grabacion");
    setEstado("grabando");
    arrancarReloj(detenerGrabacion);
  };

  // ------------------------------------------------------------------ Vista
  const empezar = () => {
    onError(null);
    const Clase = onParcial ? claseReconocedor() : null;
    if (Clase) dictarEnVivo(Clase);
    else void grabar();
  };

  const detener = () => (modo === "vivo" ? detenerEnVivo() : detenerGrabacion());

  if (estado === "transcribiendo") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-violet/10 px-3 py-1.5 text-xs font-semibold text-violet-ink" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribiendo…
      </span>
    );
  }

  if (estado === "grabando") {
    const enVivo = modo === "vivo";
    return (
      <button
        type="button"
        onClick={detener}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-rose/10 px-3 text-xs font-semibold text-rose-ink ring-1 ring-inset ring-rose/30 hover:bg-rose/15"
        aria-label={enVivo ? "Detener el dictado" : "Detener la grabación y transcribir"}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose" />
        </span>
        {enVivo ? "Escuchando" : "Grabando"} · {formatoTiempo(segundos)}
        <Square className="h-3 w-3 fill-current" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={empezar}
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
