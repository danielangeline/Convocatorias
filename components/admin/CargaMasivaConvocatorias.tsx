"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import type { CategoriaAdmin, FuenteAdmin, TipoCategoria } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { COLUMNAS_CARGA, MAXIMO_FILAS, plantillaCsv, type FilaCarga, type ResultadoCarga } from "@/lib/admin/carga-masiva";
import { Badge, type TonoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Aviso } from "@/components/identidad/Campo";

const TIPO_CATEGORIA: Record<TipoCategoria, string> = {
  tipo_proyecto: "Tipo de proyecto",
  sector: "Sector",
  tipo_entidad: "Quién puede postular",
};

const ESTADO_FILA: Record<FilaCarga["estado"], { etiqueta: string; tono: TonoBadge }> = {
  valida: { etiqueta: "Lista para crear", tono: "pri" },
  creada: { etiqueta: "Creada en borrador", tono: "pri" },
  duplicada: { etiqueta: "Duplicada", tono: "amber" },
  error: { etiqueta: "Con errores", tono: "rose" },
  fallo: { etiqueta: "No se creó", tono: "rose" },
};

/**
 * Excel en español guarda «CSV UTF-8» o «CSV (delimitado por comas)», que es
 * Windows-1252: se intenta UTF-8 estricto y, si no lo es, Windows-1252.
 */
async function leerTexto(archivo: File): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return { ok: false, error: "Ese archivo es un libro de Excel (.xlsx). En Excel: Archivo › Guardar como › «CSV UTF-8 (delimitado por comas)», y sube ese." };
  }
  try {
    return { ok: true, texto: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: true, texto: new TextDecoder("windows-1252").decode(bytes) };
  }
}

function descargarPlantilla() {
  const url = URL.createObjectURL(new Blob([plantillaCsv()], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "plantilla-convocatorias.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * CU-50, RF-118 · Carga masiva desde un CSV. La pantalla no valida nada por su
 * cuenta (RNF-20): sube el texto, el servidor responde fila por fila y, al
 * confirmar, vuelve a validar y crea en borrador. Nunca publica.
 */
export function CargaMasivaConvocatorias({
  abierto,
  onCerrar,
  fuentesActivas,
  categorias,
}: {
  abierto: boolean;
  onCerrar: () => void;
  fuentesActivas: FuenteAdmin[];
  categorias: CategoriaAdmin[];
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<{ nombre: string; texto: string } | null>(null);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const reiniciar = useCallback(() => {
    setArchivo(null);
    setResultado(null);
    setError(null);
    if (entrada.current) entrada.current.value = "";
  }, []);

  // Estable: el Drawer devuelve el foco cada vez que cambia `onCerrar`.
  const cerrar = useCallback(() => {
    reiniciar();
    onCerrar();
  }, [reiniciar, onCerrar]);

  const enviar = async (texto: string, confirmar: boolean) => {
    setOcupado(true);
    setError(null);
    const r = await peticionAdmin<ResultadoCarga>("/api/admin/convocatorias/carga-masiva", "POST", { csv: texto, confirmar });
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      setResultado(null);
      return;
    }
    setResultado(r.datos);
    if (confirmar && r.datos.creadas > 0) router.refresh();
  };

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegido = e.target.files?.[0];
    if (!elegido) return;
    setResultado(null);
    const leido = await leerTexto(elegido);
    if (!leido.ok) {
      setArchivo(null);
      setError(leido.error);
      return;
    }
    setArchivo({ nombre: elegido.name, texto: leido.texto });
    await enviar(leido.texto, false);
  };

  const cuenta = (estados: FilaCarga["estado"][]) => resultado?.filas.filter((f) => estados.includes(f.estado)).length ?? 0;
  const activas = categorias.filter((c) => c.activa);
  const terminado = resultado?.confirmado === true;

  const pie = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {terminado ? (
        <>
          <Button variant="ghost" onClick={reiniciar}>
            Cargar otro archivo
          </Button>
          <Button variant="primary" onClick={cerrar}>
            Listo
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={ocupado || !archivo || !resultado || resultado.validas === 0}
            onClick={() => archivo && enviar(archivo.texto, true)}
          >
            {ocupado && resultado
              ? "Creando…"
              : resultado
                ? `Crear ${resultado.validas} ${resultado.validas === 1 ? "borrador" : "borradores"}`
                : "Crear borradores"}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <Drawer abierto={abierto} onCerrar={cerrar} titulo="Carga masiva de convocatorias" ancho={760} pie={pie}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-1 text-sm font-extrabold text-ink">1. Descarga la plantilla y llénala</h3>
          <p className="mb-3 text-sm text-ink-2">
            Una fila por convocatoria y una columna por cada campo de la ficha. Ábrela en Excel, borra la fila de ejemplo y
            guárdala como <strong>CSV UTF-8</strong>. Hasta {MAXIMO_FILAS} filas por archivo. Todo queda en{" "}
            <strong>borrador</strong>: los documentos se adjuntan y cada una se publica desde su editor.
          </p>
          <Button variant="secondary" onClick={descargarPlantilla}>
            <Download className="h-4 w-4" /> Descargar plantilla (.csv)
          </Button>

          <details className="mt-4 rounded-xl border border-line">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-ink">Guía de columnas</summary>
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full table-fixed text-left text-[13px] sm:table-auto">
                <colgroup>
                  <col className="w-[42%] sm:w-auto" />
                  <col />
                </colgroup>
                <thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Columna</th>
                    <th className="px-4 py-2 font-semibold">Qué va</th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMNAS_CARGA.map((c) => (
                    <tr key={c.clave} className="border-t border-line align-top">
                      <td className="break-all px-4 py-2 font-mono text-[12px] text-ink sm:whitespace-nowrap sm:break-normal">
                        {c.clave}
                        {c.obligatoria && <span className="text-rose-ink"> *</span>}
                      </td>
                      <td className="px-4 py-2 text-ink-2">{c.guia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-2 text-xs text-ink-3">
              * Obligatoria. Si Excel muestra un monto grande como 5E+10, dale formato de número o escríbelo con puntos de
              miles antes de guardar.
            </p>
          </details>

          <details className="mt-3 rounded-xl border border-line">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-ink">Fuentes y categorías válidas</summary>
            <div className="space-y-4 border-t border-line px-4 py-3 text-[13px] text-ink-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Fuentes activas</p>
                {fuentesActivas.length === 0 ? (
                  <p>
                    No hay ninguna.{" "}
                    <Link href="/admin/fuentes" className="font-semibold text-pri-text hover:underline">
                      Registra una fuente
                    </Link>{" "}
                    antes de cargar.
                  </p>
                ) : (
                  <p>{fuentesActivas.map((f) => f.nombre).join(" · ")}</p>
                )}
              </div>
              {(Object.keys(TIPO_CATEGORIA) as TipoCategoria[]).map((tipo) => {
                const nombres = activas.filter((c) => c.tipo === tipo).map((c) => c.nombre);
                return (
                  <div key={tipo}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{TIPO_CATEGORIA[tipo]}</p>
                    <p>{nombres.length > 0 ? nombres.join(" · ") : "Ninguna activa."}</p>
                  </div>
                );
              })}
            </div>
          </details>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-extrabold text-ink">2. Sube el archivo y revisa</h3>
          <p className="mb-3 text-sm text-ink-2">Antes de crear nada te mostramos qué filas están bien y qué le falta a cada una.</p>
          <input ref={entrada} type="file" accept=".csv,text/csv" onChange={alElegir} className="sr-only" id="archivo-carga" disabled={ocupado} />
          <label
            htmlFor="archivo-carga"
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line px-4 py-4 text-sm text-ink-2 hover:bg-surface-2"
          >
            {archivo ? <FileSpreadsheet className="h-5 w-5 text-pri-text" /> : <Upload className="h-5 w-5 text-ink-3" />}
            <span className="min-w-0 flex-1 truncate">
              {archivo ? archivo.nombre : "Elige el archivo CSV"}
              {ocupado && !resultado && " · revisando…"}
            </span>
            <span className="font-semibold text-pri-text">{archivo ? "Cambiar" : "Elegir"}</span>
          </label>
        </section>

        {error && <Aviso tipo="error">{error}</Aviso>}

        {resultado && (
          <section>
            <h3 className="mb-3 text-sm font-extrabold text-ink">{terminado ? "3. Resultado" : "Vista previa"}</h3>
            {terminado ? (
              <Aviso tipo={resultado.creadas > 0 ? "exito" : "advertencia"}>
                {resultado.creadas === 1
                  ? "Se creó 1 convocatoria en borrador."
                  : `Se crearon ${resultado.creadas} convocatorias en borrador.`}{" "}
                Ábrelas para adjuntar el documento oficial y publicarlas.
              </Aviso>
            ) : (
              <div className="mb-1 flex flex-wrap gap-2">
                <Badge tono="pri">{resultado.validas} listas para crear</Badge>
                {cuenta(["error"]) > 0 && <Badge tono="rose">{cuenta(["error"])} con errores</Badge>}
                {cuenta(["duplicada"]) > 0 && <Badge tono="amber">{cuenta(["duplicada"])} duplicadas</Badge>}
              </div>
            )}
            {!terminado && resultado.validas < resultado.filas.length && (
              <p className="mt-2 text-xs text-ink-3">
                Solo se crean las filas listas. Corrige las demás en el archivo y vuelve a subirlo: las que ya se crearon
                saldrán como duplicadas y no se repiten.
              </p>
            )}

            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {resultado.filas.map((f) => (
                <li key={f.numero} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs text-ink-3">Fila {f.numero}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {f.id ? (
                        <Link href={`/admin/convocatorias/${f.id}`} className="hover:text-pri-text hover:underline">
                          {f.nombre || "(sin nombre)"}
                        </Link>
                      ) : (
                        f.nombre || "(sin nombre)"
                      )}
                    </span>
                    <Badge tono={ESTADO_FILA[f.estado].tono}>{ESTADO_FILA[f.estado].etiqueta}</Badge>
                  </div>
                  {f.errores.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
                      {f.errores.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  );
}
