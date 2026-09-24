"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Landmark,
  Wallet,
  FileText,
  Download,
  CheckCircle2,
  Circle,
  Info,
  Sparkles,
  X,
  ExternalLink,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccesoSuscripcion, useProyectosPropios } from "@/lib/hooks";
import {
  diasRestantes,
  formatFechaLarga,
  ESTADO_CONVOCATORIA_LABEL,
  ESTADO_CONVOCATORIA_ESTILO,
  TIPO_DOCUMENTO_LABEL,
  formatRangoCOP,
} from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import type { Categoria, Convocatoria } from "@/lib/types";
import { textoCobertura } from "@/lib/departamentos";

/**
 * CU-08 · Ficha de la convocatoria. Los datos llegan del servidor, leídos con la
 * sesión de la empresa (RN-33); no se toman del store porque en el servidor el
 * store solo tiene su estado inicial, que son datos de ejemplo (sesión 016).
 */
export function FichaConvocatoria({
  convocatoria,
  categorias,
}: {
  convocatoria: Convocatoria | null;
  categorias: Categoria[];
}) {
  const router = useRouter();
  const proyectos = useProyectosPropios();
  const crearPostulacion = useAppStore((s) => s.crearPostulacion);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [proyectoSel, setProyectoSel] = useState<string>("");
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const { requerirAcceso } = useAccesoSuscripcion();

  if (!convocatoria) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">No encontramos esta convocatoria.</p>
        <Link href="/convocatorias" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const dias = diasRestantes(convocatoria.fechaCierre);
  const cerrada = convocatoria.estado === "cerrada" || dias < 0;
  const categoriasCompletas = convocatoria.categorias.map((cid) => categorias.find((c) => c.id === cid)).filter(Boolean);

  // CU-08 paso 3, RNF-16: la URL se pide en el momento y vive 15 minutos. El
  // servidor la firma con la sesión de la empresa, así que solo funciona para
  // las convocatorias que ella puede ver (RN-33).
  const descargar = async (docId: string) => {
    setErrorDescarga(null);
    setDescargando(docId);
    const respuesta = await fetch(`/api/convocatorias/${convocatoria.id}/documentos/${docId}/enlace`);
    const json = await respuesta.json().catch(() => ({}));
    setDescargando(null);
    if (!respuesta.ok) {
      setErrorDescarga(json.error ?? "No pudimos preparar la descarga. Intenta de nuevo.");
      return;
    }
    window.open(json.datos.url as string, "_blank", "noopener,noreferrer");
  };

  const confirmarPostulacion = () => {
    const nueva = crearPostulacion(convocatoria.id, proyectoSel || null);
    setModalAbierto(false);
    router.push(`/postulaciones/${nueva.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/convocatorias"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>

      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={ESTADO_CONVOCATORIA_ESTILO[convocatoria.estado]}>
            {ESTADO_CONVOCATORIA_LABEL[convocatoria.estado]}
          </Badge>
          {!cerrada && dias < 15 && (
            <Badge className="bg-gold-50 text-gold-700 ring-gold-200">
              Cierra en {dias} {dias === 1 ? "día" : "días"}
            </Badge>
          )}
        </div>

        <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {convocatoria.nombre}
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <Landmark className="h-4 w-4" /> {convocatoria.entidadConvocante}
        </p>

        <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">{convocatoria.descripcion}</p>

        <div className="mt-6 grid gap-4 rounded-xl bg-primary-50/60 p-5 sm:grid-cols-3">
          <Dato icon={Wallet} etiqueta="Monto de financiación">
            <span className="font-tabular">
              {formatRangoCOP(convocatoria.montoMin, convocatoria.montoMax)}
            </span>
          </Dato>
          <Dato icon={MapPin} etiqueta="Cobertura">
            {textoCobertura(convocatoria)}
            {convocatoria.ubicacion && (
              <span className="mt-0.5 block text-xs font-normal text-ink-faint">{convocatoria.ubicacion}</span>
            )}
          </Dato>
          <Dato icon={Calendar} etiqueta="Fechas">
            {convocatoria.fechaApertura
              ? `${formatFechaLarga(convocatoria.fechaApertura)} — ${formatFechaLarga(convocatoria.fechaCierre)}`
              : `Cierra el ${formatFechaLarga(convocatoria.fechaCierre)}`}
          </Dato>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Categorías</p>
          <div className="flex flex-wrap gap-2">
            {categoriasCompletas.map((cat) => (
              <Chip key={cat!.id} tono={cat!.tipo}>
                {cat!.nombre}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="font-display text-base font-semibold text-ink">Requisitos</h2>
          <ul className="mt-3 space-y-2">
            {convocatoria.requisitos
              .slice()
              .sort((a, b) => a.orden - b.orden)
              .map((req) => (
                <li key={req.id} className="flex items-start gap-2.5 rounded-lg border border-line-soft px-4 py-3">
                  {req.obligatorio ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                  )}
                  <div>
                    <p className="text-sm text-ink">{req.descripcion}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {req.tipo === "documento" ? "Documento" : "Condición"} · {req.obligatorio ? "Obligatorio" : "Opcional"}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        </div>

        <div className="mt-8">
          <h2 className="font-display text-base font-semibold text-ink">Documentos de la convocatoria</h2>
          {errorDescarga && (
            <p role="alert" className="mt-3 rounded-lg bg-brick-50 px-4 py-2.5 text-sm text-brick-700">
              {errorDescarga}
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {convocatoria.documentos.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-line-soft px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{doc.nombre}</p>
                    <p className="text-xs text-ink-faint">
                      {TIPO_DOCUMENTO_LABEL[doc.tipo]} · {doc.archivo} · {doc.pesoKb} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={descargando === doc.id}
                  onClick={() => descargar(doc.id)}
                  aria-label={`Descargar ${doc.nombre}`}
                >
                  <Download className="h-4 w-4" /> {descargando === doc.id ? "Preparando…" : "Descargar"}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-line-soft pt-6">
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <Info className="h-3.5 w-3.5" />
            {cerrada
              ? "Esta convocatoria ya cerró y no admite nuevas postulaciones."
              : "Al postularte crearás un expediente de seguimiento para esta convocatoria."}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* RN-02: en una cerrada las tres acciones de CU-08 quedan deshabilitadas. */}
            {convocatoria.urlPostulacion && !cerrada && (
              <a href={convocatoria.urlPostulacion} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="lg">
                  <ExternalLink className="h-4 w-4" /> Ir al portal de la entidad
                </Button>
              </a>
            )}
            <Button
              variant="teal"
              size="lg"
              disabled={cerrada}
              onClick={() => {
                if (!requerirAcceso("generar un documento con IA")) return;
                router.push(`/convocatorias/${convocatoria.id}/generar`);
              }}
            >
              <Sparkles className="h-4 w-4" /> Generar documento con IA
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={cerrada}
              onClick={() => {
                if (!requerirAcceso("postularte a esta convocatoria")) return;
                setModalAbierto(true);
              }}
            >
              Postular
            </Button>
          </div>
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">Confirmar postulación</h3>
              <button onClick={() => setModalAbierto(false)} className="text-ink-faint hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-ink-soft">
              Vas a crear una postulación a <strong>{convocatoria.nombre}</strong>. Puedes asociarla a
              uno de tus proyectos existentes o dejarla sin proyecto por ahora.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Proyecto (opcional)
            </label>
            <select
              value={proyectoSel}
              onChange={(e) => setProyectoSel(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Sin proyecto asociado</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirmarPostulacion}>
                Crear postulación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dato({
  icon: Icon,
  etiqueta,
  children,
}: {
  icon: React.ElementType;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        <Icon className="h-3.5 w-3.5" /> {etiqueta}
      </p>
      <p className="mt-1 text-sm font-medium text-ink">{children}</p>
    </div>
  );
}
