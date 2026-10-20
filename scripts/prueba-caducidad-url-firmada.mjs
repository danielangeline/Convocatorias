// RNF-16: una URL firmada de Storage deja de servir a los 15 minutos
// (sesión 028). Firma un adjunto existente con la misma vida que usa la app
// (900 s), lo descarga ahora, espera 16 minutos y lo vuelve a pedir.
//
//   node --env-file=.env.local scripts/prueba-caducidad-url-firmada.mjs
import { createClient } from "@supabase/supabase-js";

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = "documentos-convocatorias";
let fallas = 0;
const ok = (c, d) => { console.log(c ? "ok   " : "FALLA", d); if (!c) fallas++; };

const { data: carpetas } = await svc.storage.from(BUCKET).list("", { limit: 20 });
let ruta = null;
for (const c of carpetas ?? []) {
  const { data: archivos } = await svc.storage.from(BUCKET).list(c.name, { limit: 5 });
  const a = archivos?.find((x) => x.id);
  if (a) { ruta = `${c.name}/${a.name}`; break; }
}
if (!ruta) { console.log("FALLA no hay ningún adjunto para firmar"); process.exit(1); }

const { data, error } = await svc.storage.from(BUCKET).createSignedUrl(ruta, 900);
if (error) throw error;
const token = new URL(data.signedUrl).searchParams.get("token");
const carga = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
ok(carga.exp - carga.iat === 900, `exp − iat = ${carga.exp - carga.iat} s`);
const antes = await fetch(data.signedUrl);
ok(antes.status === 200, `recién firmada → ${antes.status}`);

console.log(`Esperando 16 minutos (${new Date().toLocaleTimeString("es-CO")})…`);
await new Promise((r) => setTimeout(r, 16 * 60 * 1000));
const despues = await fetch(data.signedUrl);
ok(despues.status >= 400, `a los 16 minutos → ${despues.status}`);
console.log(fallas ? `${fallas} FALLAS` : "TODO PASA");
process.exit(fallas ? 1 : 0);
