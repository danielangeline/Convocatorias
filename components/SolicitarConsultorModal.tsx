"use client";

import { useMemo, useState } from "react";
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
export function SolicitarConsultorModal(props: SolicitarConsultorModalProps) {
  // Se monta de nuevo cada vez que se abre: el estado arranca limpio sin
  // reiniciarlo desde un efecto.
  if (!props.open) return null;
  return <ContenidoSolicitud {...props} />;
}

function ContenidoSolicitud({ proyecto, onClose, convocatoriaFijaId }: SolicitarConsultorModalProps) {
  const router = useRouter();
  const todasLasConvocatorias = useAppStore((s) => s.convocatorias);
  const iniciarSolicitudConsultor = useAppStore((s) => s.iniciarSolicitudConsultor);

  const [paso, setPaso] = useState<1 | 2 | 3>(convocatoriaFijaId ? 2 : 1);
  const [tipoAyuda, setTipoAyuda] = useState<TipoAyudaEncargo>("convocatoria_especifica");
  const [convocatoriaIdSel, setConvocatoriaIdSel] = useState(convocatoriaFijaId ?? "");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [confirmacion, setConfirmacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const convocatoriasVigentes = useMemo(
    () => todasLasConvocatorias.filter((c) => c.estado === "publicada" && diasRestantes(c.fechaCierre) >= 0),
    [todasLasConvocatorias]
  );

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-solicitud" className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="titulo-solicitud" className="font-display text-lg font-semibold text-ink">
            {confirmacion ? "Solicitud enviada" : `Solicitar consultor · Paso ${paso} de 3`}
          </h3>
          <button onClick={onClose} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmacion ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-pri-text" />
            <p className="mt-3 text-sm text-ink-2">
              Nuestro equipo revisará tu solicitud para <strong>{titulo}</strong> y te escribirá por correo. Puedes verla en{" "}
              <Link href="/encargos" className="font-semibold text-pri-text hover:underline">
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
            <p className="text-sm text-ink-2">¿Qué tipo de ayuda necesitas para este proyecto?</p>
            <div className="space-y-2">
              <button
                onClick={() => setTipoAyuda("convocatoria_especifica")}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                  tipoAyuda === "convocatoria_especifica"
                    ? "border-violet bg-violet/10"
                    : "border-line hover:border-violet/30"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet/10 text-violet-ink">
                  <Target className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Ayuda con una convocatoria específica</span>
                  <span className="block text-xs text-ink-3">
                    Ya sabes a cuál quieres aplicar. El consultor verá su información completa.
                  </span>
                </span>
              </button>
              <button
                onClick={() => setTipoAyuda("buscar_convocatoria")}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                  tipoAyuda === "buscar_convocatoria"
                    ? "border-sky bg-sky/10"
                    : "border-line hover:border-sky/30"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky/10 text-sky-ink">
                  <Compass className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Ayuda para encontrar una convocatoria</span>
                  <span className="block text-xs text-ink-3">
                    Aún no sabes a cuál aplicar. El consultor verá el perfil de tu proyecto para orientar la búsqueda.
                  </span>
                </span>
              </button>
            </div>

            {tipoAyuda === "convocatoria_especifica" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
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
              <label htmlFor="campo-solicitud-1" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
                Título de la tarea
              </label>
              <input id="campo-solicitud-1"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Estructuración financiera de la postulación"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pri bg-surface text-ink"
              />
            </div>
            <div>
              <label htmlFor="campo-solicitud-2" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
                Descripción de la tarea
              </label>
              <textarea id="campo-solicitud-2"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                placeholder="Cuéntanos qué necesitas resolver para este proyecto"
                className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-pri bg-surface text-ink"
              />
            </div>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-3">
              {tipoAyuda === "convocatoria_especifica"
                ? "El contenido completo del proyecto y los datos de la convocatoria elegida se adjuntan automáticamente — no necesitas repetirlos aquí."
                : "El contenido completo del proyecto se adjunta automáticamente — no necesitas repetirlo aquí."}
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
            <p className="text-sm text-ink-2">Elige cómo quieres encontrar un consultor para esta tarea.</p>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose-ink">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}
            <button
                onClick={buscarEnDirectorio}
                className="flex w-full items-center gap-4 rounded-xl border border-line p-4 text-left transition-colors hover:border-sky hover:bg-sky/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky/10 text-sky-ink">
                  <Search className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Buscar en el directorio</span>
                  <span className="block text-xs text-ink-3">
                    Elige tú mismo un consultor aprobado por su experiencia y calificación.
                  </span>
                </span>
              </button>
            <button
              onClick={pedirAyudaAlEquipo}
              disabled={enviando}
              className="flex w-full items-center gap-4 rounded-xl border border-line p-4 text-left transition-colors hover:border-pri hover:bg-pri-soft/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pri-soft text-pri-text">
                <Users className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">Pedir ayuda a nuestro equipo</span>
                <span className="block text-xs text-ink-3">
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
