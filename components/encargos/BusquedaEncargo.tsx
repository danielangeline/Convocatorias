"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Compass, Info, Undo2 } from "lucide-react";
import type { Categoria, Convocatoria, EncargoDeBusqueda, PropuestaEncargo } from "@/lib/types";
import type { ResultadoSugerencias } from "@/lib/sugerencias";
import { pedir } from "@/lib/pedir";
import { cn, formatFecha, ESTADO_PROPUESTA_LABEL, ESTADO_PROPUESTA_ESTILO } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CatalogoEmpresa } from "@/components/catalogo/CatalogoEmpresa";
import { TarjetaSugerencia } from "@/components/proyectos/SugerenciasProyecto";

type Pestana = "sugerencias" | "catalogo";

/**
 * RF-91, RF-92 · Búsqueda de convocatorias desde un encargo "buscar
 * convocatoria" en curso. El servidor ya comprobó el encargo (si no, 404) y
 * leyó con la sesión del consultor las sugerencias del proyecto y el catálogo
 * vigente, que solo existe para él mientras dure el encargo (RN-33). Aquí se
 * presentan, junto con lo que ya propuso.
 */
export function BusquedaEncargo({
  encargo,
  sugerencias,
  convocatorias,
  categorias,
}: {
  encargo: EncargoDeBusqueda;
  sugerencias: ResultadoSugerencias | null;
  convocatorias: Convocatoria[];
  categorias: Categoria[];
}) {
  const [pestana, setPestana] = useState<Pestana>("sugerencias");
  const rutaFicha = (id: string) => `/consultor/encargos/${encargo.id}/convocatorias/${id}`;
  const elegida = encargo.propuestas.find((p) => p.estado === "elegida");
  const conCoincidencias = sugerencias?.sugerencias ?? [];
  const cercanas = sugerencias?.cercanas ?? [];

  return (
    <div>
      <Link
        href="/consultor/encargos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-primary-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a mis encargos
      </Link>

      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brick-600">
          <Compass className="h-3.5 w-3.5" /> Buscar convocatoria para {encargo.empresaNombre}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">{encargo.proyectoNombre}</h1>
        <p className="mt-1 text-sm font-medium text-ink-soft">{encargo.tituloTarea}</p>
        {encargo.descripcionTarea && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{encargo.descripcionTarea}</p>}
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-faint">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Abre una convocatoria y propónsela a la empresa con una nota de por qué le sirve. Ves el catálogo vigente solo
          mientras este encargo esté en curso.
        </p>
      </div>

      {elegida && (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            La empresa eligió <strong>{elegida.convocatoriaNombre}</strong>. El encargo sigue con esa convocatoria; ya no se
            admiten más propuestas, pero puedes seguir consultando el catálogo.
          </span>
        </p>
      )}

      <MisPropuestas encargoId={encargo.id} propuestas={encargo.propuestas} rutaFicha={rutaFicha} />

      <div className="mb-6 mt-8 flex gap-2 border-b border-line-soft" role="tablist">
        {(
          [
            ["sugerencias", `Sugerencias del proyecto (${conCoincidencias.length})`],
            ["catalogo", `Todo el catálogo vigente (${convocatorias.length})`],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={pestana === valor}
            onClick={() => setPestana(valor)}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
              pestana === valor ? "border-brick-500 text-brick-600" : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === "sugerencias" &&
        (!sugerencias ? (
          <EmptyState icon={AlertCircle} titulo="No pudimos calcular las sugerencias" descripcion="Recarga la página o busca en el catálogo." />
        ) : conCoincidencias.length > 0 ? (
          <div className="space-y-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-faint">
              <Info className="h-3.5 w-3.5" /> Cálculo por coincidencia de criterios del proyecto, no es una predicción de éxito.
            </p>
            {conCoincidencias.map((s) => (
              <TarjetaSugerencia key={s.convocatoria.id} s={s} href={rutaFicha(s.convocatoria.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <EmptyState
              icon={Compass}
              titulo="Ninguna convocatoria vigente coincide con el proyecto"
              descripcion={
                sugerencias.faltan.length > 0
                  ? `Al proyecto le faltan datos para comparar (${sugerencias.faltan.map((f) => f.etiqueta.toLowerCase()).join(", ")}). Busca en el catálogo completo.`
                  : "Busca en el catálogo completo: puede haber alguna que le sirva aunque no coincida en los criterios."
              }
            />
            {cercanas.map((s) => (
              <TarjetaSugerencia key={s.convocatoria.id} s={s} href={rutaFicha(s.convocatoria.id)} />
            ))}
          </div>
        ))}

      {pestana === "catalogo" && (
        <CatalogoEmpresa
          convocatorias={convocatorias}
          categorias={categorias}
          rutaFicha={rutaFicha}
          soloVigentes
          titulo="Catálogo vigente"
        />
      )}
    </div>
  );
}

/** RF-92 · Lo que el consultor ya propuso en este encargo, y retirar lo que la empresa no eligió. */
function MisPropuestas({
  encargoId,
  propuestas,
  rutaFicha,
}: {
  encargoId: string;
  propuestas: PropuestaEncargo[];
  rutaFicha: (id: string) => string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const retirar = async (p: PropuestaEncargo) => {
    if (!window.confirm(`¿Retirar la propuesta de "${p.convocatoriaNombre}"? La empresa dejará de verla como opción.`)) return;
    setError(null);
    setOcupado(p.id);
    const r = await pedir(`/api/consultor/propuestas/${p.id}/retirar`);
    setOcupado(null);
    if (!r.ok) setError(r.error);
    router.refresh();
  };

  return (
    <section aria-labelledby={`propuestas-${encargoId}`} className="rounded-2xl border border-line p-5">
      <h2 id={`propuestas-${encargoId}`} className="font-display text-base font-semibold text-ink">
        Tus propuestas ({propuestas.length})
      </h2>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {propuestas.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Todavía no has propuesto convocatorias a la empresa.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft">
          {propuestas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={ESTADO_PROPUESTA_ESTILO[p.estado]}>{ESTADO_PROPUESTA_LABEL[p.estado]}</Badge>
                  {!p.vigente && <Badge className="bg-slate-100 text-slate-500 ring-slate-200">Ya no está vigente</Badge>}
                  {p.porcentaje !== null && <span className="text-xs font-semibold text-ink-soft">{p.porcentaje}% compatible</span>}
                </div>
                {p.vigente ? (
                  <Link href={rutaFicha(p.convocatoriaId)} className="mt-1 block text-sm font-semibold text-primary-800 hover:underline">
                    {p.convocatoriaNombre}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-ink">{p.convocatoriaNombre}</p>
                )}
                <p className="text-xs text-ink-faint">
                  {p.entidad} · cierra el {formatFecha(p.fechaCierre)} · propuesta el {formatFecha(p.creada)}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{p.nota}</p>
              </div>
              {p.estado === "propuesta" && (
                <Button variant="ghost" size="sm" className="text-ink-soft" disabled={ocupado === p.id} onClick={() => retirar(p)}>
                  <Undo2 className="h-3.5 w-3.5" /> Retirar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
