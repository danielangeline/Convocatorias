"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  Link2,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Categoria, ItemPortafolioPropio, PerfilConsultorPropio, RedSocialTipo } from "@/lib/types";
import { cn, ESTADO_PERFIL_LABEL, ESTADO_PERFIL_ESTILO } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const iconosRed: Record<RedSocialTipo, React.ElementType> = {
  linkedin: Briefcase,
  instagram: ImageIcon,
  facebook: Users,
  otra: Link2,
};

const TIPOS_CATEGORIA = [
  ["tipo_proyecto", "Tipo de proyecto"],
  ["sector", "Sector"],
  ["tipo_entidad", "Tipo de entidad"],
] as const;

const itemVacio: ItemPortafolioPropio = { nombreProyecto: "", entidad: "", anio: null, descripcion: "", resultado: "" };

type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string };

async function llamar<T>(url: string, metodo: "POST" | "PATCH", cuerpo?: unknown): Promise<Respuesta<T>> {
  try {
    const r = await fetch(url, {
      method: metodo,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo ?? {}),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: json.error ?? "No pudimos completar la acción. Intenta de nuevo." };
    return { ok: true, datos: json.datos as T };
  } catch {
    return { ok: false, error: "No hay conexión con el servidor. Intenta de nuevo." };
  }
}

const BUCKETS = { foto: "fotos-consultores", cv: "hojas-de-vida" } as const;

/**
 * Editor del perfil del consultor (CU-16, CU-17 · RF-22..25, RF-88). La
 * pantalla no decide nada por su cuenta (RNF-20): guarda por la API, sube los
 * archivos con una URL firmada que emite el servidor y muestra lo que este
 * responde. Los mínimos para enviar los comprueba la base.
 */
export function EditorPerfil({
  perfilInicial,
  categorias,
}: {
  perfilInicial: PerfilConsultorPropio;
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [perfil, setPerfil] = useState(perfilInicial);
  const [form, setForm] = useState(() => formularioDe(perfilInicial));
  const [cambios, setCambios] = useState(false);
  const [ocupado, setOcupado] = useState<null | "guardar" | "enviar" | "foto" | "cv" | "consentimiento">(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);

  const editar = (parche: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...parche }));
    setCambios(true);
    setExito(null);
  };

  // Lo que responde el servidor manda: se refleja aquí y en el layout (estado del perfil).
  const aplicar = (nuevo: PerfilConsultorPropio, conFormulario: boolean) => {
    setPerfil(nuevo);
    if (conFormulario) {
      setForm(formularioDe(nuevo));
      setCambios(false);
    }
    router.refresh();
  };

  const guardar = async (): Promise<boolean> => {
    setOcupado("guardar");
    setError(null);
    setExito(null);
    const r = await llamar<PerfilConsultorPropio>("/api/consultor/perfil", "PATCH", form);
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    aplicar(r.datos, true);
    setExito("Cambios guardados.");
    return true;
  };

  // Enviar guarda primero lo que haya sin guardar, como Publicar en el panel.
  const enviar = async () => {
    if (cambios && !(await guardar())) return;
    setOcupado("enviar");
    setError(null);
    const r = await llamar<PerfilConsultorPropio>("/api/consultor/perfil/enviar-revision", "POST");
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    aplicar(r.datos, true);
    setExito("Tu perfil quedó en revisión. Te avisaremos cuando un administrador lo revise.");
  };

  const aceptarConsentimiento = async () => {
    setOcupado("consentimiento");
    setError(null);
    const r = await llamar<null>("/api/consultor/perfil/consentimiento", "POST");
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPerfil((p) => ({ ...p, consentimientoDatos: true }));
  };

  const subir = async (tipo: "foto" | "cv", archivo: File) => {
    setOcupado(tipo);
    setError(null);
    setExito(null);
    const firma = await llamar<{ ruta: string; token: string }>("/api/consultor/perfil/archivos/subida", "POST", {
      tipo,
      nombreArchivo: archivo.name,
      tamanoBytes: archivo.size,
    });
    if (!firma.ok) {
      setOcupado(null);
      setError(firma.error);
      return;
    }
    const { error: eSubida } = await crearClienteNavegador()
      .storage.from(BUCKETS[tipo])
      .uploadToSignedUrl(firma.datos.ruta, firma.datos.token, archivo, { contentType: archivo.type });
    if (eSubida) {
      setOcupado(null);
      setError("No pudimos subir el archivo. Revisa su tamaño y su formato e inténtalo otra vez.");
      return;
    }
    const r = await llamar<PerfilConsultorPropio>("/api/consultor/perfil/archivos", "POST", {
      tipo,
      ruta: firma.datos.ruta,
    });
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // El archivo no toca el formulario: lo que se esté escribiendo se conserva.
    aplicar(r.datos, false);
    setExito(tipo === "foto" ? "Foto actualizada." : "Hoja de vida actualizada.");
  };

  const verHojaDeVida = async () => {
    const r = await fetch("/api/consultor/perfil/archivos/cv").then((x) => x.json()).catch(() => null);
    if (r?.datos?.url) window.open(r.datos.url, "_blank", "noopener");
    else setError(r?.error ?? "No pudimos abrir la hoja de vida.");
  };

  const toggleEspecialidad = (id: string) =>
    editar({
      especialidades: form.especialidades.includes(id)
        ? form.especialidades.filter((e) => e !== id)
        : [...form.especialidades, id],
    });

  // Solo orienta: la base es la que decide si se puede enviar (CU-17).
  const faltan = [
    !perfil.fotoUrl && "foto",
    !form.descripcion.trim() && "descripción",
    form.especialidades.length === 0 && "al menos una especialidad",
    !perfil.tieneHojaDeVida && "hoja de vida en PDF",
  ].filter(Boolean) as string[];

  const bloqueado = !perfil.consentimientoDatos;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Mi perfil de consultor</h1>
        <p className="text-sm text-ink-soft">Completa tu perfil para que las empresas puedan encontrarte en el directorio.</p>
      </div>

      {bloqueado ? (
        <div className="rounded-xl border border-primary-200 bg-primary-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
            <div>
              <p className="text-sm font-semibold text-primary-800">Autoriza el tratamiento de tus datos</p>
              <p className="mt-0.5 text-sm text-primary-800/80">
                Tu cuenta se creó antes de que pidiéramos esta autorización. Para guardar tu perfil, autoriza el
                tratamiento de tus datos personales para crear y operar tu cuenta en la plataforma, conforme a la Ley
                1581 de 2012.
              </p>
              <Button size="sm" className="mt-3" onClick={aceptarConsentimiento} disabled={ocupado !== null}>
                {ocupado === "consentimiento" ? "Guardando…" : "Autorizo el tratamiento de mis datos"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <BannerEstado
          estado={perfil.estadoPerfil}
          motivoRechazo={perfil.motivoRechazo}
          motivoSuspension={perfil.motivoSuspension}
          faltan={faltan}
          enviando={ocupado === "enviar"}
          deshabilitado={ocupado !== null}
          onEnviar={enviar}
        />
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {exito && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-success">
          {exito}
        </p>
      )}

      <fieldset disabled={bloqueado} className={cn("mt-6 space-y-6", bloqueado && "opacity-60")}>
        <Seccion titulo="Foto y datos principales">
          <div className="flex items-center gap-5">
            {perfil.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, cambia cada 15 min
              <img src={perfil.fotoUrl} alt="Tu foto de perfil" className="h-20 w-20 rounded-full object-cover ring-1 ring-line" />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-ink-faint ring-1 ring-line">
                <UserRound className="h-8 w-8" />
              </span>
            )}
            <div>
              <input
                ref={fotoRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  e.target.value = "";
                  if (archivo) subir("foto", archivo);
                }}
              />
              <Button variant="secondary" size="sm" onClick={() => fotoRef.current?.click()} disabled={ocupado !== null}>
                <Upload className="h-3.5 w-3.5" /> {ocupado === "foto" ? "Subiendo…" : perfil.fotoUrl ? "Cambiar foto" : "Subir foto"}
              </Button>
              <p className="mt-1.5 text-xs text-ink-faint">JPG o PNG, hasta 5 MB. Recomendado 400 × 400 px.</p>
            </div>
          </div>

          <Campo etiqueta="Nombre profesional" id="nombre">
            <input
              id="nombre"
              value={form.nombreProfesional}
              onChange={(e) => editar({ nombreProfesional: e.target.value })}
              maxLength={120}
              className={claseEntrada}
            />
          </Campo>
          <Campo etiqueta="Descripción" id="descripcion" ayuda="Tu experiencia y en qué ayudas a las empresas.">
            <textarea
              id="descripcion"
              value={form.descripcion}
              onChange={(e) => editar({ descripcion: e.target.value })}
              rows={4}
              maxLength={2000}
              className={cn(claseEntrada, "resize-none")}
            />
          </Campo>
          <Campo
            etiqueta="Sitio web"
            id="sitio"
            ayuda="Solo lo verán los administradores y la empresa que te haya enviado una solicitud."
          >
            <input
              id="sitio"
              value={form.sitioWeb}
              onChange={(e) => editar({ sitioWeb: e.target.value })}
              placeholder="https://…"
              maxLength={300}
              className={claseEntrada}
            />
          </Campo>
        </Seccion>

        <Seccion titulo="Especialidades">
          {categorias.length === 0 ? (
            <p className="text-sm text-ink-faint">Todavía no hay categorías disponibles.</p>
          ) : (
            <div className="space-y-4">
              {TIPOS_CATEGORIA.map(([tipo, etiqueta]) => {
                const delTipo = categorias.filter((c) => c.tipo === tipo);
                if (delTipo.length === 0) return null;
                return (
                  <div key={tipo}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{etiqueta}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {delTipo.map((c) => {
                        const activo = form.especialidades.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => toggleEspecialidad(c.id)}
                            className={cn(
                              "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                              activo ? "bg-brick-500 text-white ring-brick-500" : "bg-white text-ink-soft ring-line hover:bg-slate-50"
                            )}
                          >
                            {c.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion
          titulo="Redes sociales"
          accion={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => editar({ redes: [...form.redes, { tipo: "linkedin", url: "" }] })}
              disabled={form.redes.length >= 10}
            >
              <Plus className="h-3.5 w-3.5" /> Agregar red
            </Button>
          }
        >
          <p className="-mt-2 mb-3 text-xs text-ink-faint">
            Solo las verán los administradores y la empresa que te haya enviado una solicitud.
          </p>
          {form.redes.length === 0 ? (
            <p className="text-sm text-ink-faint">Aún no agregas redes sociales.</p>
          ) : (
            <ul className="space-y-2">
              {form.redes.map((red, i) => {
                const Icon = iconosRed[red.tipo];
                const cambiar = (parche: Partial<typeof red>) =>
                  editar({ redes: form.redes.map((r, j) => (j === i ? { ...r, ...parche } : r)) });
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Icon className="h-4 w-4 shrink-0 text-ink-faint" />
                    <select
                      aria-label="Tipo de red"
                      value={red.tipo}
                      onChange={(e) => cambiar({ tipo: e.target.value as RedSocialTipo })}
                      className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="otra">Otra</option>
                    </select>
                    <input
                      aria-label="Enlace"
                      value={red.url}
                      onChange={(e) => cambiar({ url: e.target.value })}
                      placeholder="https://…"
                      maxLength={300}
                      className="min-w-0 flex-1 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editar({ redes: form.redes.filter((_, j) => j !== i) })}
                      className="text-danger hover:bg-danger-bg"
                      aria-label="Quitar red"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Seccion>

        <Seccion
          titulo="Portafolio"
          accion={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => editar({ portafolio: [...form.portafolio, { ...itemVacio }] })}
              disabled={form.portafolio.length >= 30}
            >
              <Plus className="h-3.5 w-3.5" /> Agregar proyecto
            </Button>
          }
        >
          {form.portafolio.length === 0 ? (
            <p className="text-sm text-ink-faint">Agrega proyectos en los que hayas trabajado: nombre, entidad, año y resultado.</p>
          ) : (
            <div className="space-y-3">
              {form.portafolio.map((item, i) => {
                const cambiar = (parche: Partial<ItemPortafolioPropio>) =>
                  editar({ portafolio: form.portafolio.map((p, j) => (j === i ? { ...p, ...parche } : p)) });
                return (
                  <div key={i} className="rounded-lg border border-line-soft p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        aria-label={`Nombre del proyecto ${i + 1}`}
                        value={item.nombreProyecto}
                        onChange={(e) => cambiar({ nombreProyecto: e.target.value })}
                        placeholder="Nombre del proyecto"
                        maxLength={200}
                        className={claseEntradaChica}
                      />
                      <input
                        aria-label={`Entidad del proyecto ${i + 1}`}
                        value={item.entidad}
                        onChange={(e) => cambiar({ entidad: e.target.value })}
                        placeholder="Entidad"
                        maxLength={200}
                        className={claseEntradaChica}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[110px_1fr]">
                      <input
                        aria-label={`Año del proyecto ${i + 1}`}
                        type="number"
                        inputMode="numeric"
                        value={item.anio ?? ""}
                        onChange={(e) => cambiar({ anio: e.target.value === "" ? null : Number(e.target.value) })}
                        placeholder="Año"
                        className={claseEntradaChica}
                      />
                      <input
                        aria-label={`Resultado del proyecto ${i + 1}`}
                        value={item.resultado}
                        onChange={(e) => cambiar({ resultado: e.target.value })}
                        placeholder="Resultado obtenido"
                        maxLength={500}
                        className={claseEntradaChica}
                      />
                    </div>
                    <textarea
                      aria-label={`Descripción del proyecto ${i + 1}`}
                      value={item.descripcion}
                      onChange={(e) => cambiar({ descripcion: e.target.value })}
                      rows={2}
                      placeholder="Descripción"
                      maxLength={1000}
                      className={cn(claseEntradaChica, "mt-2 w-full resize-none")}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editar({ portafolio: form.portafolio.filter((_, j) => j !== i) })}
                        className="text-danger hover:bg-danger-bg"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Quitar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Hoja de vida">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {perfil.tieneHojaDeVida ? "Hoja de vida cargada" : "Sin hoja de vida cargada"}
              </p>
              <p className="text-xs text-ink-faint">
                PDF hasta 10 MB. Solo la verán los administradores y la empresa que te haya enviado una solicitud.
              </p>
            </div>
            {perfil.tieneHojaDeVida && (
              <Button variant="ghost" size="sm" onClick={verHojaDeVida}>
                Ver
              </Button>
            )}
            <input
              ref={cvRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = "";
                if (archivo) subir("cv", archivo);
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => cvRef.current?.click()} disabled={ocupado !== null}>
              <Upload className="h-3.5 w-3.5" />{" "}
              {ocupado === "cv" ? "Subiendo…" : perfil.tieneHojaDeVida ? "Reemplazar PDF" : "Subir PDF"}
            </Button>
          </div>
        </Seccion>
      </fieldset>

      {!bloqueado && (
        <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-white/95 py-4 backdrop-blur">
          {cambios && <span className="text-xs text-ink-faint">Tienes cambios sin guardar.</span>}
          <Button onClick={guardar} disabled={!cambios || ocupado !== null}>
            {ocupado === "guardar" ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      )}
    </div>
  );
}

function formularioDe(p: PerfilConsultorPropio) {
  return {
    nombreProfesional: p.nombreProfesional,
    descripcion: p.descripcion,
    sitioWeb: p.sitioWeb,
    especialidades: p.especialidades,
    redes: p.redes,
    portafolio: p.portafolio,
  };
}

const claseEntrada = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500";
const claseEntradaChica = "rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-primary-500";

function Campo({
  etiqueta,
  id,
  ayuda,
  children,
}: {
  etiqueta: string;
  id: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-ink-faint">{ayuda}</p>}
    </div>
  );
}

function BannerEstado({
  estado,
  motivoRechazo,
  motivoSuspension,
  faltan,
  enviando,
  deshabilitado,
  onEnviar,
}: {
  estado: PerfilConsultorPropio["estadoPerfil"];
  motivoRechazo: string | null;
  motivoSuspension: string | null;
  faltan: string[];
  enviando: boolean;
  deshabilitado: boolean;
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
          <p className="text-sm font-semibold text-amber-700">Tu perfil está en revisión</p>
          <p className="text-xs text-amber-700/80">
            Un administrador lo validará pronto. Puedes seguir editándolo, pero la foto, la descripción, las
            especialidades y la hoja de vida no pueden quedar vacías.
          </p>
        </div>
      </div>
    );
  }

  if (estado === "suspendido") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-slate-50 px-5 py-4">
        <Lock className="h-5 w-5 shrink-0 text-ink-soft" />
        <div>
          <p className="text-sm font-semibold text-ink">Tu perfil está suspendido</p>
          {/* CU-27: el consultor ve por qué (sesión 022). */}
          {motivoSuspension && <p className="text-sm text-ink-soft">Motivo: {motivoSuspension}</p>}
          <p className="text-xs text-ink-soft">No apareces en el directorio. Contacta al equipo de la plataforma.</p>
        </div>
      </div>
    );
  }

  const aviso =
    faltan.length > 0
      ? `Para enviarlo a revisión te falta: ${faltan.join(", ")}.`
      : "Ya tienes los mínimos completos. Envía tu perfil a revisión.";

  if (estado === "rechazado") {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger-bg px-5 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">Tu perfil fue rechazado</p>
            {motivoRechazo && <p className="text-sm text-danger/90">Motivo: {motivoRechazo}</p>}
            <p className="mt-1 text-xs text-danger/80">Corrige lo indicado y vuelve a enviarlo. {faltan.length > 0 && aviso}</p>
          </div>
        </div>
        <Button variant="danger" size="sm" className="mt-3" onClick={onEnviar} disabled={deshabilitado || faltan.length > 0}>
          {enviando ? "Enviando…" : "Reenviar a revisión"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-slate-50 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className={ESTADO_PERFIL_ESTILO["incompleto"]}>{ESTADO_PERFIL_LABEL["incompleto"]}</Badge>
        <p className="text-sm text-ink-soft">{aviso}</p>
      </div>
      <Button variant="brick" size="sm" className="mt-3" onClick={onEnviar} disabled={deshabilitado || faltan.length > 0}>
        {enviando ? "Enviando…" : "Enviar a revisión"}
      </Button>
    </div>
  );
}

function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}
