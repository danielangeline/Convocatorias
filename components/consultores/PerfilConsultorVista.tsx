"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Briefcase,
  Image as ImageIcon,
  Users,
  Link2,
  Lock,
  FileText,
  UserPlus,
  X,
  CheckCircle2,
  Target,
  Compass,
  FolderKanban,
  FileStack,
  UserRound,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { PerfilConsultorPublico, RedSocialTipo, TipoAyudaEncargo } from "@/lib/types";
import { useAccesoSuscripcion, useProyectosPropios, usePostulacionesPropias } from "@/lib/hooks";
import { diasRestantes, cn } from "@/lib/utils";
import { fechaColombia } from "@/lib/fechas";
import { RatingStars } from "@/components/RatingStars";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Aviso } from "@/components/identidad/Campo";

type OrigenSolicitud = "proyecto" | "postulacion";

const NOMBRE_RED: Record<RedSocialTipo, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  otra: "Otro enlace",
};

const iconosRed: Record<RedSocialTipo, React.ElementType> = {
  linkedin: Briefcase,
  instagram: ImageIcon,
  facebook: Users,
  otra: Link2,
};

/**
 * CU-21 · Perfil público del consultor (RF-27). El perfil llega del servidor
 * sin ningún dato de contacto; sitio web, redes y hoja de vida solo vienen
 * cuando la empresa tiene un encargo en curso con él (RF-80). La solicitud
 * (RF-74) sigue en el store hasta el paso 3 del Sprint 4.
 */
export function PerfilConsultorVista({ consultor }: { consultor: PerfilConsultorPublico }) {
  const router = useRouter();
  const calificaciones = consultor.resenas;
  const solicitud = useAppStore((s) => s.solicitudConsultorEnCurso);
  const iniciarSolicitudConsultor = useAppStore((s) => s.iniciarSolicitudConsultor);
  const crearEncargoStore = useAppStore((s) => s.crearEncargoDesdeDirectorio);
  const recordarConsultor = useAppStore((s) => s.recordarConsultor);
  const proyectos = useProyectosPropios();
  const postulaciones = usePostulacionesPropias();
  const convocatorias = useAppStore((s) => s.convocatorias);
  const { requerirAcceso } = useAccesoSuscripcion();

  const [errorCv, setErrorCv] = useState<string | null>(null);

  // El encargo del store necesita al consultor para mostrarlo en "Encargos".
  // Sin datos de contacto: esos los decide el servidor (RF-80).
  const crearEncargoDesdeDirectorio = (consultorId: string) => {
    recordarConsultor({
      id: consultor.id,
      nombreProfesional: consultor.nombreProfesional,
      descripcion: consultor.descripcion,
      fotoUrl: consultor.fotoUrl ?? "",
      sitioWeb: "",
      redes: [],
      especialidades: consultor.especialidades.map((e) => e.id),
      portafolio: [],
      cvNombre: "",
      estadoPerfil: "aprobado",
      esEquipoInterno: false,
      ratingPromedio: consultor.ratingPromedio,
      totalEncargosCompletados: consultor.totalEncargosCompletados,
      correo: "",
    });
    return crearEncargoStore(consultorId);
  };

  // RF-80 · RNF-16: la pestaña se abre antes de pedir la URL firmada; si se
  // abriera después de esperar, el navegador la bloquearía como emergente.
  const verHojaDeVida = async () => {
    setErrorCv(null);
    const pestana = window.open("", "_blank");
    try {
      const respuesta = await fetch(`/api/consultores/${consultor.id}/cv`);
      const json = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok || !json.datos?.url) {
        pestana?.close();
        setErrorCv(json.error ?? "No pudimos abrir la hoja de vida. Intenta de nuevo.");
        return;
      }
      if (pestana) {
        pestana.opener = null;
        pestana.location.href = json.datos.url;
      } else {
        window.location.href = json.datos.url;
      }
    } catch {
      pestana?.close();
      setErrorCv("No hay conexión con el servidor. Intenta de nuevo.");
    }
  };

  // RF-74: solicitud directa desde el perfil, eligiendo proyecto o postulación
  // en el mismo flujo — no depende de haber iniciado la solicitud desde CU-19.
  const [modalAbierto, setModalAbierto] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [origen, setOrigen] = useState<OrigenSolicitud>("proyecto");
  const [proyectoIdSel, setProyectoIdSel] = useState("");
  const [postulacionIdSel, setPostulacionIdSel] = useState("");
  const [tipoAyuda, setTipoAyuda] = useState<TipoAyudaEncargo>("convocatoria_especifica");
  const [convocatoriaIdSel, setConvocatoriaIdSel] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [confirmacion, setConfirmacion] = useState(false);

  const convocatoriasVigentes = useMemo(
    () => convocatorias.filter((c) => c.estado === "publicada" && diasRestantes(c.fechaCierre) >= 0),
    [convocatorias]
  );
  const postulacionesVinculadas = useMemo(
    () => postulaciones.filter((p) => p.proyectoId && p.estado !== "cerrada"),
    [postulaciones]
  );

  const solicitar = () => {
    if (!requerirAcceso("solicitar un consultor")) return;
    const encargo = crearEncargoDesdeDirectorio(consultor.id);
    if (encargo) router.push("/encargos");
  };

  const abrirSolicitudDirecta = () => {
    if (!requerirAcceso("solicitar un consultor")) return;
    setPaso(1);
    setOrigen("proyecto");
    setProyectoIdSel("");
    setPostulacionIdSel("");
    setTipoAyuda("convocatoria_especifica");
    setConvocatoriaIdSel("");
    setTitulo("");
    setDescripcion("");
    setConfirmacion(false);
    setModalAbierto(true);
  };

  const paso1Valido =
    origen === "proyecto"
      ? !!proyectoIdSel && (tipoAyuda !== "convocatoria_especifica" || !!convocatoriaIdSel)
      : !!postulacionIdSel;

  const irAlPaso2 = () => {
    if (!paso1Valido) return;
    setPaso(2);
  };

  const enviarSolicitudDirecta = () => {
    if (!titulo.trim() || !descripcion.trim()) return;
    if (origen === "postulacion") {
      const postulacion = postulaciones.find((p) => p.id === postulacionIdSel);
      if (!postulacion || !postulacion.proyectoId) return;
      iniciarSolicitudConsultor({
        proyectoId: postulacion.proyectoId,
        tituloTarea: titulo.trim(),
        descripcionTarea: descripcion.trim(),
        tipoAyuda: "convocatoria_especifica",
        convocatoriaId: postulacion.convocatoriaId,
      });
    } else {
      iniciarSolicitudConsultor({
        proyectoId: proyectoIdSel,
        tituloTarea: titulo.trim(),
        descripcionTarea: descripcion.trim(),
        tipoAyuda,
        convocatoriaId: tipoAyuda === "convocatoria_especifica" ? convocatoriaIdSel : null,
      });
    }
    const encargo = crearEncargoDesdeDirectorio(consultor.id);
    if (encargo) setConfirmacion(true);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/consultores"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al directorio
      </Link>

      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {consultor.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage
            <img src={consultor.fotoUrl} alt="" className="h-24 w-24 rounded-full object-cover ring-2 ring-brick-100" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-ink-faint ring-2 ring-brick-100">
              <UserRound className="h-10 w-10" />
            </span>
          )}
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-ink">{consultor.nombreProfesional}</h1>
            <div className="mt-1.5">
              <RatingStars valor={consultor.ratingPromedio} totalResenas={calificaciones.length} size="md" />
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
              <Briefcase className="h-3.5 w-3.5" /> {consultor.totalEncargosCompletados} encargos completados
            </p>
          </div>
          {solicitud ? (
            <Button variant="primary" size="lg" onClick={solicitar} className="w-full shrink-0 sm:w-auto">
              Solicitar para mi tarea
            </Button>
          ) : (
            <Button variant="brick" size="lg" onClick={abrirSolicitudDirecta} className="w-full shrink-0 sm:w-auto">
              <UserPlus className="h-4 w-4" /> Solicitar a este consultor
            </Button>
          )}
        </div>

        <p className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{consultor.descripcion}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {consultor.especialidades.map((e) => (
            <Chip key={e.id} tono={e.tipo}>
              {e.nombre}
            </Chip>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line-soft pt-5">
          {consultor.contacto ? (
            <>
              {consultor.contacto.sitioWeb && (
                <a
                  href={consultor.contacto.sitioWeb}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
                >
                  <Globe className="h-4 w-4" /> Sitio web
                </a>
              )}
              {consultor.contacto.redes.map((red) => {
                const Icon = iconosRed[red.tipo];
                return (
                  <a
                    key={red.url}
                    href={red.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
                  >
                    <Icon className="h-4 w-4" /> {NOMBRE_RED[red.tipo]}
                  </a>
                );
              })}
              {consultor.contacto.tieneHojaDeVida && (
                <button
                  type="button"
                  onClick={verHojaDeVida}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-primary-700 ring-1 ring-inset ring-line hover:bg-primary-50"
                >
                  <FileText className="h-3.5 w-3.5" /> Ver hoja de vida
                </button>
              )}
            </>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-ink-faint ring-1 ring-inset ring-line">
              <Lock className="h-3.5 w-3.5" />
              Sitio web, redes y hoja de vida se muestran cuando el consultor acepte tu solicitud
            </span>
          )}
        </div>
        {errorCv && (
          <div className="mt-3">
            <Aviso tipo="error">{errorCv}</Aviso>
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-display text-base font-semibold text-ink">Portafolio</h2>
          {consultor.portafolio.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">Este consultor aún no registró proyectos en su portafolio.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {consultor.portafolio.map((item, i) => (
                <div key={i} className="rounded-xl border border-line-soft p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">{item.nombreProyecto}</p>
                    {item.anio && <span className="font-tabular text-xs text-ink-faint">{item.anio}</span>}
                  </div>
                  {item.entidad && <p className="text-xs text-ink-faint">{item.entidad}</p>}
                  {item.descripcion && <p className="mt-2 text-sm text-ink-soft">{item.descripcion}</p>}
                  {item.resultado && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
                      <FileText className="h-3.5 w-3.5" /> {item.resultado}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="font-display text-base font-semibold text-ink">
            Reseñas ({calificaciones.length})
          </h2>
          {calificaciones.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">Este consultor aún no tiene reseñas.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {calificaciones.map((c, i) => (
                <li key={i} className="rounded-xl border border-line-soft p-4">
                  <div className="flex items-center justify-between">
                    <RatingStars valor={c.estrellas} />
                    <span className="text-xs text-ink-faint">{fechaColombia(c.fecha)}</span>
                  </div>
                  {c.comentario && <p className="mt-2 text-sm text-ink-soft">{c.comentario}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">
                {confirmacion
                  ? "Solicitud enviada"
                  : `Solicitar a ${consultor.nombreProfesional} · Paso ${paso} de 2`}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="text-ink-faint hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            {confirmacion ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <p className="mt-3 text-sm text-ink-soft">
                  Enviamos tu solicitud a <strong>{consultor.nombreProfesional}</strong> para{" "}
                  <strong>{titulo}</strong>. Te avisaremos cuando la acepte — podrás ver el avance en{" "}
                  <Link href="/encargos" className="font-semibold text-primary-700 hover:underline">
                    Encargos
                  </Link>
                  .
                </p>
                <Button variant="primary" className="mt-5" onClick={() => router.push("/encargos")}>
                  Ver en Encargos
                </Button>
              </div>
            ) : paso === 1 ? (
              <div className="space-y-4">
                <p className="text-sm text-ink-soft">¿Para qué proyecto o postulación necesitas ayuda?</p>

                <div className="flex gap-2 rounded-lg bg-slate-50 p-1">
                  <button
                    onClick={() => setOrigen("proyecto")}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                      origen === "proyecto" ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-ink-faint"
                    )}
                  >
                    Desde un proyecto
                  </button>
                  <button
                    onClick={() => setOrigen("postulacion")}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                      origen === "postulacion" ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-ink-faint"
                    )}
                  >
                    Desde una postulación
                  </button>
                </div>

                {origen === "proyecto" ? (
                  proyectos.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint">
                      Aún no tienes proyectos registrados.{" "}
                      <Link href="/proyectos" className="font-semibold text-primary-700 hover:underline">
                        Crea uno
                      </Link>{" "}
                      para poder solicitar un consultor.
                    </p>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                          Proyecto
                        </label>
                        <select
                          value={proyectoIdSel}
                          onChange={(e) => setProyectoIdSel(e.target.value)}
                          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
                        >
                          <option value="">Selecciona un proyecto...</option>
                          {proyectos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

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
                            <span className="block text-sm font-semibold text-ink">
                              Ayuda con una convocatoria específica
                            </span>
                            <span className="block text-xs text-ink-faint">
                              Ya sabes a cuál quieres aplicar.
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
                            <span className="block text-sm font-semibold text-ink">
                              Ayuda para encontrar una convocatoria
                            </span>
                            <span className="block text-xs text-ink-faint">Aún no sabes a cuál aplicar.</span>
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
                    </>
                  )
                ) : postulacionesVinculadas.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint">
                    No tienes postulaciones con un proyecto vinculado. Usa la pestaña &ldquo;Desde un
                    proyecto&rdquo; o vincula un proyecto a una postulación primero.
                  </p>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      Postulación
                    </label>
                    <select
                      value={postulacionIdSel}
                      onChange={(e) => setPostulacionIdSel(e.target.value)}
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
                    >
                      <option value="">Selecciona una postulación...</option>
                      {postulacionesVinculadas.map((p) => {
                        const proyectoNombre = proyectos.find((pr) => pr.id === p.proyectoId)?.nombre ?? "Proyecto";
                        const convocatoriaNombre =
                          convocatorias.find((c) => c.id === p.convocatoriaId)?.nombre ?? "Convocatoria";
                        return (
                          <option key={p.id} value={p.id}>
                            {proyectoNombre} — {convocatoriaNombre}
                          </option>
                        );
                      })}
                    </select>
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint">
                      <FileStack className="mt-0.5 h-3.5 w-3.5 shrink-0" /> El consultor verá el proyecto y la
                      convocatoria de esta postulación, con su checklist.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setModalAbierto(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" onClick={irAlPaso2} disabled={!paso1Valido}>
                    Continuar
                  </Button>
                </div>
              </div>
            ) : (
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
                    placeholder="Cuéntanos qué necesitas resolver"
                    className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-faint">
                  <FolderKanban className="mt-0.5 h-3.5 w-3.5 shrink-0" /> El contenido del proyecto
                  {origen === "postulacion" || tipoAyuda === "convocatoria_especifica"
                    ? " y los datos de la convocatoria elegida"
                    : ""}{" "}
                  se adjuntan automáticamente — no necesitas repetirlos aquí.
                </p>
                <div className="flex justify-between gap-3">
                  <Button variant="ghost" onClick={() => setPaso(1)}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Volver
                  </Button>
                  <Button
                    variant="primary"
                    onClick={enviarSolicitudDirecta}
                    disabled={!titulo.trim() || !descripcion.trim()}
                  >
                    Enviar solicitud
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
