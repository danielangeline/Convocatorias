"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";
import type { CategoriaAdmin, ConvocatoriaAdmin, FuenteAdmin, RequisitoAdmin, TipoCategoria, TipoRequisito } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { DocumentosConvocatoria } from "./DocumentosConvocatoria";
import { cn, formatCOP, ESTADO_CONVOCATORIA_LABEL, ESTADO_CONVOCATORIA_ESTILO, TIPO_CATEGORIA_LABEL } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/identidad/Campo";

const claseCampo =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500";
const tiposCategoria: TipoCategoria[] = ["tipo_proyecto", "sector", "tipo_entidad"];

// Clave local para la lista: los requisitos nuevos aún no tienen id.
type RequisitoEditable = RequisitoAdmin & { clave: string };

let contador = 0;
const nuevaClave = () => `nuevo-${++contador}`;

/**
 * CU-02 2a, CU-04 · Editor de una convocatoria del panel. Guarda datos,
 * categorías y requisitos juntos en el servidor, que valida todo (RF-05,
 * RF-06, RF-08, RNF-29) y devuelve la ficha guardada. No publica: RF-09.
 */
export function EditorConvocatoria({
  convocatoria,
  categorias,
  fuentes,
}: {
  convocatoria: ConvocatoriaAdmin;
  categorias: CategoriaAdmin[];
  fuentes: FuenteAdmin[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    fuenteId: convocatoria.fuenteId ?? "",
    nombre: convocatoria.nombre,
    entidadConvocante: convocatoria.entidadConvocante,
    descripcion: convocatoria.descripcion,
    ubicacion: convocatoria.ubicacion,
    urlPostulacion: convocatoria.urlPostulacion,
    montoMin: convocatoria.montoMin === null ? "" : String(convocatoria.montoMin),
    montoMax: convocatoria.montoMax === null ? "" : String(convocatoria.montoMax),
    fechaApertura: convocatoria.fechaApertura ?? "",
    fechaCierre: convocatoria.fechaCierre,
  });
  const [categoriasSel, setCategoriasSel] = useState<string[]>(convocatoria.categorias);
  const [requisitos, setRequisitos] = useState<RequisitoEditable[]>(() =>
    convocatoria.requisitos.map((r) => ({ ...r, clave: r.id ?? nuevaClave() }))
  );
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const campo = (nombre: keyof typeof form) => ({
    value: form[nombre],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [nombre]: e.target.value })),
  });

  // Se ofrecen las activas y las que ya tenía asignadas aunque se hayan desactivado.
  const fuentesOfrecidas = fuentes.filter((f) => f.activa || f.id === convocatoria.fuenteId);
  const categoriasOfrecidas = categorias.filter((c) => c.activa || convocatoria.categorias.includes(c.id));

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    const r = await peticionAdmin<ConvocatoriaAdmin>(`/api/admin/convocatorias/${convocatoria.id}`, "PATCH", {
      ...form,
      categorias: categoriasSel,
      requisitos: requisitos.map(({ id, descripcion, tipo, obligatorio }) => ({ id, descripcion, tipo, obligatorio })),
    });
    setGuardando(false);
    if (!r.ok) {
      setMensaje({ tipo: "error", texto: r.error });
      return;
    }
    // Los requisitos nuevos reciben su id del servidor.
    setRequisitos(r.datos.requisitos.map((req) => ({ ...req, clave: req.id ?? nuevaClave() })));
    setMensaje({ tipo: "exito", texto: "Cambios guardados." });
    router.refresh();
  };

  const alternarCategoria = (id: string) =>
    setCategoriasSel((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const actualizarRequisito = (clave: string, cambios: Partial<RequisitoAdmin>) =>
    setRequisitos((prev) => prev.map((r) => (r.clave === clave ? { ...r, ...cambios } : r)));

  const moverRequisito = (indice: number, direccion: -1 | 1) =>
    setRequisitos((prev) => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });

  const montoMin = Number(form.montoMin);
  const montoMax = Number(form.montoMax);

  return (
    <div>
      <Link
        href="/admin/convocatorias"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al listado
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge className={ESTADO_CONVOCATORIA_ESTILO[convocatoria.estado]}>
            {ESTADO_CONVOCATORIA_LABEL[convocatoria.estado]}
          </Badge>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">{form.nombre || "Convocatoria sin nombre"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled
            title="La publicación con validación en el servidor (RF-09) aún no está disponible"
          >
            Publicar (próximamente)
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {mensaje && (
        <div className="mb-6">
          {mensaje.tipo === "exito" ? (
            <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" /> {mensaje.texto}
            </p>
          ) : (
            <Aviso tipo="error">{mensaje.texto}</Aviso>
          )}
        </div>
      )}

      <div className="space-y-6">
        <Seccion titulo="Datos generales">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre de la convocatoria" span2>
              <input {...campo("nombre")} className={claseCampo} required maxLength={300} />
            </Campo>
            <Campo etiqueta="Fuente">
              <select {...campo("fuenteId")} className={claseCampo}>
                <option value="">Sin fuente</option>
                {fuentesOfrecidas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                    {f.activa ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Entidad convocante">
              <input {...campo("entidadConvocante")} className={claseCampo} required maxLength={200} />
            </Campo>
            <Campo etiqueta="Ubicación o cobertura" span2>
              <input {...campo("ubicacion")} className={claseCampo} maxLength={300} />
            </Campo>
            <Campo etiqueta="Enlace oficial de postulación (URL del portal de la entidad)" span2>
              <input
                type="url"
                {...campo("urlPostulacion")}
                placeholder="https://entidad.gov.co/convocatoria"
                className={claseCampo}
              />
              <p className="mt-1 text-xs text-ink-faint">
                Obligatorio para publicar: es donde la empresa radica su postulación, no en esta plataforma.
              </p>
            </Campo>
            <Campo etiqueta="Descripción u objeto" span2>
              <textarea {...campo("descripcion")} rows={4} className={`${claseCampo} resize-y`} maxLength={10000} />
            </Campo>
            <Campo etiqueta="Monto mínimo (COP)">
              <input type="number" min={0} {...campo("montoMin")} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Monto máximo (COP)">
              <input type="number" min={0} {...campo("montoMax")} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Fecha de apertura">
              <input type="date" {...campo("fechaApertura")} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Fecha de cierre">
              <input type="date" {...campo("fechaCierre")} className={claseCampo} required />
            </Campo>
          </div>
          {montoMin > 0 && montoMax > 0 && (
            <p className="mt-2 font-tabular text-xs text-ink-faint">
              Rango: {formatCOP(montoMin)} – {formatCOP(montoMax)}
            </p>
          )}
        </Seccion>

        <Seccion titulo="Categorías">
          {categoriasOfrecidas.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No hay categorías activas.{" "}
              <Link href="/admin/categorias" className="font-semibold text-primary-700 hover:underline">
                Crear categorías
              </Link>
            </p>
          ) : (
            <div className="space-y-4">
              {tiposCategoria.map((tipo) => {
                const deTipo = categoriasOfrecidas.filter((c) => c.tipo === tipo);
                return (
                  <div key={tipo}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      {TIPO_CATEGORIA_LABEL[tipo]}
                    </p>
                    {deTipo.length === 0 ? (
                      <p className="text-xs text-ink-faint">Sin categorías de este tipo.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {deTipo.map((c) => {
                          const activo = categoriasSel.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => alternarCategoria(c.id)}
                              aria-pressed={activo}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                                activo
                                  ? "bg-primary-800 text-white ring-primary-800"
                                  : "bg-white text-ink-soft ring-line hover:bg-slate-50"
                              )}
                            >
                              {c.nombre}
                              {c.activa ? "" : " (inactiva)"}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Documentos">
          <DocumentosConvocatoria convocatoriaId={convocatoria.id} documentos={convocatoria.documentos} />
        </Seccion>

        <Seccion
          titulo="Requisitos"
          accion={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setRequisitos((prev) => [
                  ...prev,
                  { clave: nuevaClave(), descripcion: "", tipo: "documento", obligatorio: true },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Agregar requisito
            </Button>
          }
        >
          {requisitos.length === 0 ? (
            <p className="text-sm text-ink-faint">Aún no hay requisitos definidos.</p>
          ) : (
            <ol className="space-y-2">
              {requisitos.map((req, indice) => (
                <li key={req.clave} className="flex flex-wrap items-center gap-2 rounded-lg border border-line-soft px-3 py-2.5">
                  <span className="w-5 text-right font-tabular text-xs text-ink-faint">{indice + 1}.</span>
                  <input
                    value={req.descripcion}
                    onChange={(e) => actualizarRequisito(req.clave, { descripcion: e.target.value })}
                    placeholder="Ej. Certificado de existencia y representación legal"
                    aria-label={`Descripción del requisito ${indice + 1}`}
                    maxLength={1000}
                    className="min-w-48 flex-1 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                  />
                  <select
                    value={req.tipo}
                    onChange={(e) => actualizarRequisito(req.clave, { tipo: e.target.value as TipoRequisito })}
                    aria-label={`Tipo del requisito ${indice + 1}`}
                    className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                  >
                    <option value="documento">Documento</option>
                    <option value="condicion">Condición</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      checked={req.obligatorio}
                      onChange={(e) => actualizarRequisito(req.clave, { obligatorio: e.target.checked })}
                      className="h-4 w-4 rounded border-line text-primary-700 focus:ring-primary-500"
                    />
                    Obligatorio
                  </label>
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moverRequisito(indice, -1)}
                      disabled={indice === 0}
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moverRequisito(indice, 1)}
                      disabled={indice === requisitos.length - 1}
                      aria-label="Bajar"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRequisitos((prev) => prev.filter((r) => r.clave !== req.clave))}
                      className="text-danger hover:bg-danger-bg"
                      aria-label={`Quitar el requisito ${indice + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            Quitar un requisito no cambia el checklist de las postulaciones ya iniciadas.
          </p>
        </Seccion>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">{titulo}</h2>
        {accion}
      </div>
      {children}
    </div>
  );
}

function Campo({ etiqueta, children, span2 }: { etiqueta: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <label className={cn("block", span2 && "sm:col-span-2")}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">{etiqueta}</span>
      {children}
    </label>
  );
}
