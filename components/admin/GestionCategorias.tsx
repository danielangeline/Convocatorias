"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Power, Tags } from "lucide-react";
import type { CategoriaAdmin, TipoCategoria } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { TIPO_CATEGORIA_LABEL, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Aviso } from "@/components/identidad/Campo";

const tipos: TipoCategoria[] = ["tipo_proyecto", "sector", "tipo_entidad"];

/**
 * RF-06 · Categorías para clasificar convocatorias. Una categoría no se borra
 * (puede estar asignada): se desactiva y deja de ofrecerse al clasificar.
 */
export function GestionCategorias({ categorias }: { categorias: CategoriaAdmin[] }) {
  const router = useRouter();
  const [nuevoNombre, setNuevoNombre] = useState<Record<TipoCategoria, string>>({
    tipo_proyecto: "",
    sector: "",
    tipo_entidad: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const agregar = async (tipo: TipoCategoria) => {
    const nombre = nuevoNombre[tipo].trim();
    if (!nombre) return;
    setOcupado(tipo);
    setError(null);
    const r = await peticionAdmin("/api/admin/categorias", "POST", { tipo, nombre });
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setNuevoNombre((prev) => ({ ...prev, [tipo]: "" }));
    router.refresh();
  };

  const alternarActiva = async (c: CategoriaAdmin) => {
    setOcupado(c.id);
    setError(null);
    const r = await peticionAdmin(`/api/admin/categorias/${c.id}`, "PATCH", { activa: !c.activa });
    setOcupado(null);
    if (!r.ok) setError(r.error);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Tags className="h-5 w-5 text-primary-700" />
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Categorías</h1>
          <p className="text-sm text-ink-soft">
            Catálogo usado para clasificar convocatorias y proyectos, agrupado por tipo.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {tipos.map((tipo) => {
          const items = categorias.filter((c) => c.tipo === tipo);
          const activas = items.filter((c) => c.activa).length;
          return (
            <div key={tipo} className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-display text-sm font-semibold text-ink">{TIPO_CATEGORIA_LABEL[tipo]}</h2>
              <p className="mb-4 text-xs text-ink-faint">
                {activas} activas{items.length > activas ? ` · ${items.length - activas} inactivas` : ""}
              </p>

              <ul className="space-y-1.5">
                {items.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border border-line-soft px-3 py-2",
                      !c.activa && "bg-slate-50 opacity-70"
                    )}
                  >
                    {c.activa ? (
                      <Chip tono={c.tipo}>{c.nombre}</Chip>
                    ) : (
                      <span className="text-xs text-ink-faint line-through">{c.nombre}</span>
                    )}
                    <button
                      onClick={() => alternarActiva(c)}
                      disabled={ocupado === c.id}
                      className="text-ink-faint hover:text-primary-800 disabled:opacity-50"
                      aria-label={c.activa ? `Desactivar ${c.nombre}` : `Activar ${c.nombre}`}
                      title={c.activa ? "Desactivar" : "Activar"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  agregar(tipo);
                }}
                className="mt-4 flex gap-2 border-t border-line-soft pt-4"
              >
                <input
                  value={nuevoNombre[tipo]}
                  onChange={(e) => setNuevoNombre((prev) => ({ ...prev, [tipo]: e.target.value }))}
                  placeholder="Nueva categoría..."
                  aria-label={`Nueva categoría de ${TIPO_CATEGORIA_LABEL[tipo]}`}
                  maxLength={100}
                  className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                />
                <Button type="submit" variant="secondary" size="sm" disabled={ocupado === tipo} aria-label="Agregar">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
