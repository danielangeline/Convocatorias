"use client";

import { BotonGuardar } from "./BotonGuardar";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Info,
  Landmark,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAccesoSuscripcion, useCreditos, useProyectosPropios, useTarifas } from "@/lib/hooks";
import {
  diasRestantes,
  formatFechaLarga,
  ESTADO_CONVOCATORIA_LABEL,
  ESTADO_CONVOCATORIA_ESTILO,
  ORIGEN_CONVOCATORIA_LABEL,
  TIPO_DOCUMENTO_LABEL,
} from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { CompatRing } from "@/components/viz/CompatRing";
import { CompatBreakdown, type CriterioCompat } from "@/components/viz/CompatBreakdown";
import { DeadlineChip } from "@/components/viz/Deadline";
import type { Categoria, Convocatoria } from "@/lib/types";
import { textoCobertura } from "@/lib/departamentos";
import { equivalenteCop, formatRangoConvocatoria } from "@/lib/monedas";

/**
 * CU-08 · Ficha de la convocatoria. Los datos llegan del servidor, leídos con la
 * sesión de la empresa (RN-33); no se toman del store porque en el servidor el
 * store solo tiene su estado inicial, que son datos de ejemplo (sesión 016).
 *
 * RF-91: el consultor la abre desde su encargo, con su propio enlace de vuelta y
 * de descarga, y `acciones` en lugar de postular y generar.
 */
export function FichaConvocatoria({
  convocatoria,
  categorias,
  volver = { href: "/convocatorias", etiqueta: "Volver al catálogo" },
  documentosBase,
  acciones,
  guardada,
  paisesTexto,
  compatibilidad,
}: {
  convocatoria: Convocatoria | null;
  categorias: Categoria[];
  volver?: { href: string; etiqueta: string };
  /** Ruta de la API de sus adjuntos, sin `/{docId}/enlace`. */
  documentosBase?: string;
  acciones?: React.ReactNode;
  /** RF-103: con la prop se ofrece guardar (solo la empresa). */
  guardada?: boolean;
  /** RN-39: «Todos los países» o la lista de países elegibles, ya con sus nombres. */
  paisesTexto?: string;
  /** CU-10: el cruce con el proyecto que mejor coincide; sin él no hay «¿Te aplica?» (p. ej. el consultor). */
  compatibilidad?: { porcentaje: number; proyectoNombre: string; criterios: CriterioCompat[] } | null;
}) {
  const router = useRouter();
  const proyectos = useProyectosPropios();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [proyectoSel, setProyectoSel] = useState<string>("");
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [postulando, setPostulando] = useState(false);
  const [errorPostular, setErrorPostular] = useState<string | null>(null);
  const { requerirAcceso } = useAccesoSuscripcion();
  const { disponibles } = useCreditos();
  const tarifaDocumento = useTarifas().generacion;

  if (!convocatoria) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-2">No encontramos esta convocatoria.</p>
        <Link href={volver.href} className="mt-3 inline-block text-sm font-semibold text-pri-text hover:underline">
          {volver.etiqueta}
        </Link>
      </div>
    );
  }

  const dias = diasRestantes(convocatoria.fechaCierre);
  const cerrada = convocatoria.estado === "cerrada" || dias < 0;
  // RN-39: si el país de la empresa no puede postularse, postular y generar no se ofrecen (y la base los rechaza).
  const noElegible = convocatoria.elegible === false;
  const bloqueada = cerrada || noElegible;
  const equivalente = equivalenteCop(convocatoria);
  const categoriasCompletas = convocatoria.categorias.map((cid) => categorias.find((c) => c.id === cid)).filter(Boolean);

  // CU-08 paso 3, RNF-16: la URL se pide en el momento y vive 15 minutos. El
  // servidor la firma con la sesión de la empresa, así que solo funciona para
  // las convocatorias que ella puede ver (RN-33).
  const descargar = async (docId: string) => {
    setErrorDescarga(null);
    setDescargando(docId);
    const respuesta = await fetch(`${documentosBase ?? `/api/convocatorias/${convocatoria.id}/documentos`}/${docId}/enlace`);
    const json = await respuesta.json().catch(() => ({}));
    setDescargando(null);
    if (!respuesta.ok) {
      setErrorDescarga(json.error ?? "No pudimos preparar la descarga. Intenta de nuevo.");
      return;
    }
    window.open(json.datos.url as string, "_blank", "noopener,noreferrer");
  };

  // RF-17, CU-11 · La crea el servidor, que exige suscripción y vigencia
  // (RF-78) y, si el par ya tiene una en curso, devuelve esa (CU-11 1c, RN-35).
  const confirmarPostulacion = async () => {
    setErrorPostular(null);
    setPostulando(true);
    const respuesta = await fetch("/api/postulaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ convocatoriaId: convocatoria.id, proyectoId: proyectoSel || null }),
    }).catch(() => null);
    const json = respuesta ? await respuesta.json().catch(() => ({})) : {};
    setPostulando(false);
    if (!respuesta?.ok) {
      setErrorPostular(json.error ?? "No pudimos crear la postulación. Intenta de nuevo.");
      return;
    }
    setModalAbierto(false);
    const { id, creada } = json.datos as { id: string; creada: boolean };
    router.push(`/postulaciones/${id}${creada ? "" : "?existente=1"}`);
    router.refresh();
  };

  const accionPostular = () => {
    if (!requerirAcceso("postularte a esta convocatoria")) return;
    setErrorPostular(null);
    setModalAbierto(true);
  };
  const accionGenerar = () => {
    if (!requerirAcceso("generar un documento con IA")) return;
    router.push(`/convocatorias/${convocatoria.id}/generar`);
  };
  const requisitos = convocatoria.requisitos.slice().sort((a, b) => a.orden - b.orden);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 pb-20 lg:pb-0">
      <Link
        href={volver.href}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-ink-2 hover:text-pri-text"
      >
        <ArrowLeft className="h-4 w-4" /> {volver.etiqueta.replace(/^Volver al catálogo$/, "Convocatorias")}
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tono="ok">{convocatoria.tipo === "beneficio_tributario" ? "Beneficio tributario" : "Fondos"}</Badge>
          <Badge tono="neutro">{ORIGEN_CONVOCATORIA_LABEL[convocatoria.origen ?? "publico"]}</Badge>
          {convocatoria.estado !== "publicada" && (
            <Badge className={ESTADO_CONVOCATORIA_ESTILO[convocatoria.estado]}>{ESTADO_CONVOCATORIA_LABEL[convocatoria.estado]}</Badge>
          )}
          {noElegible && <Badge tono="error">Tu país no es elegible</Badge>}
        </div>
        <h1 className="mt-3 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink sm:text-[30px]">
          {convocatoria.nombre}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <Landmark className="h-4 w-4" aria-hidden /> {convocatoria.entidadConvocante}
          </span>
          {convocatoria.urlPostulacion && !bloqueada && (
            <a
              href={convocatoria.urlPostulacion}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-pri-text hover:underline"
            >
              Ver en el portal oficial <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </p>
      </header>

      {/* Los cuatro datos, en una sola tarjeta con divisores. */}
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px overflow-hidden rounded-md border border-line bg-line">
        <DatoCelda etiqueta="Monto">
          <span className="font-tabular text-base font-medium">{formatRangoConvocatoria(convocatoria)}</span>
          {equivalente && <span className="mt-0.5 block text-xs font-normal text-ink-3">{equivalente}</span>}
        </DatoCelda>
        <DatoCelda etiqueta="Cierre">
          <span className="block text-[15px] font-semibold">{formatFechaLarga(convocatoria.fechaCierre)}</span>
          <span className="mt-1.5 block">
            {cerrada ? <Badge tono="neutro">Cerrada</Badge> : <DeadlineChip dias={dias} />}
          </span>
          {convocatoria.fechaApertura && (
            <span className="mt-1 block text-xs font-normal text-ink-3">Abre el {formatFechaLarga(convocatoria.fechaApertura)}</span>
          )}
        </DatoCelda>
        <DatoCelda etiqueta="Pueden postularse">
          <span className="text-[15px] font-semibold">{paisesTexto ?? "—"}</span>
        </DatoCelda>
        <DatoCelda etiqueta="Cobertura">
          <span className="text-[15px] font-semibold">{textoCobertura(convocatoria)}</span>
          {convocatoria.ubicacion && <span className="mt-0.5 block text-xs font-normal text-ink-3">{convocatoria.ubicacion}</span>}
        </DatoCelda>
      </dl>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-6">
          {/* ¿Te aplica?: el cruce determinístico de CU-10 (RN-05) con los criterios reales. */}
          {compatibilidad && !cerrada && (
            <section aria-labelledby="te-aplica" className="rounded-md border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <CompatRing porcentaje={compatibilidad.porcentaje} tamano={72} />
                <div>
                  <h2 id="te-aplica" className="font-display text-xl font-semibold text-ink">
                    ¿Te aplica?
                  </h2>
                  <p className="mt-0.5 text-[13px] text-ink-3">
                    Comparada con tu proyecto <strong className="font-semibold text-ink-2">{compatibilidad.proyectoNombre}</strong>
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-line-2 pt-5">
                <CompatBreakdown criterios={compatibilidad.criterios} />
              </div>
            </section>
          )}

          <section aria-labelledby="de-que-se-trata">
            <h2 id="de-que-se-trata" className="font-display text-xl font-semibold text-ink">
              De qué se trata
            </h2>
            <p className="mt-2 max-w-[68ch] text-[15px] leading-[1.55] text-ink-2 [text-wrap:pretty]">{convocatoria.descripcion}</p>
            {categoriasCompletas.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {categoriasCompletas.map((cat) => (
                  <Chip key={cat!.id} tono={cat!.tipo}>
                    {cat!.nombre}
                  </Chip>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="requisitos">
            <h2 id="requisitos" className="font-display text-xl font-semibold text-ink">
              Requisitos
            </h2>
            <ol className="m-0 mt-3 list-none divide-y divide-line-2 rounded-md border border-line bg-surface p-0">
              {requisitos.map((req, i) => (
                <li key={req.id} className="flex items-start gap-4 px-4 py-3.5">
                  <span className="font-tabular w-6 flex-none pt-0.5 text-[13px] font-medium text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink">{req.descripcion}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {req.tipo === "documento" ? "Documento" : "Condición"} · {req.obligatorio ? "Obligatorio" : "Opcional"}
                    </p>
                  </div>
                </li>
              ))}
              {requisitos.length === 0 && <li className="px-4 py-3.5 text-sm text-ink-3">La convocatoria no publicó requisitos.</li>}
            </ol>
          </section>

          <section aria-labelledby="documentos-conv">
            <h2 id="documentos-conv" className="font-display text-xl font-semibold text-ink">
              Documentos de la convocatoria
            </h2>
            {errorDescarga && (
              <p role="alert" className="mt-3 rounded-[4px] bg-rose-soft px-4 py-2.5 text-sm text-rose">
                {errorDescarga}
              </p>
            )}
            <ul className="m-0 mt-3 list-none divide-y divide-line-2 rounded-md border border-line bg-surface p-0">
              {convocatoria.documentos.map((doc) => (
                <li key={doc.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                  {/* Los nombres de los anexos suelen ser una sola palabra larga: sin min-w-0 y
                      overflow-wrap empujan el botón fuera de la pantalla. */}
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] bg-pri-soft text-pri-text">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                      <p className="text-sm font-semibold text-ink">{doc.nombre}</p>
                      <p className="text-xs text-ink-3">
                        {TIPO_DOCUMENTO_LABEL[doc.tipo]} · {doc.archivo} · <span className="font-tabular">{doc.pesoKb} KB</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    disabled={descargando === doc.id}
                    onClick={() => descargar(doc.id)}
                    aria-label={`Descargar ${doc.nombre}`}
                  >
                    <Download className="h-4 w-4" />
                    {/* En móvil, solo el ícono: el nombre necesita el ancho. El aria-label lo nombra. */}
                    <span className="hidden sm:inline">{descargando === doc.id ? "Preparando…" : "Descargar"}</span>
                  </Button>
                </li>
              ))}
              {convocatoria.documentos.length === 0 && <li className="px-4 py-3.5 text-sm text-ink-3">Sin documentos adjuntos.</li>}
            </ul>
          </section>
        </div>

        {/* Columna de acción: pegajosa a 80 px en escritorio. */}
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:sticky lg:top-20">
          {acciones ? (
            <div className="rounded-md border border-line bg-surface p-5">{acciones}</div>
          ) : (
            <>
              <section className="rounded-md border border-line border-t-[3px] border-t-pri bg-surface p-5">
                <h2 className="font-display text-xl font-semibold text-ink">¿Te interesa?</h2>
                <p className="mt-2 text-sm leading-[1.55] text-ink-2">
                  {cerrada
                    ? "Esta convocatoria ya cerró y no admite nuevas postulaciones."
                    : noElegible
                      ? "Las organizaciones de tu país no pueden postularse a esta convocatoria."
                      : `Abrimos tu expediente con los ${requisitos.length} requisitos como lista de tareas y te avisamos antes del cierre.`}
                </p>
                <div className="mt-4 hidden flex-col gap-2.5 lg:flex">
                  <Button size="lg" className="w-full" disabled={bloqueada} onClick={accionPostular}>
                    Me interesa
                  </Button>
                  {guardada !== undefined && !cerrada && (
                    <BotonGuardar convocatoriaId={convocatoria.id} inicial={guardada} className="w-full" />
                  )}
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-3 lg:mt-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
                  La presentación se hace en el portal de la entidad; aquí preparas tu postulación.
                </p>
              </section>

              <section className="divide-y divide-line-2 rounded-md border border-line bg-surface">
                <button
                  type="button"
                  disabled={bloqueada}
                  onClick={accionGenerar}
                  className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-5 w-5 flex-none text-pri-text" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">Escribir el borrador con IA</span>
                    <span className="block text-xs text-ink-3">
                      Usa {tarifaDocumento.toLocaleString("es-CO")} de tus {disponibles.toLocaleString("es-CO")} créditos
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-ink-3" aria-hidden />
                </button>
                <Link
                  href="/consultores"
                  className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <Users className="h-5 w-5 flex-none text-pri-text" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">Pedir ayuda a un consultor</span>
                    <span className="block text-xs text-ink-3">Revisa el directorio y envía tu solicitud</span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-ink-3" aria-hidden />
                </Link>
              </section>
              <p className="text-xs text-ink-3">Fuente: {convocatoria.entidadConvocante}</p>
            </>
          )}
        </aside>
      </div>

      {/* Móvil: barra fija sobre las pestañas con guardar y «Me interesa». */}
      {!acciones && (
        <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 flex gap-2.5 border-t border-line bg-surface px-4 py-3 lg:hidden">
          {guardada !== undefined && !cerrada && (
            <BotonGuardar convocatoriaId={convocatoria.id} inicial={guardada} soloIcono className="w-12 flex-none px-0" />
          )}
          <Button size="lg" className="flex-1" disabled={bloqueada} onClick={accionPostular}>
            Me interesa
          </Button>
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-postular"
            className="w-full max-w-md rounded-md border border-line bg-surface p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="titulo-postular" className="font-display text-xl font-semibold text-ink">
                Confirmar postulación
              </h3>
              <button
                onClick={() => setModalAbierto(false)}
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-[4px] text-ink-3 hover:bg-surface-2 hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm leading-[1.55] text-ink-2">
              Vas a crear una postulación a <strong>{convocatoria.nombre}</strong>. Puedes asociarla a uno de tus proyectos
              existentes o dejarla sin proyecto por ahora. Si ya tienes una en curso con ese mismo proyecto, te llevaremos a
              ella.
            </p>
            <label htmlFor="campo-postular-1" className="mt-4 block text-[13px] font-semibold text-ink">
              Proyecto (opcional)
            </label>
            <select
              id="campo-postular-1"
              value={proyectoSel}
              onChange={(e) => setProyectoSel(e.target.value)}
              className="mt-1.5 min-h-12 w-full rounded-[4px] border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-pri focus:ring-2 focus:ring-pri-soft"
            >
              <option value="">Sin proyecto asociado</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {errorPostular && (
              <p role="alert" className="mt-4 rounded-[4px] bg-rose-soft px-3 py-2 text-sm text-rose">
                {errorPostular}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirmarPostulacion} disabled={postulando}>
                {postulando ? "Creando…" : "Crear postulación"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DatoCelda({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-5">
      <dt className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">{etiqueta}</dt>
      <dd className="m-0 mt-2 text-ink">{children}</dd>
    </div>
  );
}
