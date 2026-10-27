"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Rss, X, ExternalLink, Power } from "lucide-react";
import type { FuenteAdmin } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Aviso } from "@/components/identidad/Campo";

type Formulario = Omit<FuenteAdmin, "id">;

const vacio: Formulario = { nombre: "", tipoEntidad: "", url: "", notas: "", activa: true };

const claseCampo =
  "w-full rounded-lg border border-line bg-surface text-ink px-3 py-2 text-sm outline-none focus:border-pri";
const claseEtiqueta = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3";

/**
 * CU-01 · Fuentes de convocatorias (RF-04). Cada cambio lo valida el servidor;
 * la pantalla vuelve a leer la lista después. Una fuente no se elimina: se
 * desactiva y conserva sus convocatorias (RN-07).
 */
export function GestionFuentes({ fuentes }: { fuentes: FuenteAdmin[] }) {
  const router = useRouter();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario>(vacio);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const abrirCrear = () => {
    setEditandoId(null);
    setForm(vacio);
    setErrorModal(null);
    setModalAbierto(true);
  };

  const abrirEditar = (f: FuenteAdmin) => {
    setEditandoId(f.id);
    setForm({ nombre: f.nombre, tipoEntidad: f.tipoEntidad, url: f.url, notas: f.notas, activa: f.activa });
    setErrorModal(null);
    setModalAbierto(true);
  };

  const guardar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setOcupado("modal");
    const r = editandoId
      ? await peticionAdmin(`/api/admin/fuentes/${editandoId}`, "PATCH", form)
      : await peticionAdmin("/api/admin/fuentes", "POST", form);
    setOcupado(null);
    if (!r.ok) {
      setErrorModal(r.error);
      return;
    }
    setModalAbierto(false);
    router.refresh();
  };

  const alternarActiva = async (f: FuenteAdmin) => {
    setOcupado(f.id);
    setErrorLista(null);
    const r = await peticionAdmin(`/api/admin/fuentes/${f.id}`, "PATCH", { ...f, activa: !f.activa });
    setOcupado(null);
    if (!r.ok) setErrorLista(r.error);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">Fuentes</h1>
          <p className="text-sm text-ink-2">
            Entidades desde donde el equipo administrador carga convocatorias manualmente.
          </p>
        </div>
        <Button variant="primary" onClick={abrirCrear}>
          <Plus className="h-4 w-4" /> Nueva fuente
        </Button>
      </div>

      {errorLista && (
        <div className="mb-4">
          <Aviso tipo="error">{errorLista}</Aviso>
        </div>
      )}

      {fuentes.length === 0 ? (
        <EmptyState
          icon={Rss}
          titulo="No hay fuentes registradas"
          descripcion="Registra las entidades de donde se cargarán convocatorias periódicamente."
          accion={
            <Button variant="primary" onClick={abrirCrear}>
              <Plus className="h-4 w-4" /> Registrar fuente
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Tipo de entidad</th>
                <th className="px-5 py-3">URL</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {fuentes.map((f) => (
                <tr key={f.id} className={f.activa ? undefined : "bg-surface-2/60"}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{f.nombre}</p>
                    {f.notas && <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{f.notas}</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-2">{f.tipoEntidad || "—"}</td>
                  <td className="px-5 py-3">
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-pri-text hover:underline"
                      >
                        {f.url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      className={
                        f.activa
                          ? "bg-pri-soft text-pri-text ring-pri/30"
                          : "bg-surface-2 text-ink-3 ring-line"
                      }
                    >
                      {f.activa ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(f)} aria-label={`Editar ${f.nombre}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => alternarActiva(f)}
                        disabled={ocupado === f.id}
                        aria-label={f.activa ? `Desactivar ${f.nombre}` : `Activar ${f.nombre}`}
                        title={f.activa ? "Desactivar" : "Activar"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={guardar}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-fuente"
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-fuente" className="font-display text-lg font-semibold text-ink">
                {editandoId ? "Editar fuente" : "Nueva fuente"}
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-ink-3 hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className={claseEtiqueta}>Nombre</span>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className={claseCampo}
                  placeholder="Ej. Cámara de Comercio de Barranquilla"
                  required
                  maxLength={200}
                />
              </label>
              <label className="block">
                <span className={claseEtiqueta}>Tipo de entidad</span>
                <input
                  value={form.tipoEntidad}
                  onChange={(e) => setForm({ ...form, tipoEntidad: e.target.value })}
                  className={claseCampo}
                  placeholder="Pública, cámara, cooperante o fondo"
                  maxLength={100}
                />
              </label>
              <label className="block">
                <span className={claseEtiqueta}>URL</span>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className={claseCampo}
                  placeholder="https://..."
                />
              </label>
              <label className="block">
                <span className={claseEtiqueta}>Notas de parametrización</span>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={3}
                  className={`${claseCampo} resize-none`}
                  placeholder="Dónde publica, cada cuánto revisarla, contacto…"
                  maxLength={4000}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  checked={form.activa}
                  onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                  className="h-4 w-4 rounded border-line text-pri-text focus:ring-pri bg-surface text-ink"
                />
                Fuente activa
              </label>
              {errorModal && <Aviso tipo="error">{errorModal}</Aviso>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={ocupado === "modal"}>
                {ocupado === "modal" ? "Guardando…" : editandoId ? "Guardar cambios" : "Crear fuente"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
