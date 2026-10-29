"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Upload, FileSpreadsheet, FileText, Files, Check, X, Link2, Paperclip, Plus } from "lucide-react";
import type { CategoriaAdmin, DocumentoAdmin, FuenteAdmin, TipoCategoria, TipoDocumento } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import {
  COLUMNAS_CARGA,
  MAXIMO_FILAS,
  plantillaCsv,
  type DocumentoCarga,
  type FilaCarga,
  type ResultadoCarga,
} from "@/lib/admin/carga-masiva";
import {
  EXTENSIONES_ADJUNTO,
  TAMANO_MAXIMO_ADJUNTO,
  TIPOS_ADJUNTO,
  extensionDe,
  subirAdjunto,
} from "@/lib/admin/subir-adjunto";
import { TIPO_DOCUMENTO_LABEL, cn } from "@/lib/utils";
import { Badge, type TonoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Aviso } from "@/components/identidad/Campo";

const TIPO_CATEGORIA: Record<TipoCategoria, string> = {
  tipo_proyecto: "Tipo de proyecto",
  sector: "Sector",
  tipo_entidad: "Quién puede postular",
};

const ACEPTADOS = EXTENSIONES_ADJUNTO.map((e) => `.${e}`).join(",");

/** Documento arrastrado a una fila en la vista previa (RF-118, sesión 036). */
type Manual = { clave: string; archivo: File; tipo: TipoDocumento };

/** Cómo terminó la subida de cada documento, por fila (CU-50 5b, 5c). */
type Subida = { clave: string; ok: boolean; error?: string };

const ESTADO_FILA: Record<FilaCarga["estado"], { etiqueta: string; tono: TonoBadge }> = {
  valida: { etiqueta: "Lista para crear", tono: "pri" },
  creada: { etiqueta: "Creada en borrador", tono: "pri" },
  duplicada: { etiqueta: "Duplicada", tono: "amber" },
  error: { etiqueta: "Con errores", tono: "rose" },
  fallo: { etiqueta: "No se creó", tono: "rose" },
};

const claveDe = (d: DocumentoCarga) => (d.enlace !== undefined ? `enlace:${d.enlace}` : `archivo:${d.archivo.toLowerCase()}`);

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

const tamanoLegible = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Ícono del estado de un documento: pendiente, adjunto o fallido. */
function EstadoDoc({ subida, icono: Icono }: { subida?: Subida; icono: typeof FileText }) {
  if (subida?.ok) return <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pri-text" aria-label="Adjunto" />;
  if (subida) return <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-ink" aria-label="No se adjuntó" />;
  return <Icono className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />;
}

/**
 * Recuadro de una fila lista para arrastrar o elegir sus documentos sin
 * nombrarlos en el CSV. Avisa de formato y tamaño antes de aceptar uno; el
 * servidor y el bucket lo vuelven a comprobar al subirlo (RNF-18, RNF-20).
 */
function ZonaDocumentos({
  numero,
  manuales,
  onCambio,
}: {
  numero: number;
  manuales: Manual[];
  onCambio: (siguientes: Manual[]) => void;
}) {
  const [encima, setEncima] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const agregar = (lista: FileList | null) => {
    const nuevos: Manual[] = [];
    const rechazados: string[] = [];
    for (const archivo of Array.from(lista ?? [])) {
      if (!EXTENSIONES_ADJUNTO.includes(extensionDe(archivo.name))) rechazados.push(`${archivo.name} (formato)`);
      else if (archivo.size > TAMANO_MAXIMO_ADJUNTO) rechazados.push(`${archivo.name} (más de 20 MB)`);
      else if (![...manuales, ...nuevos].some((m) => m.archivo.name === archivo.name && m.archivo.size === archivo.size)) {
        nuevos.push({ clave: `manual:${numero}:${archivo.name}:${archivo.size}`, archivo, tipo: "TDR" });
      }
    }
    setAviso(rechazados.length > 0 ? `No se agregaron: ${rechazados.join(", ")}. Se aceptan PDF, Word, Excel o ZIP de hasta 20 MB.` : null);
    if (nuevos.length > 0) onCambio([...manuales, ...nuevos]);
    if (entrada.current) entrada.current.value = "";
  };

  const id = `zona-${numero}`;
  return (
    <div className="mt-2">
      {manuales.length > 0 && (
        <ul className="mb-2 space-y-1.5 text-[13px] text-ink-2">
          {manuales.map((m) => (
            <li key={m.clave} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-3" />
              <span className="min-w-[8rem] flex-1 [overflow-wrap:anywhere]">{m.archivo.name}</span>
              <select
                value={m.tipo}
                onChange={(e) => onCambio(manuales.map((x) => (x.clave === m.clave ? { ...x, tipo: e.target.value as TipoDocumento } : x)))}
                aria-label={`Tipo de ${m.archivo.name}`}
                className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
              >
                {TIPOS_ADJUNTO.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_DOCUMENTO_LABEL[t]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onCambio(manuales.filter((x) => x.clave !== m.clave))}
                aria-label={`Quitar ${m.archivo.name}`}
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={entrada} id={id} type="file" multiple accept={ACEPTADOS} className="sr-only" onChange={(e) => agregar(e.target.files)} />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          agregar(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-ink-3 hover:bg-surface-2",
          encima ? "border-pri bg-pri-soft text-pri-text" : "border-line"
        )}
      >
        <Upload className="h-3.5 w-3.5" /> Arrastra aquí los documentos de esta convocatoria o <span className="font-semibold text-pri-text">elígelos</span>
      </label>
      {aviso && <p className="mt-1 text-xs text-rose-ink">{aviso}</p>}
    </div>
  );
}

const textoFilas = (filas: number[]) =>
  filas.length === 1 ? `fila ${filas[0]}` : `filas ${filas.slice(0, -1).join(", ")} y ${filas[filas.length - 1]}`;

/**
 * CU-50 4d · Una fuente que el archivo nombra y no existe, con «Registrar
 * fuente». Crea con el mismo endpoint de Fuentes (RF-04), que valida todo;
 * al terminar, quien llama vuelve a revisar el archivo.
 */
function FuenteNueva({ nombre, filas, onRegistrada }: { nombre: string; filas: number[]; onRegistrada: () => Promise<void> }) {
  const [tipoEntidad, setTipoEntidad] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const registrar = async () => {
    setOcupado(true);
    setError(null);
    const r = await peticionAdmin("/api/admin/fuentes", "POST", { nombre, tipoEntidad, url, activa: true });
    if (!r.ok) {
      setOcupado(false);
      setError(r.error);
      return;
    }
    await onRegistrada();
  };

  const campo = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-pri";
  return (
    <li className="px-4 py-3">
      <p className="text-sm text-ink">
        <strong>{nombre}</strong> <span className="text-ink-3">· {textoFilas(filas)}</span>
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          value={tipoEntidad}
          onChange={(e) => setTipoEntidad(e.target.value)}
          placeholder="Tipo de entidad (opcional)"
          aria-label={`Tipo de entidad de ${nombre}`}
          maxLength={100}
          className={campo}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Sitio web (opcional)"
          aria-label={`Sitio web de ${nombre}`}
          maxLength={2000}
          className={campo}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onClick={registrar} disabled={ocupado}>
          <Plus className="h-3.5 w-3.5" /> {ocupado ? "Registrando…" : "Registrar fuente"}
        </Button>
        {error && <span className="text-xs text-rose-ink">{error}</span>}
      </div>
    </li>
  );
}

/**
 * CU-50, RF-118 · Carga masiva desde un CSV, con sus documentos: por enlace
 * (los descarga el servidor, RNF-37), por nombre de archivo elegido junto al
 * CSV, o arrastrados a cada fila en la vista previa. La pantalla no valida nada
 * por su cuenta (RNF-20): manda el texto y el nombre y tamaño de los archivos
 * elegidos, el servidor responde fila por fila y, al confirmar, vuelve a validar
 * y crea en borrador. Después cada documento se adjunta a su borrador por el
 * camino del editor (RF-07). Nunca publica.
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
  const entradaDocs = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<{ nombre: string; texto: string } | null>(null);
  const [documentos, setDocumentos] = useState<File[]>([]);
  const [manuales, setManuales] = useState<Record<number, Manual[]>>({});
  const [subidas, setSubidas] = useState<Record<number, Subida[]>>({});
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const reiniciar = useCallback(() => {
    setArchivo(null);
    setDocumentos([]);
    setManuales({});
    setSubidas({});
    setProgreso(null);
    setResultado(null);
    setError(null);
    if (entrada.current) entrada.current.value = "";
    if (entradaDocs.current) entradaDocs.current.value = "";
  }, []);

  // Estable: el Drawer devuelve el foco cada vez que cambia `onCerrar`.
  const cerrar = useCallback(() => {
    reiniciar();
    onCerrar();
  }, [reiniciar, onCerrar]);

  /** Adjunta los documentos de las filas creadas, uno a la vez, al borrador de cada una. */
  const adjuntarDocumentos = async (filas: FilaCarga[], elegidos: File[], arrastrados: Record<number, Manual[]>) => {
    const porNombre = new Map(elegidos.map((f) => [f.name.toLowerCase(), f]));
    type Pendiente = { fila: FilaCarga; clave: string; subir: () => Promise<{ ok: true; documento: DocumentoAdmin } | { ok: false; error: string }> };
    const pendientes: Pendiente[] = [];
    for (const fila of filas) {
      if (fila.estado !== "creada" || !fila.id) continue;
      const id = fila.id;
      for (const d of fila.documentos) {
        if (d.enlace !== undefined) {
          const url = d.enlace;
          pendientes.push({
            fila,
            clave: claveDe(d),
            subir: async () => {
              const r = await peticionAdmin<DocumentoAdmin>(`/api/admin/convocatorias/${id}/documentos/desde-enlace`, "POST", { url, tipo: d.tipo });
              return r.ok ? { ok: true, documento: r.datos } : r;
            },
          });
        } else {
          const elegido = porNombre.get(d.archivo.toLowerCase());
          pendientes.push({
            fila,
            clave: claveDe(d),
            subir: () => (elegido ? subirAdjunto(id, elegido, d.tipo) : Promise.resolve({ ok: false as const, error: "El archivo ya no está elegido." })),
          });
        }
      }
      for (const m of arrastrados[fila.numero] ?? []) {
        pendientes.push({ fila, clave: m.clave, subir: () => subirAdjunto(id, m.archivo, m.tipo) });
      }
    }
    if (pendientes.length === 0) return;
    let hechos = 0;
    setProgreso({ hechos, total: pendientes.length });
    for (const { fila, clave, subir } of pendientes) {
      const r = await subir();
      const subida: Subida = r.ok ? { clave, ok: true } : { clave, ok: false, error: r.error };
      setSubidas((previas) => ({ ...previas, [fila.numero]: [...(previas[fila.numero] ?? []), subida] }));
      setProgreso({ hechos: ++hechos, total: pendientes.length });
    }
  };

  const enviar = async (texto: string, elegidos: File[], confirmar: boolean) => {
    setOcupado(true);
    setError(null);
    const r = await peticionAdmin<ResultadoCarga>("/api/admin/convocatorias/carga-masiva", "POST", {
      csv: texto,
      confirmar,
      archivos: elegidos.map((f) => ({ nombre: f.name, tamanoBytes: f.size })),
    });
    if (!r.ok) {
      setOcupado(false);
      setError(r.error);
      setResultado(null);
      return;
    }
    setResultado(r.datos);
    if (confirmar) {
      await adjuntarDocumentos(r.datos.filas, elegidos, manuales);
      if (r.datos.creadas > 0) router.refresh();
    }
    setOcupado(false);
  };

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegido = e.target.files?.[0];
    if (!elegido) return;
    setResultado(null);
    // Otro CSV, otras filas: lo arrastrado a la anterior ya no aplica.
    setManuales({});
    const leido = await leerTexto(elegido);
    if (!leido.ok) {
      setArchivo(null);
      setError(leido.error);
      return;
    }
    setArchivo({ nombre: elegido.name, texto: leido.texto });
    await enviar(leido.texto, documentos, false);
  };

  // Se pueden elegir en varias tandas: se suman, y uno con el mismo nombre reemplaza al anterior.
  const alElegirDocumentos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevos = Array.from(e.target.files ?? []);
    if (nuevos.length === 0) return;
    const nombres = new Set(nuevos.map((f) => f.name.toLowerCase()));
    const todos = [...documentos.filter((f) => !nombres.has(f.name.toLowerCase())), ...nuevos];
    setDocumentos(todos);
    if (entradaDocs.current) entradaDocs.current.value = "";
    if (archivo) await enviar(archivo.texto, todos, false);
  };

  const quitarDocumentos = async () => {
    setDocumentos([]);
    if (archivo) await enviar(archivo.texto, [], false);
  };

  const cuenta = (estados: FilaCarga["estado"][]) => resultado?.filas.filter((f) => estados.includes(f.estado)).length ?? 0;
  const activas = categorias.filter((c) => c.activa);
  const terminado = resultado?.confirmado === true;
  const docsFallidos = Object.values(subidas).flat().filter((s) => !s.ok).length;
  const tamanoDocs = documentos.reduce((suma, f) => suma + f.size, 0);
  const enlacesPorCrear =
    resultado?.filas.filter((f) => f.estado === "valida").reduce((n, f) => n + f.documentos.filter((d) => d.enlace !== undefined).length, 0) ?? 0;

  const pie = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {terminado ? (
        <>
          <Button variant="ghost" onClick={reiniciar} disabled={ocupado}>
            Cargar otro archivo
          </Button>
          <Button variant="primary" onClick={cerrar} disabled={ocupado}>
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
            onClick={() => archivo && enviar(archivo.texto, documentos, true)}
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
            guárdala como <strong>CSV UTF-8</strong>. Hasta {MAXIMO_FILAS} filas por archivo. En la columna{" "}
            <code className="font-mono text-[12px]">documentos</code> pega el <strong>enlace oficial</strong> de cada TDR o
            anexo y nosotros lo descargamos; los que no tengan enlace los arrastras a su convocatoria en el paso 2. Todo queda
            en <strong>borrador</strong>: cada una se revisa y se publica desde su editor.
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
          <h3 className="mb-1 text-sm font-extrabold text-ink">2. Sube el CSV y revisa</h3>
          <p className="mb-3 text-sm text-ink-2">
            Antes de crear nada te mostramos qué filas están bien y qué le falta a cada una. Debajo de cada convocatoria lista
            puedes arrastrar sus documentos (PDF, Word, Excel o ZIP, hasta 20 MB).
          </p>
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

          <details className="mt-3 rounded-xl border border-line" open={documentos.length > 0}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-ink">
              ¿Nombraste archivos en la columna documentos? Elígelos aquí
            </summary>
            <div className="border-t border-line px-4 py-3">
              <input
                ref={entradaDocs}
                type="file"
                multiple
                accept={ACEPTADOS}
                onChange={alElegirDocumentos}
                className="sr-only"
                id="documentos-carga"
                disabled={ocupado}
              />
              <div className="flex items-center gap-3 text-sm text-ink-2">
                <Files className={documentos.length > 0 ? "h-5 w-5 text-pri-text" : "h-5 w-5 text-ink-3"} />
                <span className="min-w-0 flex-1">
                  {documentos.length === 0
                    ? "Solo hace falta si escribiste nombres de archivo en lugar de enlaces."
                    : `${documentos.length} ${documentos.length === 1 ? "documento elegido" : "documentos elegidos"} · ${tamanoLegible(tamanoDocs)}`}
                </span>
                {documentos.length > 0 && (
                  <button
                    type="button"
                    onClick={quitarDocumentos}
                    disabled={ocupado}
                    className="cursor-pointer text-xs font-semibold text-ink-3 hover:text-ink"
                  >
                    Quitar
                  </button>
                )}
                <label htmlFor="documentos-carga" className="cursor-pointer font-semibold text-pri-text">
                  {documentos.length > 0 ? "Añadir" : "Elegir"}
                </label>
              </div>
            </div>
          </details>
        </section>

        {error && <Aviso tipo="error">{error}</Aviso>}

        {resultado && (
          <section>
            <h3 className="mb-3 text-sm font-extrabold text-ink">{terminado ? "3. Resultado" : "Vista previa"}</h3>
            {terminado ? (
              progreso && progreso.hechos < progreso.total ? (
                <Aviso tipo="advertencia">
                  Adjuntando documentos: {progreso.hechos} de {progreso.total}. Los enlaces pueden tardar unos segundos cada
                  uno. No cierres esta ventana.
                </Aviso>
              ) : (
                <Aviso tipo={resultado.creadas > 0 && docsFallidos === 0 ? "exito" : "advertencia"}>
                  {resultado.creadas === 1
                    ? "Se creó 1 convocatoria en borrador"
                    : `Se crearon ${resultado.creadas} convocatorias en borrador`}
                  {progreso ? ` con ${progreso.total - docsFallidos} de ${progreso.total} documentos adjuntos.` : "."}{" "}
                  {docsFallidos > 0
                    ? "Los documentos que no se adjuntaron están marcados abajo con el motivo: súbelos desde el editor de cada una."
                    : "Ábrelas para revisarlas y publicarlas."}
                </Aviso>
              )
            ) : (
              <div className="mb-1 flex flex-wrap gap-2">
                <Badge tono="pri">
                  {resultado.validas} {resultado.validas === 1 ? "lista" : "listas"} para crear
                </Badge>
                {cuenta(["error"]) > 0 && <Badge tono="rose">{cuenta(["error"])} con errores</Badge>}
                {cuenta(["duplicada"]) > 0 && (
                  <Badge tono="amber">
                    {cuenta(["duplicada"])} {cuenta(["duplicada"]) === 1 ? "duplicada" : "duplicadas"}
                  </Badge>
                )}
                {enlacesPorCrear > 0 && (
                  <Badge tono="neutro">
                    {enlacesPorCrear} {enlacesPorCrear === 1 ? "documento" : "documentos"} por enlace
                  </Badge>
                )}
              </div>
            )}
            {!terminado && resultado.fuentesNuevas.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber">
                <p className="px-4 pt-3 text-sm text-ink">
                  {resultado.fuentesNuevas.length === 1
                    ? "Esta fuente no está registrada. Regístrala para poder cargar sus convocatorias:"
                    : `Estas ${resultado.fuentesNuevas.length} fuentes no están registradas. Regístralas para poder cargar sus convocatorias:`}
                </p>
                <p className="px-4 pt-1 text-xs text-ink-3">
                  Revisa que el nombre esté bien escrito: una fuente no se borra. Si es otra forma de escribir una que ya
                  existe, corrígela en el CSV.
                </p>
                <ul className="mt-1 divide-y divide-line">
                  {resultado.fuentesNuevas.map((f) => (
                    <FuenteNueva
                      key={f.nombre}
                      nombre={f.nombre}
                      filas={f.filas}
                      onRegistrada={async () => {
                        router.refresh();
                        if (archivo) await enviar(archivo.texto, documentos, false);
                      }}
                    />
                  ))}
                </ul>
              </div>
            )}
            {!terminado && resultado.fuentesInactivas.length > 0 && (
              <div className="mt-3">
                <Aviso tipo="advertencia">
                  {resultado.fuentesInactivas.length === 1 ? "Esta fuente está inactiva: " : "Estas fuentes están inactivas: "}
                  {resultado.fuentesInactivas.map((f) => `${f.nombre} (${textoFilas(f.filas)})`).join(", ")}.{" "}
                  <Link href="/admin/fuentes" className="font-semibold underline">
                    Actívala en Fuentes
                  </Link>{" "}
                  y vuelve a subir el CSV.
                </Aviso>
              </div>
            )}
            {!terminado && resultado.archivosSinUsar.length > 0 && (
              <div className="mt-3">
                <Aviso tipo="advertencia">
                  {resultado.archivosSinUsar.length === 1
                    ? "Ninguna fila nombra este documento, así que no se subirá: "
                    : "Ninguna fila nombra estos documentos, así que no se subirán: "}
                  {resultado.archivosSinUsar.join(", ")}.
                </Aviso>
              </div>
            )}
            {!terminado && resultado.validas < resultado.filas.length && (
              <p className="mt-2 text-xs text-ink-3">
                Solo se crean las filas listas. Corrige las demás en el archivo y vuelve a subirlo: las que ya se crearon
                saldrán como duplicadas y no se repiten.
              </p>
            )}

            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {resultado.filas.map((f) => {
                const subidasFila = subidas[f.numero] ?? [];
                const arrastrados = manuales[f.numero] ?? [];
                return (
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

                    {(f.documentos.length > 0 || (terminado && arrastrados.length > 0)) && (
                      <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
                        {f.documentos.map((d) => {
                          const subida = subidasFila.find((s) => s.clave === claveDe(d));
                          return (
                            <li key={claveDe(d)} className="flex min-w-0 items-start gap-1.5">
                              <EstadoDoc subida={subida} icono={d.enlace !== undefined ? Link2 : FileText} />
                              <span className="min-w-0 [overflow-wrap:anywhere]">
                                {d.enlace ?? d.archivo} <span className="text-ink-3">· {TIPO_DOCUMENTO_LABEL[d.tipo]}</span>
                                {subida && !subida.ok && <span className="text-rose-ink"> — {subida.error}</span>}
                              </span>
                            </li>
                          );
                        })}
                        {terminado &&
                          f.estado === "creada" &&
                          arrastrados.map((m) => {
                            const subida = subidasFila.find((s) => s.clave === m.clave);
                            return (
                              <li key={m.clave} className="flex min-w-0 items-start gap-1.5">
                                <EstadoDoc subida={subida} icono={Paperclip} />
                                <span className="min-w-0 [overflow-wrap:anywhere]">
                                  {m.archivo.name} <span className="text-ink-3">· {TIPO_DOCUMENTO_LABEL[m.tipo]}</span>
                                  {subida && !subida.ok && <span className="text-rose-ink"> — {subida.error}</span>}
                                </span>
                              </li>
                            );
                          })}
                      </ul>
                    )}

                    {!terminado && f.estado === "valida" && (
                      <ZonaDocumentos
                        numero={f.numero}
                        manuales={arrastrados}
                        onCambio={(siguientes) => setManuales((previos) => ({ ...previos, [f.numero]: siguientes }))}
                      />
                    )}

                    {f.errores.length > 0 && (
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
                        {f.errores.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  );
}
