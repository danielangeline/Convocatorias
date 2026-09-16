"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Upload,
  FileText,
  Plus,
  Trash2,
  Briefcase,
  Image as ImageIcon,
  Users,
  Link2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { categorias as catalogoCategorias } from "@/lib/mock-data";
import { useConsultorActual } from "@/lib/hooks";
import type { ItemPortafolio, RedSocialTipo } from "@/lib/types";
import { cn, ESTADO_PERFIL_LABEL, ESTADO_PERFIL_ESTILO } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const iconosRed: Record<RedSocialTipo, React.ElementType> = {
  linkedin: Briefcase,
  instagram: ImageIcon,
  facebook: Users,
  otra: Link2,
};

const portafolioVacio: Omit<ItemPortafolio, "id"> = {
  nombreProyecto: "",
  entidad: "",
  anio: new Date().getFullYear(),
  descripcion: "",
  resultado: "",
};

export default function PerfilConsultorEditorPage() {
  const { consultorId, consultor } = useConsultorActual();

  const actualizarPerfilConsultor = useAppStore((s) => s.actualizarPerfilConsultor);
  const enviarPerfilARevision = useAppStore((s) => s.enviarPerfilARevision);
  const agregarRed = useAppStore((s) => s.agregarRed);
  const actualizarRed = useAppStore((s) => s.actualizarRed);
  const eliminarRed = useAppStore((s) => s.eliminarRed);
  const agregarPortafolioItem = useAppStore((s) => s.agregarPortafolioItem);
  const actualizarPortafolioItem = useAppStore((s) => s.actualizarPortafolioItem);
  const eliminarPortafolioItem = useAppStore((s) => s.eliminarPortafolioItem);

  const fileFotoRef = useRef<HTMLInputElement>(null);
  const fileCvRef = useRef<HTMLInputElement>(null);
  const [nuevoItem, setNuevoItem] = useState(portafolioVacio);

  if (!consultorId || !consultor) {
    return (
      <EmptyState
        icon={AlertCircle}
        titulo="Esta sección es para consultores"
        descripcion="Tu cuenta no tiene un perfil de consultor. Si te registraste como empresa, usa el portal de empresa."
      />
    );
  }

  const toggleEspecialidad = (id: string) => {
    const nuevas = consultor.especialidades.includes(id)
      ? consultor.especialidades.filter((e) => e !== id)
      : [...consultor.especialidades, id];
    actualizarPerfilConsultor(consultorId, { especialidades: nuevas });
  };

  const subirFoto = (archivo: File) => {
    const url = URL.createObjectURL(archivo);
    actualizarPerfilConsultor(consultorId, { fotoUrl: url });
  };

  const subirCv = (archivo: File) => {
    actualizarPerfilConsultor(consultorId, { cvNombre: archivo.name });
  };

  const minimosCompletos =
    !!consultor.fotoUrl && !!consultor.descripcion.trim() && consultor.especialidades.length > 0 && !!consultor.cvNombre.trim();

  const agregarItemPortafolio = () => {
    if (!nuevoItem.nombreProyecto.trim()) return;
    agregarPortafolioItem(consultorId, nuevoItem);
    setNuevoItem(portafolioVacio);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Mi perfil de consultor</h1>
        <p className="text-sm text-ink-soft">
          Completa tu perfil para que las empresas puedan encontrarte en el directorio.
        </p>
      </div>

      <BannerEstado
        estado={consultor.estadoPerfil}
        motivoRechazo={consultor.motivoRechazo}
        minimosCompletos={minimosCompletos}
        onEnviar={() => enviarPerfilARevision(consultorId)}
      />

      <div className="mt-6 space-y-6">
        <Seccion titulo="Foto y datos principales">
          <div className="flex items-center gap-5">
            <img src={consultor.fotoUrl} alt="" className="h-20 w-20 rounded-full ring-1 ring-line" />
            <div>
              <input
                ref={fileFotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])}
              />
              <Button variant="secondary" size="sm" onClick={() => fileFotoRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Subir foto
              </Button>
              <p className="mt-1.5 text-xs text-ink-faint">PNG o JPG, recomendado 400x400px.</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Nombre profesional
            </label>
            <input
              value={consultor.nombreProfesional}
              onChange={(e) => actualizarPerfilConsultor(consultorId, { nombreProfesional: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Descripción
            </label>
            <textarea
              value={consultor.descripcion}
              onChange={(e) => actualizarPerfilConsultor(consultorId, { descripcion: e.target.value })}
              rows={4}
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Sitio web
            </label>
            <input
              value={consultor.sitioWeb}
              onChange={(e) => actualizarPerfilConsultor(consultorId, { sitioWeb: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
        </Seccion>

        <Seccion titulo="Especialidades">
          <div className="space-y-4">
            {(["tipo_proyecto", "sector", "tipo_entidad"] as const).map((tipo) => (
              <div key={tipo}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {tipo === "tipo_proyecto" ? "Tipo de proyecto" : tipo === "sector" ? "Sector" : "Tipo de entidad"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {catalogoCategorias
                    .filter((c) => c.tipo === tipo)
                    .map((c) => {
                      const activo = consultor.especialidades.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleEspecialidad(c.id)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                            activo
                              ? "bg-brick-500 text-white ring-brick-500"
                              : "bg-white text-ink-soft ring-line hover:bg-slate-50"
                          )}
                        >
                          {c.nombre}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Redes sociales" accion={
          <Button variant="secondary" size="sm" onClick={() => agregarRed(consultorId, { tipo: "linkedin", url: "" })}>
            <Plus className="h-3.5 w-3.5" /> Agregar red
          </Button>
        }>
          {consultor.redes.length === 0 ? (
            <p className="text-sm text-ink-faint">Aún no agregas redes sociales.</p>
          ) : (
            <ul className="space-y-2">
              {consultor.redes.map((red) => {
                const Icon = iconosRed[red.tipo];
                return (
                  <li key={red.id} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-ink-faint" />
                    <select
                      value={red.tipo}
                      onChange={(e) => actualizarRed(consultorId, red.id, { tipo: e.target.value as RedSocialTipo })}
                      className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="otra">Otra</option>
                    </select>
                    <input
                      value={red.url}
                      onChange={(e) => actualizarRed(consultorId, red.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => eliminarRed(consultorId, red.id)}
                      className="text-danger hover:bg-danger-bg"
                      aria-label="Eliminar red"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Seccion>

        <Seccion titulo="Portafolio">
          <div className="space-y-3">
            {consultor.portafolio.map((item) => (
              <div key={item.id} className="rounded-lg border border-line-soft p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={item.nombreProyecto}
                    onChange={(e) => actualizarPortafolioItem(consultorId, item.id, { nombreProyecto: e.target.value })}
                    placeholder="Nombre del proyecto"
                    className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                  />
                  <input
                    value={item.entidad}
                    onChange={(e) => actualizarPortafolioItem(consultorId, item.id, { entidad: e.target.value })}
                    placeholder="Entidad"
                    className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[100px_1fr]">
                  <input
                    type="number"
                    value={item.anio}
                    onChange={(e) => actualizarPortafolioItem(consultorId, item.id, { anio: Number(e.target.value) })}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                  />
                  <input
                    value={item.resultado}
                    onChange={(e) => actualizarPortafolioItem(consultorId, item.id, { resultado: e.target.value })}
                    placeholder="Resultado obtenido"
                    className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <textarea
                  value={item.descripcion}
                  onChange={(e) => actualizarPortafolioItem(consultorId, item.id, { descripcion: e.target.value })}
                  rows={2}
                  placeholder="Descripción"
                  className="mt-2 w-full resize-none rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => eliminarPortafolioItem(consultorId, item.id)}
                    className="text-danger hover:bg-danger-bg"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-dashed border-line p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Agregar proyecto al portafolio
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={nuevoItem.nombreProyecto}
                  onChange={(e) => setNuevoItem((it) => ({ ...it, nombreProyecto: e.target.value }))}
                  placeholder="Nombre del proyecto"
                  className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                />
                <input
                  value={nuevoItem.entidad}
                  onChange={(e) => setNuevoItem((it) => ({ ...it, entidad: e.target.value }))}
                  placeholder="Entidad"
                  className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                />
              </div>
              <Button variant="secondary" size="sm" className="mt-2" onClick={agregarItemPortafolio}>
                <Plus className="h-3.5 w-3.5" /> Agregar
              </Button>
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Hoja de vida">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <FileText className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{consultor.cvNombre || "Sin hoja de vida cargada"}</p>
              <p className="text-xs text-ink-faint">Formato PDF</p>
            </div>
            <input
              ref={fileCvRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && subirCv(e.target.files[0])}
            />
            <Button variant="secondary" size="sm" onClick={() => fileCvRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Subir PDF
            </Button>
          </div>
        </Seccion>
      </div>
    </div>
  );
}

function BannerEstado({
  estado,
  motivoRechazo,
  minimosCompletos,
  onEnviar,
}: {
  estado: string;
  motivoRechazo?: string;
  minimosCompletos: boolean;
  onEnviar: () => void;
}) {
  if (estado === "aprobado") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-semibold text-success">Tu perfil está aprobado</p>
          <p className="text-xs text-success/80">Ya apareces en el directorio de consultores.</p>
        </div>
      </div>
    );
  }

  if (estado === "en_revision") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <Clock className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-700">Tu perfil está siendo revisado</p>
          <p className="text-xs text-amber-700/80">
            Nuestro equipo lo validará pronto. Puedes seguir editándolo mientras tanto.
          </p>
        </div>
      </div>
    );
  }

  if (estado === "rechazado") {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger-bg px-5 py-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">Tu perfil fue rechazado</p>
            {motivoRechazo && <p className="text-xs text-danger/90">{motivoRechazo}</p>}
          </div>
        </div>
        <Button variant="danger" size="sm" className="mt-3" onClick={onEnviar} disabled={!minimosCompletos}>
          Corregir y reenviar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-slate-50 px-5 py-4">
      <div className="flex items-center gap-3">
        <Badge className={ESTADO_PERFIL_ESTILO["incompleto"]}>{ESTADO_PERFIL_LABEL["incompleto"]}</Badge>
        <p className="text-sm text-ink-soft">
          {minimosCompletos
            ? "Ya tienes los mínimos completos. Envía tu perfil a revisión."
            : "Completa foto, descripción, al menos una especialidad y tu hoja de vida para poder enviarlo a revisión."}
        </p>
      </div>
      <Button variant="primary" size="sm" className="mt-3" onClick={onEnviar} disabled={!minimosCompletos}>
        Enviar a revisión
      </Button>
    </div>
  );
}

function Seccion({
  titulo,
  children,
  accion,
}: {
  titulo: string;
  children: React.ReactNode;
  accion?: React.ReactNode;
}) {
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
