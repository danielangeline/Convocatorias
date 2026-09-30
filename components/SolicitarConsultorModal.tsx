"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Compass, Search, Target, Users, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Proyecto, TipoAyudaEncargo } from "@/lib/types";
import { diasRestantes, cn } from "@/lib/utils";
import { pedir } from "@/lib/pedir";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface SolicitarConsultorModalProps {
  proyecto: Proyecto;
  open: boolean;
  onClose: () => void;
  /**
   * Cuando se inicia desde el detalle de una postulación (CU-13, RF-28), la
   * convocatoria ya está resuelta: se salta el paso de elegir tipo de ayuda y
   * queda fija en "convocatoria específica".
   */
  convocatoriaFijaId?: string;
}

/**
 * Flujo "Solicitar consultor" (CU-19, RF-28). Compartido por la ficha del
 * proyecto, la tarjeta del proyecto en el listado y el detalle de una
 * postulación — mismo modal, mismo resultado, distinto punto de entrada.
 * Pedir ayuda al equipo (CU-23) crea la solicitud en el servidor; buscar en el
 * directorio guarda la tarea en el store hasta elegir consultor (CU-21 3a).
 */
export function SolicitarConsultorModal({
  proyecto,
  open,
  onClose,
  convocatoriaFijaId,
}: SolicitarConsultorModalProps) {
  const router = useRouter();
  const todasLasConvocatorias = useAppStore((s) => s.convocatorias);
  const iniciarSolicitudConsultor = useAppStore((s) => s.iniciarSolicitudConsultor);

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipoAyuda, setTipoAyuda] = useState<TipoAyudaEncargo>("convocatoria_especifica");
  const [convocatoriaIdSel, setConvocatoriaIdSel] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [confirmacion, setConfirmacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const convocatoriasVigentes = useMemo(
    () => todasLasConvocatorias.filter((c) => c.estado === "publicada" && diasRestantes(c.fechaCierre) >= 0),
    [todasLasConvocatorias]
  );

  useEffect(() => {
    if (!open) return;
    setTipoAyuda("convocatoria_especifica");
    setConvocatoriaIdSel(convocatoriaFijaId ?? "");
    setTitulo("");
    setDescripcion("");
    setConfirmacion(false);
    setError(null);
    setPaso(convocatoriaFijaId ? 2 : 1);
  }, [open, convocatoriaFijaId]);

  if (!open) return null;

  const irAlPaso2 = () => {
    if (tipoAyuda === "convocatoria_especifica" && !convocatoriaIdSel) return;
    setPaso(2);
  };

  const irAlPaso3 = () => {
    if (!titulo.trim() || !descripcion.trim()) return;
    setPaso(3);
  };

  const datosSolicitud = () => ({
    proyectoId: proyecto.id,
    tituloTarea: titulo.trim(),
    descripcionTarea: descripcion.trim(),
    tipoAyuda,
    convocatoriaId: tipoAyuda === "convocatoria_especifica" ? convocatoriaIdSel : null,
  });

  const buscarEnDirectorio = () => {
    iniciarSolicitudConsultor(datosSolicitud());
    onClose();
    router.push("/consultores");
  };

  // CU-23 · La solicitud al equipo nace `esperando_asignacion` en el servidor.
  const pedirAyudaAlEquipo = async () => {
    const d = datosSolicitud();
    setError(null);
    setEnviando(true);
    const r = await pedir("/api/encargos", {
      proyectoId: d.proyectoId,
      tipoAyuda: d.tipoAyuda,
      convocatoriaId: d.convocatoriaId,
      titulo: d.tituloTarea,
      descripcion: d.descripcionTarea,
    });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setConfirmacion(true);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            {confirmacion ? "Solicitud enviada" : `Solicitar consultor · Paso ${paso} de 3`}
          </h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmacion ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 text-sm text-ink-soft">
              Nuestro equipo revisará tu solicitud para <strong>{titulo}</strong> y te escribirá por correo. Puedes verla en{" "}
              <Link href="/encargos" className="font-semibold text-primary-700 hover:underline">
                Encargos
              </Link>
              .
            </p>
            <Button variant="primary" className="mt-5" onClick={onClose}>
              Entendido
            </Button>
          </div>
        ) : paso === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">¿Qué tipo de ayuda necesitas para este proyecto?</p>
            <div className="space-y-2">
              <button
                onClick={() => setTipoAyuda("convocatoria_especifica")}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                  tipoAyuda === "convocatoria_especifica"
                    ? "border-teal-500 bg-teal-50/40"
                    : "border-line hover:border-teal-300"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Target className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Ayuda con una convocatoria específica</span>
                  <span className="block text-xs text-ink-faint">
                    Ya sabes a cuál quieres aplicar. El consultor verá su información completa.
                  </span>
                </span>
              </button>
              <button
                onClick={() => setTipoAyuda("buscar_convocatoria")}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                  tipoAyuda === "buscar_convocatoria"
                    ? "border-brick-500 bg-brick-50/40"
                    : "border-line hover:border-brick-300"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brick-50 text-brick-600">
                  <Compass className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Ayuda para encontrar una convocatoria</span>
                  <span className="block text-xs text-ink-faint">
                    Aún no sabes a cuál aplicar. El consultor verá el perfil de tu proyecto para orientar la búsqueda.
                  </span>
                </span>
              </button>
            </div>

            {tipoAyuda === "convocatoria_especifica" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Convocatoria
                </label>
                <SearchableSelect
                  value={convocatoriaIdSel}
                  onChange={setConvocatoriaIdSel}
                  placeholder="Busca por nombre..."
                  vacioLabel="Ninguna convocatoria vigente coincide"
                  opciones={convocatoriasVigentes.map((c) => ({
                    value: c.id,
                    label: c.nombre,
                    sublabel: c.entidadConvocante,
                  }))}
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={irAlPaso2}
                disabled={tipoAyuda === "convocatoria_especifica" && !convocatoriaIdSel}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : paso === 2 ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Título de la tarea
              </label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Estructuración financiera de la postulación"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Descripción de la tarea
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                placeholder="Cuéntanos qué necesitas resolver para este proyecto"
                className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint">
              El contenido completo del proyecto{tipoAyuda === "convocatoria_especifica" ? " y los datos de la convocatoria elegida" : ""} se
              adjuntan automáticamente — no necesitas repetirlos aquí.
            </p>
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={() => (convocatoriaFijaId ? onClose() : setPaso(1))}>
                <ArrowLeft className="h-3.5 w-3.5" /> {convocatoriaFijaId ? "Cancelar" : "Volver"}
              </Button>
              <Button variant="primary" onClick={irAlPaso3} disabled={!titulo.trim() || !descripcion.trim()}>
                Continuar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">Elige cómo quieres encontrar un consultor para esta tarea.</p>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}
            <button
                onClick={buscarEnDirectorio}
                className="flex w-full items-center gap-4 rounded-xl border border-line p-4 text-left transition-colors hover:border-brick-500 hover:bg-brick-50/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brick-50 text-brick-600">
                  <Search className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Buscar en el directorio</span>
                  <span className="block text-xs text-ink-faint">
                    Elige tú mismo un consultor aprobado por su experiencia y calificación.
                  </span>
                </span>
              </button>
            <button
              onClick={pedirAyudaAlEquipo}
              disabled={enviando}
              className="flex w-full items-center gap-4 rounded-xl border border-line p-4 text-left transition-colors hover:border-primary-500 hover:bg-primary-50/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <Users className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">Pedir ayuda a nuestro equipo</span>
                <span className="block text-xs text-ink-faint">
                  Revisamos tu solicitud y te escribimos por correo para ayudarte.
                </span>
              </span>
            </button>
            <div className="flex justify-start pt-1">
              <Button variant="ghost" size="sm" onClick={() => setPaso(2)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Volver
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
