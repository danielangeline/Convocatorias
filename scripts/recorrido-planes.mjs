// Cuentas temporales para el recorrido en pantalla de los planes (sesión 042 ·
// RN-11, RN-16, RN-41, RF-120). Las usa Playwright contra localhost, en un
// navegador aparte; nunca la sesión del Product Owner.
//
//   node --env-file=.env.local scripts/recorrido-planes.mjs crear <archivo.json>
//   node --env-file=.env.local scripts/recorrido-planes.mjs borrar <archivo.json>
//
// `crear` deja cuatro empresas: Gratis (como nace), Esencial, Pro y una Pro
// vencida hace 10 días con una postulación y un encargo (su plan efectivo ya es
// Gratis), más una consultora aprobada. Escribe correos y clave en el archivo
// (fuera del repositorio). `borrar` lo deshace todo.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [accion, archivo] = process.argv.slice(2);
if (!archivo || !["crear", "borrar"].includes(accion)) {
  console.error("Uso: recorrido-planes.mjs crear|borrar <archivo.json>");
  process.exit(2);
}
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const masDias = (n) => new Date(Date.parse(hoy + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

async function borrar(datos) {
  for (const id of datos.cuentas ?? []) {
    await svc.from("encargos").delete().eq("empresa_id", id);
    await svc.from("postulaciones").delete().eq("usuario_id", id);
    await svc.from("proyectos").delete().eq("usuario_id", id);
    const { error } = await svc.auth.admin.deleteUser(id);
    console.log(error ? `No se pudo borrar ${id}: ${error.message}` : `Borrada ${id}`);
  }
}

if (accion === "borrar") {
  await borrar(JSON.parse(fs.readFileSync(archivo, "utf8")));
  process.exit(0);
}

const sufijo = crypto.randomBytes(3).toString("hex");
const clave = `Rec-${crypto.randomBytes(12).toString("base64url")}`;
const datos = { sufijo, clave, cuentas: [], correos: {} };
const { data: planes } = await svc.from("planes").select("id, nombre").eq("rol", "empresa");
const plan = (n) => planes.find((p) => p.nombre === n).id;

try {
  const crear = async (clave_, rol, nombre, nombreEmpresa) => {
    const correo = `${clave_}.recorrido.${sufijo}@example.com`;
    const { data, error } = await svc.auth.admin.createUser({
      email: correo, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, nombre_empresa: nombreEmpresa, consentimiento_datos: true },
    });
    if (error) throw error;
    datos.cuentas.push(data.user.id);
    datos.correos[clave_] = correo;
    // El recorrido de bienvenida no tapa la pantalla (RF-119).
    await svc.from("perfiles").update({ recorrido_visto_at: new Date().toISOString() }).eq("id", data.user.id);
    return data.user.id;
  };
  const activar = (id, nombrePlan, vence) =>
    svc.from("suscripciones").update({ plan_id: plan(nombrePlan), modalidad: "mensual", estado: "activa", fecha_inicio: masDias(-20), fecha_vencimiento: vence }).eq("usuario_id", id);

  await crear("gratis", "empresa", "Gabriela Gratis", `Gratis Recorrido ${sufijo}`);
  const e = await crear("esencial", "empresa", "Esteban Esencial", `Esencial Recorrido ${sufijo}`);
  const p = await crear("pro", "empresa", "Paula Pro", `Pro Recorrido ${sufijo}`);
  const v = await crear("vencida", "empresa", "Víctor Vencido", `Vencida Recorrido ${sufijo}`);
  const c = await crear("consultora", "consultor", `Consultora Recorrido ${sufijo}`);
  await svc.from("consultor_perfiles").update({
    nombre_profesional: `Consultora Recorrido ${sufijo}`, descripcion: "Formulo proyectos de energía", foto_path: `${c}/f.png`, cv_path: `${c}/cv.pdf`, estado_perfil: "aprobado",
  }).eq("id", c);
  await activar(e, "Empresa Esencial", masDias(30));
  await activar(p, "Empresa Pro", masDias(30));

  // La empresa vencida: tuvo Pro, postuló y encargó; hace 10 días que venció.
  const { data: conv } = await svc.from("convocatorias").select("id, nombre").eq("estado", "publicada").gte("fecha_cierre", masDias(15))
    .eq("todos_los_paises", true).limit(1).single();
  const { data: proy } = await svc.from("proyectos").insert({ usuario_id: v, nombre: `Paneles solares ${sufijo}`, problema: "Energía cara en fincas" }).select("id").single();
  await activar(v, "Empresa Pro", masDias(30));
  const { error: ePost } = await svc.from("postulaciones").insert({ usuario_id: v, convocatoria_id: conv.id, proyecto_id: proy.id });
  if (ePost) throw ePost;
  const { data: enc, error: eEnc } = await svc.from("encargos").insert({
    proyecto_id: proy.id, empresa_id: v, consultor_id: c, titulo_tarea: "Revisar el presupuesto", via: "directorio", estado: "pendiente", tipo_ayuda: "buscar_convocatoria",
  }).select("id").single();
  if (eEnc) throw eEnc;
  await svc.from("encargos").update({ estado: "en_curso" }).eq("id", enc.id);
  await svc.from("suscripciones").update({ fecha_inicio: masDias(-40), fecha_vencimiento: masDias(-10) }).eq("usuario_id", v);
  datos.convocatoria = conv.nombre;

  fs.writeFileSync(archivo, JSON.stringify(datos, null, 2));
  console.log(`Listo: ${datos.cuentas.length} cuentas (${sufijo}). Datos en ${archivo}`);
} catch (err) {
  console.error("Falló la preparación; se borra lo creado.", err);
  await borrar(datos);
  process.exit(1);
}
