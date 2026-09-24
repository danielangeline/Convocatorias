"use client";

import Link from "next/link";
import { ArrowLeft, Check, X as XIcon, MapPin, Wallet, Info, Lock, Sparkles, CircleDashed } from "lucide-react";
import { diasRestantes, formatRangoCOP, ESTADO_CONVOCATORIA_LABEL, ESTADO_CONVOCATORIA_ESTILO } from "@/lib/utils";
import { textoCobertura } from "@/lib/departamentos";
import { useAccesoSuscripcion } from "@/lib/hooks";
import type { ClaveCriterio, CriterioEvaluado, ResultadoSugerencias, Sugerencia } from "@/lib/sugerencias";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, LinkButton } from "@/components/ui/Button";

/**
 * CU-10 · Sugerencias del proyecto. El cálculo llega hecho del servidor
 * (`sugerencias_proyecto`, docs/05 §9.6); aquí solo se presenta, con la
 * aclaración de RN-05: es un cruce de criterios, no una predicción.
 */

function colorCompatibilidad(porcentaje: number): string {
  if (porcentaje >= 80) return "text-success";
  if (porcentaje >= 40) return "text-gold-600";
  return "text-ink-faint";
}

function AnilloCompatibilidad({ porcentaje }: { porcentaje: number }) {
  const radio = 26;
  const circunferencia = 2 * Math.PI * radio;
  const offset = circunferencia * (1 - porcentaje / 100);

  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={radio} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radio}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          className={colorCompatibilidad(porcentaje)}
        />
      </svg>
      <span className="absolute font-tabular text-sm font-bold text-ink">{porcentaje}%</span>
    </div>
  );
}

function Criterio({ c }: { c: CriterioEvaluado }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {c.estado === "cumple" ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
      ) : c.estado === "sin_dato" ? (
        <CircleDashed className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
      ) : (
        <XIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
      )}
      <span className={c.estado === "cumple" ? "text-ink" : "text-ink-faint"}>
        {c.etiqueta}
        {c.estado === "sin_dato" && " · falta el dato"}
        <span className="sr-only">{c.estado === "cumple" ? ": coincide" : c.estado === "sin_dato" ? "" : ": no coincide"}</span>
      </span>
    </div>
  );
}

/** Qué campo del proyecto abrir para completar el dato de un criterio (RF-81). */
const CAMPO_DEL_CRITERIO: Record<ClaveCriterio, string> = {
  tipo_proyecto: "categorias",
  sector: "categorias",
  tipo_entidad: "categorias",
  monto: "montoBuscado",
  ubicacion: "departamento",
};

const DATO_DEL_CRITERIO: Record<ClaveCriterio, string> = {
  tipo_proyecto: "una categoría de tipo de proyecto",
  sector: "una categoría de sector",
  tipo_entidad: "una categoría de tipo de entidad",
  monto: "el monto buscado",
  ubicacion: "el departamento donde se ejecuta",
};

const enLista = (partes: string[]) =>
  partes.length <= 1 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

/** CU-10 2a · primero el dato que falta; después, en la página, las vigentes más cercanas. */
function SinCoincidencias({ proyectoId, faltan, evaluadas }: { proyectoId: string; faltan: ResultadoSugerencias["faltan"]; evaluadas: number }) {
  if (evaluadas === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        titulo="No hay convocatorias vigentes ahora"
        descripcion="Cuando se publiquen convocatorias nuevas, verás aquí las que coinciden con este proyecto."
      />
    );
  }
  const descripcion =
    faltan.length > 0
      ? `Ninguna de las ${evaluadas} convocatorias vigentes coincide con tu proyecto. Le falta ${enLista(
          faltan.map((f) => DATO_DEL_CRITERIO[f.clave])
        )}: complétalo para que podamos compararlo.`
      : `Ninguna de las ${evaluadas} convocatorias vigentes coincide con tu proyecto en ningún criterio. Revisa sus categorías, el monto y el departamento.`;
  return (
    <EmptyState
      icon={Sparkles}
      titulo="Sin coincidencias por ahora"
      descripcion={descripcion}
      accion={
        <LinkButton
          href={`/proyectos/${proyectoId}?editar=${faltan.length > 0 ? CAMPO_DEL_CRITERIO[faltan[0].clave] : "categorias"}`}
          variant="secondary"
        >
          {faltan.length > 0 ? "Completar el proyecto" : "Revisar el proyecto"}
        </LinkButton>
      }
    />
  );
}

function TarjetaSugerencia({ s }: { s: Sugerencia }) {
  const { convocatoria, criterios, porcentaje } = s;
  const dias = diasRestantes(convocatoria.fechaCierre);
  return (
    <Link
      href={`/convocatorias/${convocatoria.id}`}
      className="block rounded-2xl border border-line p-5 transition-colors hover:border-primary-200 hover:bg-primary-50/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <AnilloCompatibilidad porcentaje={porcentaje} />
          <div>
            <div className="flex items-center gap-2">
              <Badge className={ESTADO_CONVOCATORIA_ESTILO[convocatoria.estado]}>
                {ESTADO_CONVOCATORIA_LABEL[convocatoria.estado]}
              </Badge>
              {dias >= 0 && dias < 15 && (
                <Badge className="bg-gold-50 text-gold-700 ring-gold-200">
                  Cierra en {dias} {dias === 1 ? "día" : "días"}
                </Badge>
              )}
            </div>
            <h3 className="mt-2 font-display text-base font-semibold text-ink">{convocatoria.nombre}</h3>
            <p className="text-sm text-ink-soft">{convocatoria.entidadConvocante}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-display text-lg font-bold ${colorCompatibilidad(porcentaje)}`}>{porcentaje}% compatible</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line-soft pt-4 sm:grid-cols-5">
        {criterios.map((c) => (
          <Criterio key={c.clave} c={c} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-faint">
        <span className="flex items-center gap-1">
          <Wallet className="h-3.5 w-3.5" />
          <span className="font-tabular">{formatRangoCOP(convocatoria.montoMin, convocatoria.montoMax)}</span>
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {textoCobertura(convocatoria)}
        </span>
      </div>
    </Link>
  );
}

function Volver() {
  return (
    <Link
      href="/proyectos"
      className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
    >
      <ArrowLeft className="h-4 w-4" /> Volver a mis proyectos
    </Link>
  );
}

export function SugerenciasProyecto({ resultado, error }: { resultado: ResultadoSugerencias | null; error: { status: number; texto: string } | null }) {
  const { requerirAcceso } = useAccesoSuscripcion();

  if (error?.status === 402) {
    return (
      <div className="mx-auto max-w-4xl">
        <Volver />
        <EmptyState
          icon={Lock}
          titulo="Suscríbete para ver sugerencias"
          descripcion={error.texto}
          accion={
            <Button variant="primary" onClick={() => requerirAcceso("ver sugerencias de convocatorias")}>
              Ver planes
            </Button>
          }
        />
      </div>
    );
  }

  if (!resultado) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{error?.status === 404 || !error ? "No encontramos este proyecto." : error.texto}</p>
        <Link href="/proyectos" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
          Volver a mis proyectos
        </Link>
      </div>
    );
  }

  const { proyecto, sugerencias, cercanas, evaluadas, faltan } = resultado;

  return (
    <div className="mx-auto max-w-4xl">
      <Volver />

      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold-700">
          <Sparkles className="h-3.5 w-3.5" /> Sugerencias para
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">{proyecto.nombre}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Comparamos las categorías, el monto y el departamento de tu proyecto contra cada convocatoria vigente.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
          <Info className="h-3.5 w-3.5" /> Cálculo por coincidencia de criterios, no es una predicción de éxito.
        </p>
      </div>

      {sugerencias.length === 0 ? (
        <>
          <SinCoincidencias proyectoId={proyecto.id} faltan={faltan} evaluadas={evaluadas} />
          {cercanas.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-base font-semibold text-ink">Las vigentes más cercanas</h2>
              <p className="mb-4 mt-1 text-sm text-ink-soft">
                Ninguna coincide todavía; el desglose muestra en qué criterio falla cada una.
              </p>
              <div className="space-y-4">
                {cercanas.map((s) => (
                  <TarjetaSugerencia key={s.convocatoria.id} s={s} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {sugerencias.map((s) => (
            <TarjetaSugerencia key={s.convocatoria.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
