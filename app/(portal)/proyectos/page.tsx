"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus, Pencil, Trash2, MapPin, Wallet, Sparkles, UserPlus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { categoriaPorId } from "@/lib/mock-data";
import type { Proyecto } from "@/lib/types";
import { formatCOP } from "@/lib/utils";
import { useAccesoSuscripcion, useProyectosPropios } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { CompletitudBadge } from "@/components/CompletitudProyecto";
import { SolicitarConsultorModal } from "@/components/SolicitarConsultorModal";
import { ProyectoFormModal } from "@/components/ProyectoFormModal";

export default function ProyectosPage() {
  const router = useRouter();
  const proyectos = useProyectosPropios();
  const eliminarProyecto = useAppStore((s) => s.eliminarProyecto);
  const { requerirAcceso } = useAccesoSuscripcion();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Proyecto | null>(null);
  const [proyectoConsultorId, setProyectoConsultorId] = useState<string | null>(null);
  const proyectoParaConsultor = proyectos.find((p) => p.id === proyectoConsultorId) ?? null;

  const verSugerencias = (proyectoId: string) => {
    if (!requerirAcceso("ver sugerencias de convocatorias")) return;
    router.push(`/proyectos/${proyectoId}/sugerencias`);
  };

  const solicitarConsultor = (proyectoId: string) => {
    if (!requerirAcceso("solicitar un consultor")) return;
    setProyectoConsultorId(proyectoId);
  };

  const abrirCrear = () => {
    setEditando(null);
    setModalAbierto(true);
  };

  const abrirEditar = (p: Proyecto) => {
    setEditando(p);
    setModalAbierto(true);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Mis proyectos</h1>
          <p className="text-sm text-ink-soft">
            Registra los proyectos de tu empresa para cruzarlos con convocatorias.
          </p>
        </div>
        <Button variant="primary" className="shrink-0" onClick={abrirCrear}>
          <Plus className="h-4 w-4" /> Nuevo proyecto
        </Button>
      </div>

      {proyectos.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          titulo="Aún no tienes proyectos"
          descripcion="Crea tu primer proyecto para empezar a recibir sugerencias de convocatorias que encajan con él."
          accion={
            <Button variant="primary" onClick={abrirCrear}>
              <Plus className="h-4 w-4" /> Crear proyecto
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {proyectos.map((p) => (
            <div key={p.id} className="flex flex-col rounded-2xl border border-line p-5">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/proyectos/${p.id}`} className="font-display text-base font-semibold text-ink hover:text-primary-800">
                  {p.nombre}
                </Link>
                <CompletitudBadge proyecto={p} className="shrink-0" />
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{p.descripcion}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.categorias.map((cid) => {
                  const cat = categoriaPorId(cid);
                  return cat ? (
                    <Chip key={cid} tono={cat.tipo}>
                      {cat.nombre}
                    </Chip>
                  ) : null;
                })}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-line-soft pt-4 text-sm">
                <p className="flex items-center gap-1.5 text-ink-soft">
                  <Wallet className="h-3.5 w-3.5" />
                  <span className="font-tabular font-medium text-ink">{formatCOP(p.montoBuscado)}</span>
                </p>
                <p className="flex items-center gap-1.5 text-ink-soft">
                  <MapPin className="h-3.5 w-3.5" /> {p.ubicacion || "Sin ubicación"}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => verSugerencias(p.id)}>
                  <Sparkles className="h-3.5 w-3.5" /> Ver sugerencias
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-brick-600 hover:bg-brick-50"
                  onClick={() => solicitarConsultor(p.id)}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Solicitar consultor
                </Button>
                <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)} aria-label="Editar proyecto">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => eliminarProyecto(p.id)}
                  aria-label="Eliminar proyecto"
                  className="text-danger hover:bg-danger-bg"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAbierto && (
        <ProyectoFormModal proyecto={editando} onClose={() => setModalAbierto(false)} />
      )}

      {proyectoParaConsultor && (
        <SolicitarConsultorModal
          proyecto={proyectoParaConsultor}
          open={!!proyectoConsultorId}
          onClose={() => setProyectoConsultorId(null)}
        />
      )}
    </div>
  );
}
