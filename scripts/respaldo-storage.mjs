// Copia de los archivos de Storage (RNF-10: "copia de BD y archivos").
//
//   node --env-file=.env.local scripts/respaldo-storage.mjs <carpeta>
//
// La llama scripts/respaldo-bd.sh. Recorre todos los buckets con la clave de
// servicio (solo servidor, RNF-26), descarga cada objeto conservando su ruta y
// escribe un manifiesto con tamaño y SHA-256 para comprobar la copia.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const destino = process.argv[2];
if (!destino) throw new Error("Falta la carpeta de destino");
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function listar(bucket, prefijo = "") {
  const rutas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await svc.storage.from(bucket).list(prefijo, { limit: 1000, offset: desde });
    if (error) throw error;
    for (const e of data) {
      const ruta = prefijo ? `${prefijo}/${e.name}` : e.name;
      // Una carpeta no tiene id; un objeto sí.
      if (e.id) rutas.push(ruta);
      else rutas.push(...(await listar(bucket, ruta)));
    }
    if (data.length < 1000) return rutas;
  }
}

const { data: buckets, error } = await svc.storage.listBuckets();
if (error) throw error;
const manifiesto = [];
for (const b of buckets) {
  const rutas = await listar(b.id);
  for (const ruta of rutas) {
    const { data, error: e } = await svc.storage.from(b.id).download(ruta);
    if (e) throw new Error(`${b.id}/${ruta}: ${e.message}`);
    const bytes = Buffer.from(await data.arrayBuffer());
    const archivo = path.join(destino, b.id, ruta);
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, bytes);
    manifiesto.push({ bucket: b.id, ruta, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
  }
  console.log(`  storage/${b.id}: ${rutas.length} archivo(s)`);
}
fs.mkdirSync(destino, { recursive: true });
fs.writeFileSync(path.join(destino, "manifiesto.json"), JSON.stringify(manifiesto, null, 2));
