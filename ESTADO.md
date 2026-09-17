# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 18 de septiembre de 2026 · cierre de la sesión 014
**Sprint:** 2 · día 8 de 30
**Rama de trabajo:** `sprint-2`, abierta desde `main` en la sesión 011 y subida a `origin` (sin fusionar a `main`: producción todavía no tiene el catálogo del panel). **Migraciones nuevas ya aplicadas al remoto:** `20260917100000_guardar_convocatoria`, `20260917200000_storage_y_adjuntos` , `20260918100000_publicar_convocatoria` y `20260918200000_nombres_normalizados_y_borrar_categorias`. No rompen `main`, que no las llama

---

## Dónde vamos

La especificación está cerrada en **v6**. **La base de datos existe en Supabase** (27 tablas con RLS, prueba cruzada pasada) y **la identidad ya es real**: registro, login, confirmación de correo y MFA del administrador con Supabase Auth. El `ModoDemo` desapareció. **Desde la sesión 011, el panel administra fuentes, categorías y convocatorias (datos y requisitos) contra Supabase**, con endpoints validados en el servidor, desde la 012 también los adjuntos, en Storage real —los 3 buckets existen, los tres privados, y todo archivo se entrega por URL firmada de 15 minutos— y **desde la 013 publica y despublica, validado en el servidor**. Con eso, el panel ya carga una convocatoria de principio a fin. Las tablas del catálogo siguen vacías: nadie ha cargado contenido real. Lo demás —el catálogo que ve la empresa, proyectos, postulaciones, documentos, encargos— sigue en datos de ejemplo de Zustand, filtrados por el `auth.uid()` real: una cuenta nueva empieza vacía y lo que crea se pierde al recargar.

## Lo último que se hizo

- **Sesión 014: tres cosas que el Product Owner encontró probando el panel** (no estaba planificada).
  1. **Desactivar una fuente no hacía nada** — no era el código: el `next dev` llevaba horas vivo y respondía **500** por caché corrupta. Con el proceso parado, `.next` borrada y el servidor de nuevo en pie, la misma petición responde 200. La fuente quedó como estaba. `.claude/launch.json` fija ahora `autoPort: false`, porque mover el puerto rompe en silencio la confirmación de correo.
  2. **`Transformación digital` y `Transformacion digital` entraban como categorías distintas.** Ahora los nombres se comparan **sin tildes, sin mayúsculas y sin espacios sobrantes**, en categorías **y en fuentes** —que no tenían ninguna restricción de nombre—. El nombre se guarda tal como se escribe (docs/05 §9.16).
  3. **No había forma de quitar una categoría equivocada.** Decisión del Product Owner: **se borra la que ninguna convocatoria usa**; la que ya clasifica algo solo se desactiva (RN-07 precisado). La condición vive en la política RLS; el endpoint cuenta el uso antes para responder 409 con el motivo, y el botón solo sale donde borrar es posible.
  - `prueba-catalogo-admin.mjs` pasa de 40 a **55 comprobaciones**, todas verdes. Las otras dos suites, sin regresiones.
  - **Quedó a medias:** al fusionar los duplicados existentes ganó la versión **sin tilde** (el criterio de desempate no servía, porque el nombre normalizado también baja a minúsculas). No se corrigió la migración porque ese código ya no vuelve a ejecutarse; el dato se arregla borrando la categoría y volviéndola a crear.
- **Sesión 013: Sprint 2, paso 3 — publicación validada en servidor (RF-09, RN-01, RN-03, RNF-11).**
  - Migración `publicar_convocatoria` (`security invoker`, docs/05 §9.15): exige datos mínimos, enlace oficial y ≥1 requisito, y **no publica lo ya vencido**. Los adjuntos no se exigen (decisión de la 012). Registra `publicada_at` y `publicado_por`. Despublicar conserva ese rastro (RN-07). Se publica desde cualquier estado que no sea `publicada`, incluido `cerrada`, para que corregir la fecha devuelva la salida.
  - `POST .../publicar` y `.../despublicar`. El endpoint enumera **todo** lo que falta de una vez; la función SQL es la barrera y rechaza igual si se la llama directamente (RNF-20, comprobado).
  - El editor ya trae el botón real, y antes de publicar **sin adjuntos** advierte que la generación con IA perderá el TDR como contexto (CU-05 3d). La advertencia no bloquea.
  - Verificado con `scripts/prueba-publicar-convocatoria.mjs`: **30 comprobaciones, todas pasan**. Las dos suites anteriores se volvieron a correr sin regresiones. `tsc` y `next build` correctos; `lint` sin errores nuevos.
  - **La migración se ensayó con el método corregido** (`raise` dentro del propio archivo) y se comprobó que el ensayo **no** dejaba nada aplicado. El método funciona.
  - **RNF-06 corregido a 20 MB**, por decisión del Product Owner: decía 50 y contradecía a RNF-18.
  - **No verificado:** las pantallas en el navegador con sesión (ver pendiente 9).
- **Sesión 012: Sprint 2, paso 2 — Storage y adjuntos de convocatoria (RF-07, CU-03, RNF-16, RNF-18).**
  - **Dos huecos de especificación resueltos por el Product Owner antes de programar:** los **tres** buckets quedan privados (`docs/04` venía de v5 y dejaba públicos dos, lo que vaciaba RN-33 para los adjuntos) y un adjunto admite **PDF, Word, Excel y ZIP hasta 20 MB**. `docs/03` y `docs/04` corregidos; `docs/05 §9.14` nueva.
  - Migración `storage_y_adjuntos`: los 3 buckets con su límite y su lista de tipos —**ese es el enforcement real**: una subida directa que los incumpla la rechaza Storage—, 12 políticas sobre `storage.objects`, columnas `tipo_mime`, `tamano_bytes` y `actualizado_at`, y un trigger que impide que un `update` cambie el archivo.
  - 4 endpoints bajo `/api/admin/convocatorias/[id]/documentos`: firmar la subida, registrar, renombrar/quitar y enlace de descarga. **El archivo no pasa por el servidor** (una función de Vercel no admite 20 MB): va del navegador al bucket por una URL firmada, con la ruta que decide el servidor. La fila se registra solo si el objeto existe, y con el tamaño y el tipo **reales leídos de Storage**.
  - La sección "Documentos" del editor ya sube, lista, renombra, cambia el tipo, descarga y quita.
  - Verificado con `scripts/prueba-adjuntos-convocatoria.mjs`: **45 comprobaciones, todas pasan**, con subida y descarga de verdad y cuentas temporales ya borradas. `tsc` y `next build` correctos; `lint` sin errores nuevos.
  - **No verificado:** la sección en el navegador con sesión (ver pendiente 8).
- **Pendientes 3 y 8 cerrados:** el Product Owner probó reenviar y cancelar una invitación, y recorrió el catálogo del panel en el navegador. Ambos funcionan.
- **Sesión 011: Sprint 2, paso 1 — administración del catálogo contra Supabase (RF-04, 05, 06, 08, RNF-29).**
  - Endpoints bajo `/api/admin`, que heredan el 404 del panel y el MFA: fuentes, categorías y convocatorias. La lógica vive en `lib/admin/catalogo.ts`. La envoltura `conAdministrador` exige administrador con `aal2`, mismo origen e id uuid. `docs/04` actualizado: antes decía `/api/fuentes`.
  - Migración `guardar_convocatoria` (`security invoker`, docs/05 §9.13): datos, categorías y requisitos en una transacción. No cambia el estado.
  - `/admin/fuentes`, `/admin/categorias`, `/admin/convocatorias` y el editor leen y escriben en Supabase. Nada se borra (RN-07): fuentes y categorías se desactivan. El editor ya no publica ni simula adjuntos (pasos 2 y 3).
  - Verificado con la sección 9 nueva de la prueba de RLS (todo pasa y cada rechazo sale por su regla) y con `scripts/prueba-catalogo-admin.mjs`: 40 comprobaciones con cuentas temporales, ya borradas. `tsc` y `next build` correctos; `lint` sin errores nuevos.
  - **No verificado:** las pantallas en el navegador con sesión de administrador (ver pendiente 8).
- **Pendiente 3, en parte:** el Product Owner revocó al administrador de prueba y confirmó el 404. En la base quedó `admin_revocado` y, 9 s después, `acceso_denegado` de esa sesión en `/admin`.
- **Ya cerrada la sesión, a pedido del Product Owner:** no llegaba el correo de confirmación al crear una cuenta. Causa: registrarse con un correo que ya tiene cuenta devuelve éxito sin enviar nada (Supabase, para no revelar qué correos existen). Se borró la cuenta de administrador revocado `danielangeline322@gmail.com` y el Product Owner se registró con ella como empresa en producción: **RF-01 queda probado por el formulario con correo real**, con confirmación, perfil de empresa y trial de 3 créditos.
- **Sesión 010:** entrada con dos puertas (RF-84) y recuperación de contraseña (RF-03). Cerró el Sprint 1.

Detalle en [`docs/bitacora/2026-09-18-sesion-014.md`](docs/bitacora/2026-09-18-sesion-014.md).

## En curso

Nada a medias en el código. **Sprint 2, pasos 1, 2 y 3 hechos** (sesiones 011, 012 y 013).

## Lo siguiente

**Sprint 2 — Catálogo y administración de contenido** (`docs/10 §Sprint 2`):

1. ~~Endpoints de fuentes, convocatorias, categorías y requisitos (RF-04..06, 08)~~ — **sesión 011**. Los documentos adjuntos (RF-07) pasan al paso 2, que trae Storage.
2. ~~Storage: 3 buckets privados con URLs firmadas de 15 min y adjuntos de convocatoria (RF-07, RNF-16, RNF-18)~~ — **sesión 012**. Los archivos del perfil del consultor (foto y hoja de vida) tienen ya su bucket y sus políticas; la pantalla y sus endpoints van con el módulo de consultores.
3. ~~Publicación validada en servidor (RF-09, RN-01, RNF-29), con la advertencia de CU-05 3d~~ — **sesión 013**.
4. **← Empezar aquí.** Catálogo, filtros, chips e indicadores de la landing contra datos reales (RF-11, 12, 13, 43, 44), con `GET /api/convocatorias` para la empresa. **Solo cuentas de empresa** (RN-33): ni visitantes ni consultores.
5. Cerradas fuera del listado salvo filtro explícito (RF-11, RN-02).
6. Job diario de cierre (RF-10, CU-06).
7. Vigencia verificada en servidor al postular y al generar (RF-78).

**Regla vigente:** toda pantalla o endpoint nuevo se declara en `lib/autorizacion/matriz.ts`; si no, responde 404. Los endpoints del catálogo del panel cuelgan de `/api/admin`, así que ya los cubre la regla del panel.

**Hito 2 (día 12):** un administrador carga una convocatoria real de principio a fin —datos, adjuntos, requisitos, enlace— y aparece en el catálogo de las empresas —no para visitantes ni consultores, RN-33—; una vencida desaparece sola al correr el job. *Hoy* ya se carga la convocatoria entera —datos, categorías, requisitos, enlace, adjuntos— **y se publica**; falta el catálogo de la empresa y ver correr el job de cierre.

**Hito 1 (día 6) — cumplido** (sesión 010). Sigue vigente la condición: cada listado de empresa repite la prueba de aislamiento con dos empresas en pantalla al conectarse (proyectos y postulaciones en el Sprint 3; documentos y encargos en el Sprint 4).

## Infraestructura que ya existe

- **Repositorio oficial (desde el 16-sep): `https://github.com/danielangeline/Convocatorias`**, remoto `origin`. El anterior, `DanielBohorquezP/Convocatorias`, queda como remoto `anterior` y ya no recibe pushes. La cuenta de la máquina (DanielBohorquezP) es colaboradora y ya subió `main`, `auditoria-v6` y `sprint-1`. Vercel ya está reconectado al repositorio nuevo (confirmado por el Product Owner en la sesión 003).
- **Vercel está conectado al repositorio.** Cada push a `main` despliega a producción y cada push a otra rama crea una vista previa. El entregable "CI/CD en Vercel" del Sprint 1 **ya está cubierto**, con las variables de Supabase ya cargadas.
- **Supabase** (`lqrqhehwqyphtdzplxhv`): enlazado con el CLI (`npx supabase`, dependencia de desarrollo). Esquema en `supabase/migrations/`, prueba de RLS en `supabase/tests/rls_aislamiento.sql`, 3 jobs en `pg_cron`.
- **Producción (desde el 16-sep, repositorio nuevo):** `https://convocatorias-neon.vercel.app`. La anterior, `convocatorias-gamma`, ya no es la de referencia. Desde la sesión 006 `main` incluye `sprint-1`: producción ya tiene Auth real y no tiene selector de modo demo. Es la única URL que siempre sirve lo último.
- Las URLs con código (`convocatorias-xxxxxxxx-danielbohorquezps-projects.vercel.app`) apuntan a un despliegue fijo y **están protegidas con el inicio de sesión de Vercel**: no sirven para verificar desde fuera.
- `.gitignore` ya excluye `.env*`, así que las claves locales no se suben al repositorio.

## Bloqueos

Ninguno para seguir programando. **Sí bloquea el registro real desde Vercel** el punto 1 de abajo.

Pendiente del Product Owner:

1. ~~**URL Configuration de Auth en Supabase**~~ — hecho por el Product Owner (16-sep). Referencia:: *Site URL* = `https://convocatorias-neon.vercel.app`; *Redirect URLs* = `http://localhost:3000/**`, `https://convocatorias-neon.vercel.app/**` y `https://convocatorias-*-danielbohorquezps-projects.vercel.app/**`. Sin esto, el enlace de confirmación de correo no vuelve a `/auth/confirmar`.
2. ~~**Activar la cuenta de Propietario**~~ — hecho (contraseña y MFA, 16-sep). El primer correo no sirvió porque Supabase no admite `localhost` como destino y lo mandó a la portada. Se reenvió hacia `https://convocatorias-neon.vercel.app/auth/definir-contrasena`, válido por 1 hora. Después de definir la contraseña, activar el MFA en `/mfa`.
3. ~~**Probar la gestión de administradores con la cuenta del Propietario**~~ (sesión 009) — **terminado el 17-sep**. Queda solo la nota del final:
   - ~~`/admin/administradores` aparece en el menú~~, ~~invitar a un correo real sin cuenta~~, ~~abrir el enlace, definir la contraseña, activar el MFA; la invitación pasa a "aceptada"~~ — **hecho el 17-sep** con `danielangeline322@gmail.com` (confirmado en la base: invitación `aceptada`, MFA TOTP verificado, eventos `admin_invitado` y `mfa_activado`);
   - ~~revocar al administrador de prueba y comprobar que su sesión abierta pierde el panel~~ — **hecho el 17-sep** (sesión 011): `danielangeline322@gmail.com` revocado. `admin_revocado` quedó a las 13:15:49 y su sesión recibió `acceso_denegado` en `/admin` 9 s después;
   - ~~reenviar y cancelar una segunda invitación~~ — **hecho el 17-sep**, informado por el Product Owner al abrir la sesión 012. **Pendiente 3 cerrado.**
   - en `/admin/seguridad` todavía no se verán los eventos: esa pantalla sigue leyendo el mock.
4. **Probar en el navegador con sesión** las cuentas de prueba `empresa.s004@example.com` y `consultor.s004@example.com`: login (ahora con las dos puertas y el aviso si eliges la otra), navbar con iniciales y "Salir", 3 créditos en el indicador y `/suscripcion` con el trial. Contraseña nueva dada en el chat de la sesión 010. **Ojo:** `scripts/prueba-matriz-roles.mjs` la vuelve a cambiar si se corre; en ese caso, pedir otra al agente. El QR de `/mfa` se prueba con la cuenta del Propietario.
5. **SMTP propio antes de los pilotos** (p. ej. Resend): el correo por defecto de Supabase envía muy pocos mensajes por hora **y solo a direcciones del equipo del proyecto**. El 17-sep llegó bien a `danielangeline322@gmail.com` (registro real por el formulario, RF-01), pero eso no dice nada sobre una empresa piloto cualquiera.
6. **Cambiar la contraseña de la base de datos** (quedó escrita en el chat de la sesión 003).
7. **Docker Desktop no arranca** en esta máquina: no bloquea, pero obliga a ensayar las migraciones contra el remoto. **Ojo con el método** (hallazgo de la sesión 012): `db push` corre cada migración en su propia transacción, así que para ensayar una hay que poner el `raise` que la revierte **dentro de ese mismo archivo**, nunca en uno posterior.
8. ~~**Recorrer el catálogo del panel en el navegador**~~ — **hecho el 17-sep**, informado por el Product Owner al abrir la sesión 012: todo funciona.
9. **Recorrer la sección "Documentos" del editor en el navegador** (sesión 012). Mismo motivo que el pendiente 8: el agente no inicia sesión escribiendo contraseñas, así que lo probó por HTTP con la cookie del administrador, no en pantalla. En local con `npm run dev`, sobre una convocatoria en borrador:
   - adjuntar un PDF y comprobar que aparece con su tamaño;
   - renombrarlo y cambiarle el tipo;
   - descargarlo (debe abrirse con el nombre descriptivo, no con un uuid);
   - intentar adjuntar un archivo que no sea PDF/Word/Excel/ZIP: debe rechazarse con mensaje;
   - quitarlo y recargar para comprobar que no vuelve.

   Y de la sesión 013, sobre la misma convocatoria:
   - pulsar **Publicar** sin enlace ni requisitos: debe rechazar diciendo **las dos cosas** que faltan;
   - completarlos y publicar **sin ningún adjunto**: debe salir la advertencia, y al aceptar debe publicarse;
   - comprobar que el botón pasa a **Despublicar**, usarlo y volver a publicar.

   **Ojo:** lo que se suba queda en el bucket real y lo que se publique queda publicado; si es de prueba, avisar para borrarlo.

## Decisiones abiertas

Esperan al Product Owner. No bloquean el Sprint 1.

| Decisión | Contexto | Cuándo hace falta |
|---|---|---|
| **Precio del plan Consultor** | Quedó en COP $69.000 al retirarle el cupo de IA. `docs/07 §10.2` marca los planes como "a validar con los pilotos" | Antes de cobrar |
| **Proveedor del límite de tasa** | RNF-27 pide un almacén fuera de Postgres (Upstash Redis o Vercel Edge Config); no está elegido | Sprint 5 |


## Hallazgos no planificados

Cosas detectadas de paso que no pertenecen al sprint en curso. **No se arreglan sobre la marcha**; se anotan aquí y se planifican.

| Hallazgo | Dónde | Gravedad |
|---|---|---|
| `Date.now()` llamado durante el render | `app/admin/seguridad/page.tsx:30` | baja · lint lo marca |
| `setState` dentro de un efecto | `components/SolicitarConsultorModal.tsx:60` | baja · lint lo marca |
| `consultor-5` tiene suscripción `trial`, contra RF-37 y RN-11 | `lib/mock-data.ts` | baja · dato de ejemplo |
| Los diagramas de `docs/diagramas/` siguen siendo de v4 | `docs/diagramas/` | media · desactualizados frente a v6 |
| Los portales de consultor y admin leen `s.proyectos` completo para mostrar nombres; con Supabase deben pedir solo los proyectos de sus encargos (consultor) o pasar por la política de soporte (admin) | `app/consultor/encargos`, `app/consultor/documentos`, `app/admin/encargos` | media · se resuelve al escribir los endpoints del Sprint 1 |
| Sin guarda de propietario en las mutaciones de documento (editar sección, exportar, compartir): hoy solo las protege la ficha | `lib/store.ts` | media · entra con RNF-30 / RN-27 (la RLS ya lo impide en la base) |
| La función `public.rls_auto_enable()` no la crearon nuestras migraciones (probablemente la opción de RLS automático del proyecto) y el asesor de Supabase avisa que `anon` puede ejecutarla por `/rest/v1/rpc` | Supabase remoto | media · revisar qué hace antes de revocarla |
| El asesor marca "varias políticas permisivas" por tabla (una por rol): cuesta rendimiento con volumen | `supabase/migrations/` | baja · consolidar si las consultas se vuelven lentas |
| Tres nombres de política de la migración `20260916120400` superan 63 bytes y Postgres los guardó recortados; no chocan, pero no coinciden letra a letra con el archivo | `supabase/migrations/20260916120400_consultores_y_encargos.sql` | baja · cosmético |
| El prototipo cuenta como "solicitud activa" los encargos `completado` y `calificado`; RF-80 ya fija `pendiente`/`en_curso` | `app/(portal)/consultores/[id]/page.tsx:60` | baja · se alinea al conectar el endpoint |
| **Supabase no admite `http://localhost:3000/**` en *Redirect URLs***: un `redirectTo` a localhost se sustituye por la *Site URL*, así que confirmar el correo o recuperar la contraseña en local lleva a producción. Comprobado con `generateLink` en la sesión 006 | Supabase → Authentication → URL Configuration | media · revisar cómo quedó escrita la entrada de localhost |
| El mecanismo de invitación de administradores no funcionaba: Auth inserta el usuario sin `app_metadata`, y el trigger nunca veía la invitación | `docs/05 §9.12` | **resuelto** en la sesión 008: aceptación explícita del servidor (`aceptar_invitacion_admin`) |
| `service_role` no tenía `usage` sobre el esquema `privado`: sus escrituras sobre tablas con triggers fallaban (42501). Era la causa del `update` que no persistió en la sesión 004 y de `mfa_habilitado = false` del Propietario | Supabase | **resuelto** en la sesión 007 (migración `20260916150000`) |
| Una Server Action denegada por el proxy responde 404, no 403: la reescritura a `/acceso-denegado` no encuentra la acción. No se ejecuta y queda el evento `acceso_denegado` | `proxy.ts` | baja · revisar cuando existan Server Actions de negocio |
| La segunda barrera (`exigirRol` en los layouts) no se ejercitó por separado: el proxy corta antes | `lib/auth.ts` | baja · probarla desactivando el proxy en un entorno de prueba |
| Las pruebas de la sesión 007 dejaron ~120 eventos `acceso_denegado` reales en `eventos_seguridad` | Supabase remoto | baja · son evidencia; limpiar antes de los pilotos |
| Quedan 2 cuentas de prueba (`empresa.s004@example.com`, `consultor.s004@example.com`) en la base remota; `admin.s004` se borró en la sesión 006 | Supabase remoto | baja · borrarlas antes de los pilotos |
| El reloj de esta máquina va ~141 s atrasado frente a Supabase: los códigos TOTP generados en ella fallan | máquina local | baja · sincronizar la hora de Windows |
| En la sesión 004, el primer `update` de `perfiles.rol` con `service_role` no persistió y el error no se leyó; al repetirlo funcionó. No se reprodujo | script de prueba | baja · vigilar al escribir el endpoint de asignar rol |
| El perfil de consultor real se edita solo en el store: nombre, descripción, portafolio y demás se pierden al recargar | `app/consultor/perfil` | media · entra con los endpoints de perfil (Sprint 2/5) |
| La transición de estados de la postulación (RF-83) no se valida en la base: RLS deja a la dueña poner cualquier estado | `postulaciones` | media · validar en el endpoint o con trigger en el Sprint 2 |
| `/admin/seguridad` sigue leyendo eventos del mock: los eventos reales (`admin_invitado`, `admin_revocado`, `acceso_denegado`…) no se ven en el panel | `app/admin/seguridad/page.tsx` | media · entra con CU-39 |
| Si `inviteUserByEmail` falla después de crear la cuenta en Auth, el endpoint borra la invitación pero no puede borrar esa cuenta (no conoce su id): queda una empresa con trial que ocupa el correo. Se registra en el log del servidor. No se ha observado; Auth suele deshacer la cuenta si el envío falla | `lib/admin/administradores.ts` | baja · resolver con una función que devuelva el id por correo si ocurre |
| La segunda barrera de la gestión de administradores (`sesionDePropietario`) tampoco se ejercitó por separado: el proxy corta antes | `lib/auth.ts` | baja · mismo caso que `exigirRol` |
| `scripts/prueba-matriz-roles.mjs` cambia en cada corrida la contraseña de las cuentas s004, así que la que tiene el Product Owner deja de servir | `scripts/prueba-matriz-roles.mjs` | baja · usar cuentas temporales propias, como la sesión 010 |
| No había "¿Olvidaste tu contraseña?" en `/login` | `app/(identidad)/login` | **resuelto** en la sesión 010 (RF-03, agregado al Sprint 1 en `docs/10`) |
| Las puertas se anunciaban por su valor (`empresa`, `consultor`) y no por su nombre | `components/identidad/SelectorPuerta.tsx` | **resuelto** en la sesión 010 (`aria-label` + `aria-describedby`); falta probar con un lector de pantalla real |
| Apareció en Auth la cuenta `danielangeline322@gmail.com` durante la sesión 010 | Supabase Auth | **resuelto**: la invitó el Propietario desde el panel; el Product Owner lo confirmó. Es administrador (ver pendiente 3) |
| Las acciones del store para fuentes, categorías y convocatorias (`agregarFuente`, `eliminarCategoria`, `agregarConvocatoria`…) quedaron sin uso en el panel. El dashboard `/admin` y el portal Empresa aún leen convocatorias y categorías del mock | `lib/store.ts`, `app/admin/page.tsx` | baja · retirarlas cuando el catálogo de la empresa pase a Supabase (Sprint 2, paso 4) |
| CU-05 3c pide que la edición de una convocatoria quede "auditada", pero solo existe `actualizado_at`: no se guarda quién editó ni qué cambió. RNF-11 solo nombra la creación y la publicación | `convocatorias` | media · decidir con el Product Owner si basta `actualizado_por` o hace falta historial |
| La prueba de RLS asumía `invitaciones_admin` vacía y falló al existir la invitación real del 17-sep | `supabase/tests/rls_aislamiento.sql` | **resuelto** en la sesión 011: cuenta con línea base, como `total_eventos` |
| Registrarse con un correo que ya tiene cuenta devuelve éxito y no envía correo (Supabase lo hace a propósito, para no revelar qué correos existen), pero la pantalla dice "Te enviamos un enlace…". Comprobado el 17-sep: `signup` responde 200 con `identities: []` y sin correo | `lib/acciones/auth.ts` (`registrarse`) | media · redactar el mensaje sin afirmar el envío, p. ej. "Si ese correo no tenía cuenta, te enviamos un enlace" |
| La cuenta `danielangeline322@gmail.com` (administrador revocado) se borró el 17-sep a pedido del Product Owner, para volver a registrarla como empresa. Sus 4 eventos de seguridad quedaron sin `usuario_id`; `admin_invitado` y `admin_revocado` conservan el correo en el texto | Supabase Auth | baja · queda anotado como contexto de la evidencia del Hito 1 |
| RNF-06 admitía "carga admin hasta 50 MB" y contradecía a RNF-18 (20 MB, que es lo que el bucket hace cumplir) | `docs/03` RNF-06 | **resuelto** en la sesión 013: manda 20 MB, por decisión del Product Owner |
| No se puede **renombrar una categoría** desde la pantalla, aunque `PATCH /api/admin/categorias/[id]` lo admite desde la sesión 011. Con el botón de borrar el caso queda cubierto a medias (borrar y volver a crear) | `components/admin/GestionCategorias.tsx` | baja · exponer el renombrado |
| Una **fuente** no se puede borrar aunque no tenga convocatorias, que es el mismo argumento aceptado para categorías en la sesión 014. El Product Owner decidió sobre categorías y no se extendió por cuenta propia | `docs/03` RN-07 | baja · preguntarle si quiere lo mismo en fuentes |
| Un servidor `next dev` de una sesión anterior puede seguir vivo y servir código viejo: en la sesión 013 hizo que seis comprobaciones "pasaran" por la razón equivocada (404 porque la ruta aún no existía en ese proceso). `next dev` lo avisa con el PID, pero en su propio log | máquina local | media · antes de creerse un 404, comprobar que responde el servidor de esta sesión |
| Un `next dev` que lleva horas vivo puede corromper su caché y responder **500 en rutas dinámicas** que funcionan perfectamente: al Product Owner le pasó con `PATCH /api/admin/fuentes/[id]` al desactivar una fuente. En `.next/dev/logs/next-development.log`: `Failed to generate static paths` y `Jest worker encountered 2 child process exceptions`. **Se arregla parando el proceso, borrando `.next` y arrancando de nuevo**; reproducido y confirmado con el servidor limpio | máquina local | media · ante un 500 inexplicable, reiniciar con la caché limpia antes de buscar el fallo en el código |
| Ante un 500, la pantalla del panel muestra "No pudimos completar la acción. Intenta de nuevo.", igual que ante un fallo de red. Es correcto de cara al usuario, pero no distingue un servidor caído de un rechazo, y eso alargó el diagnóstico anterior | `lib/admin/peticion.ts` | baja · valorar distinguir el 5xx en el texto |
| **El ensayo de una migración con `raise` en un archivo aparte no ensaya nada**: `supabase db push` corre cada migración en su propia transacción, así que el archivo de ensayo solo se revierte a sí mismo y la migración real anterior ya quedó aplicada | procedimiento de migraciones | **resuelto** en la sesión 012: el paso 6 de `docs/10 §17.3` fija que el `raise` va dentro del propio archivo |
| `set role supabase_storage_admin` está negado al rol que corre las migraciones (42501), aunque ese mismo rol sí puede crear políticas sobre `storage.objects` | `supabase/migrations/` | baja · anotado en la migración |
| Si la subida al bucket ocurre y el registro de la fila no, queda un objeto suelto. Es invisible (toda descarga parte de la fila) y la pantalla pide borrarlo, pero nadie barre los que queden de un navegador cerrado a media subida | `lib/admin/documentos.ts` | baja · valorar un job de limpieza antes de los pilotos |
| Borrar una convocatoria arrastra sus filas de `documentos_convocatoria` por `on delete cascade`, pero **no** los objetos del bucket | `supabase/migrations/20260917200000` | baja · mismo job de limpieza |
| `allowed_mime_types` del bucket se compara con el tipo que **declara** el cliente. El servidor lo compensa exigiendo que el tipo que reporta Storage case con la extensión de la ruta, pero nadie inspecciona el contenido del archivo | Storage | baja · valorar antivirus o comprobación de firma antes de los pilotos |
| A un administrador sin MFA, `/api/admin/...` responde 307 a `/mfa`, no 404. Es lo que hace `proxy.ts` desde la sesión 007 y no le entrega datos, pero un `fetch` sigue la redirección y recibe HTML | `proxy.ts` | baja · valorar un 401 JSON para `/api` si molesta al cliente |

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/).
2. Confirmar si alguna decisión abierta se resolvió y si el Product Owner hizo los pendientes 3 y 8.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
