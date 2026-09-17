# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 17 de septiembre de 2026 · cierre de la sesión 011
**Sprint:** 2 · día 7 de 30
**Rama de trabajo:** `sprint-2`, abierta desde `main` en la sesión 011 y subida a `origin` (sin fusionar a `main`: producción todavía no tiene el catálogo del panel). **Migración nueva ya aplicada al remoto:** `20260917100000_guardar_convocatoria`. No rompe `main`, que no la llama

---

## Dónde vamos

La especificación está cerrada en **v6**. **La base de datos existe en Supabase** (27 tablas con RLS, prueba cruzada pasada) y **la identidad ya es real**: registro, login, confirmación de correo y MFA del administrador con Supabase Auth. El `ModoDemo` desapareció. **Desde la sesión 011, el panel administra fuentes, categorías y convocatorias (datos y requisitos) contra Supabase**, con endpoints validados en el servidor. Las tablas del catálogo siguen vacías: nadie ha cargado contenido real. Lo demás —el catálogo que ve la empresa, proyectos, postulaciones, documentos, encargos— sigue en datos de ejemplo de Zustand, filtrados por el `auth.uid()` real: una cuenta nueva empieza vacía y lo que crea se pierde al recargar.

## Lo último que se hizo

- **Sesión 011: Sprint 2, paso 1 — administración del catálogo contra Supabase (RF-04, 05, 06, 08, RNF-29).**
  - Endpoints bajo `/api/admin`, que heredan el 404 del panel y el MFA: fuentes, categorías y convocatorias. La lógica vive en `lib/admin/catalogo.ts`. La envoltura `conAdministrador` exige administrador con `aal2`, mismo origen e id uuid. `docs/04` actualizado: antes decía `/api/fuentes`.
  - Migración `guardar_convocatoria` (`security invoker`, docs/05 §9.13): datos, categorías y requisitos en una transacción. No cambia el estado.
  - `/admin/fuentes`, `/admin/categorias`, `/admin/convocatorias` y el editor leen y escriben en Supabase. Nada se borra (RN-07): fuentes y categorías se desactivan. El editor ya no publica ni simula adjuntos (pasos 2 y 3).
  - Verificado con la sección 9 nueva de la prueba de RLS (todo pasa y cada rechazo sale por su regla) y con `scripts/prueba-catalogo-admin.mjs`: 40 comprobaciones con cuentas temporales, ya borradas. `tsc` y `next build` correctos; `lint` sin errores nuevos.
  - **No verificado:** las pantallas en el navegador con sesión de administrador (ver pendiente 8).
- **Pendiente 3, en parte:** el Product Owner revocó al administrador de prueba y confirmó el 404. En la base quedó `admin_revocado` y, 9 s después, `acceso_denegado` de esa sesión en `/admin`.
- **Sesión 010:** entrada con dos puertas (RF-84) y recuperación de contraseña (RF-03). Cerró el Sprint 1.

Detalle en [`docs/bitacora/2026-09-17-sesion-011.md`](docs/bitacora/2026-09-17-sesion-011.md).

## En curso

Nada a medias en el código. **Sprint 2, paso 1 hecho** (sesión 011).

## Lo siguiente

**Sprint 2 — Catálogo y administración de contenido** (`docs/10 §Sprint 2`):

1. ~~Endpoints de fuentes, convocatorias, categorías y requisitos (RF-04..06, 08)~~ — **sesión 011**. Los documentos adjuntos (RF-07) pasan al paso 2, que trae Storage.
2. **← Empezar aquí.** Storage:
   - 3 buckets y hoja de vida privada con URLs firmadas de 15 min (RNF-16, RNF-18);
   - **adjuntos de convocatoria** (RF-07, CU-03): subir, renombrar y quitar antes de publicar. La sección de documentos del editor ya muestra el conteo real.
3. Publicación validada en servidor, incluido el enlace oficial (RF-09, RN-01, RNF-29): `POST /api/admin/convocatorias/[id]/publicar` y `.../despublicar`, con 400 y la lista de lo que falta. El botón del editor está deshabilitado a la espera.
4. Catálogo, filtros, chips e indicadores de la landing contra datos reales (RF-11, 12, 13, 43, 44), con `GET /api/convocatorias` para la empresa.
5. Cerradas fuera del listado salvo filtro explícito (RF-11, RN-02).
6. Job diario de cierre (RF-10, CU-06).
7. Vigencia verificada en servidor al postular y al generar (RF-78).

**Regla vigente:** toda pantalla o endpoint nuevo se declara en `lib/autorizacion/matriz.ts`; si no, responde 404. Los endpoints del catálogo del panel cuelgan de `/api/admin`, así que ya los cubre la regla del panel.

**Hito 2 (día 12):** un administrador carga una convocatoria real de principio a fin —datos, adjuntos, requisitos, enlace— y aparece en el catálogo de las empresas —no para visitantes ni consultores, RN-33—; una vencida desaparece sola al correr el job. *Hoy* ya se cargan datos, categorías, requisitos y enlace; faltan adjuntos, publicar y el catálogo de la empresa.

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
3. **Probar la gestión de administradores con la cuenta del Propietario** (sesión 009) — **casi terminado**, en producción (`https://convocatorias-neon.vercel.app`) o en local:
   - ~~`/admin/administradores` aparece en el menú~~, ~~invitar a un correo real sin cuenta~~, ~~abrir el enlace, definir la contraseña, activar el MFA; la invitación pasa a "aceptada"~~ — **hecho el 17-sep** con `danielangeline322@gmail.com` (confirmado en la base: invitación `aceptada`, MFA TOTP verificado, eventos `admin_invitado` y `mfa_activado`);
   - ~~revocar al administrador de prueba y comprobar que su sesión abierta pierde el panel~~ — **hecho el 17-sep** (sesión 011): `danielangeline322@gmail.com` revocado. `admin_revocado` quedó a las 13:15:49 y su sesión recibió `acceso_denegado` en `/admin` 9 s después;
   - **falta:** reenviar y cancelar una segunda invitación (invitar a otro correo real sin cuenta);
   - en `/admin/seguridad` todavía no se verán los eventos: esa pantalla sigue leyendo el mock.
4. **Probar en el navegador con sesión** las cuentas de prueba `empresa.s004@example.com` y `consultor.s004@example.com`: login (ahora con las dos puertas y el aviso si eliges la otra), navbar con iniciales y "Salir", 3 créditos en el indicador y `/suscripcion` con el trial. Contraseña nueva dada en el chat de la sesión 010. **Ojo:** `scripts/prueba-matriz-roles.mjs` la vuelve a cambiar si se corre; en ese caso, pedir otra al agente. El QR de `/mfa` se prueba con la cuenta del Propietario.
5. **SMTP propio antes de los pilotos** (p. ej. Resend): el correo por defecto de Supabase envía muy pocos mensajes por hora.
6. **Cambiar la contraseña de la base de datos** (quedó escrita en el chat de la sesión 003).
7. **Docker Desktop no arranca** en esta máquina: no bloquea (las migraciones se ensayan en una transacción con `ROLLBACK` contra el remoto).
8. **Recorrer el catálogo del panel en el navegador con la cuenta del Propietario** (sesión 011). Mientras `sprint-2` no llegue a producción, en local con `npm run dev`:
   - crear una fuente con notas y desactivar otra;
   - crear categorías de los tres tipos y desactivar una;
   - crear una convocatoria en borrador; en el editor, llenar datos, enlace oficial, categorías y 3 requisitos, reordenarlos, quitar uno y guardar;
   - recargar y comprobar que todo sigue;
   - probar un enlace `javascript:`: debe rechazarse con mensaje.

   El agente no inicia sesión escribiendo contraseñas en el navegador, así que esta parte solo la puede hacer el Product Owner. **Ojo:** lo que se cree queda en la base real; si es de prueba, avisar para borrarlo.

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
| A un administrador sin MFA, `/api/admin/...` responde 307 a `/mfa`, no 404. Es lo que hace `proxy.ts` desde la sesión 007 y no le entrega datos, pero un `fetch` sigue la redirección y recibe HTML | `proxy.ts` | baja · valorar un 401 JSON para `/api` si molesta al cliente |

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/).
2. Confirmar si alguna decisión abierta se resolvió y si el Product Owner hizo los pendientes 3 y 8.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
