"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import type { DocumentoAdmin, TipoDocumento } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { TIPO_DOCUMENTO_LABEL } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/identidad/Campo";

/**
 * CU-03 · Adjuntos de una convocatoria en el editor del panel (RF-07).
 *
 * El archivo va del navegador a Storage por una URL firmada que emite el
 * servidor; por aquí no pasa (docs/05 §9.14). Lo que se valida en esta pantalla
 * —extensión y tamaño— lo vuelve a validar el servidor y lo repite el propio
 * bucket, así que no es la barrera, solo el aviso temprano (RNF-18, RNF-20).
 */

const BUCKET = "documentos-convocatorias";
const TAMANO_MAXIMO = 20 * 1024 * 1024;
const EXTENSIONES = ["pdf", "doc", "docx", "xls", "xlsx", "zip"];
const ACEPTADOS = EXTENSIONES.map((e) => `.${e}`).join(",");
const TIPOS: TipoDocumento[] = ["TDR", "terminos", "anexo", "formato"];

const extensionDe = (nombre: string) => {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto + 1).toLowerCase();
};

const sinExtension = (nombre: string) => {
  const punto = nombre.lastIndexOf(".");
  return punto <= 0 ? nombre : nombre.slice(0, punto);
};

function tamanoLegible(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentosConvocatoria({
  convocatoriaId,
  documentos: iniciales,
}: {
  convocatoriaId: string;
  documentos: DocumentoAdmin[];
}) {
  const [documentos, setDocumentos] = useState(iniciales);
  const [tipo, setTipo] = useState<TipoDocumento>("TDR");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const base = `/api/admin/convocatorias/${convocatoriaId}/documentos`;

  const subir = async (archivo: File) => {
    setError(null);
    const extension = extensionDe(archivo.name);
    if (!EXTENSIONES.includes(extension)) {
      setError(`Formato no admitido. Se aceptan ${EXTENSIONES.join(", ")}.`);
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      setError("El archivo supera los 20 MB permitidos.");
      return;
    }

    setSubiendo(true);
    const nombre = sinExtension(archivo.name).slice(0, 200);

    // Paso 1: el servidor decide la ruta y firma la subida.
    const firma = await peticionAdmin<{ documentoId: string; ruta: string; token: string }>(`${base}/subida`, "POST", {
      nombre,
      tipo,
      extension,
      tamanoBytes: archivo.size,
    });
    if (!firma.ok) {
      setSubiendo(false);
      setError(firma.error);
      return;
    }

    // Paso 2: el archivo va directo al bucket.
    const supabase = crearClienteNavegador();
    const { error: eSubida } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(firma.datos.ruta, firma.datos.token, archivo, { contentType: archivo.type });
    if (eSubida) {
      setSubiendo(false);
      setError("No pudimos subir el archivo. Revisa su tamaño y su formato e inténtalo otra vez.");
      return;
    }

    // Paso 3: el servidor registra la fila con el tamaño y el tipo reales.
    const registro = await peticionAdmin<DocumentoAdmin>(base, "POST", {
      documentoId: firma.datos.documentoId,
      nombre,
      tipo,
      extension,
    });
    setSubiendo(false);
    if (!registro.ok) {
      setError(registro.error);
      return;
    }
    setDocumentos((prev) => [...prev, registro.datos]);
    if (entrada.current) entrada.current.value = "";
  };

  const renombrar = async (doc: DocumentoAdmin) => {
    const nombre = window.prompt("Nombre descriptivo del documento", doc.nombre);
    if (nombre === null || nombre.trim() === doc.nombre) return;
    setError(null);
    setOcupado(doc.id);
    const r = await peticionAdmin<DocumentoAdmin>(`${base}/${doc.id}`, "PATCH", { nombre });
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? r.datos : d)));
  };

  const cambiarTipo = async (doc: DocumentoAdmin, nuevo: TipoDocumento) => {
    setError(null);
    setOcupado(doc.id);
    const r = await peticionAdmin<DocumentoAdmin>(`${base}/${doc.id}`, "PATCH", { tipo: nuevo });
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? r.datos : d)));
  };

  const quitar = async (doc: DocumentoAdmin) => {
    if (!window.confirm(`¿Quitar "${doc.nombre}"? El archivo se borra y no se puede recuperar.`)) return;
    setError(null);
    setOcupado(doc.id);
    const respuesta = await fetch(`${base}/${doc.id}`, { method: "DELETE" });
    setOcupado(null);
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(() => ({}));
      setError(json.error ?? "No pudimos quitar el documento. Intenta de nuevo.");
      return;
    }
    setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
  };

  // RNF-16: el enlace se pide en el momento y vive 15 minutos.
  const descargar = async (doc: DocumentoAdmin) => {
    setError(null);
    setOcupado(doc.id);
    const respuesta = await fetch(`${base}/${doc.id}/enlace`);
    const json = await respuesta.json().catch(() => ({}));
    setOcupado(null);
    if (!respuesta.ok) {
      setError(json.error ?? "No pudimos preparar la descarga. Intenta de nuevo.");
      return;
    }
    window.open(json.datos.url as string, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      {documentos.length === 0 ? (
        <p className="mb-4 text-sm text-ink-faint">
          Aún no hay documentos adjuntos. Sube los términos de referencia, los anexos y los formatos que publique la
          entidad.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {documentos.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line-soft px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-40 flex-1">
                <p className="truncate text-sm font-medium text-ink">{doc.nombre}</p>
                <p className="font-tabular text-xs text-ink-faint">{tamanoLegible(doc.tamanoBytes)}</p>
              </div>
              <select
                value={doc.tipo}
                onChange={(e) => cambiarTipo(doc, e.target.value as TipoDocumento)}
                disabled={ocupado === doc.id}
                aria-label={`Tipo de ${doc.nombre}`}
                className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-primary-500"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_DOCUMENTO_LABEL[t]}
                  </option>
                ))}
              </select>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => descargar(doc)}
                  disabled={ocupado === doc.id}
                  aria-label={`Descargar ${doc.nombre}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => renombrar(doc)}
                  disabled={ocupado === doc.id}
                  aria-label={`Renombrar ${doc.nombre}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => quitar(doc)}
                  disabled={ocupado === doc.id}
                  className="text-danger hover:bg-danger-bg"
                  aria-label={`Quitar ${doc.nombre}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-line px-3 py-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Tipo de documento
          </span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDocumento)}
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={entrada}
          type="file"
          accept={ACEPTADOS}
          disabled={subiendo}
          aria-label="Archivo para adjuntar"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) void subir(archivo);
          }}
          className="hidden"
        />
        <Button variant="secondary" onClick={() => entrada.current?.click()} disabled={subiendo}>
          {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {subiendo ? "Subiendo…" : "Adjuntar documento"}
        </Button>
        <p className="text-xs text-ink-faint">PDF, Word, Excel o ZIP · hasta 20 MB</p>
      </div>
    </div>
  );
}
