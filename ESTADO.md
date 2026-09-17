# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 17 de septiembre de 2026 · cierre de la sesión 010
**Sprint:** 1 · día 1 de 30
**Rama de trabajo:** `sprint-1` (el Sprint 2 puede seguir en ella o abrir `sprint-2`) — al cierre de la sesión 010, `main` y `sprint-1` iguales y subidos a `origin`: producción despliega las dos puertas y la recuperación de contraseña. Sin migraciones nuevas

---

## Dónde vamos

La especificación está cerrada en **v6**. **La base de datos existe en Supabase** (27 tablas con RLS, prueba cruzada pasada) y **la identidad ya es real**: registro, login, confirmación de correo y MFA del administrador con Supabase Auth. El `ModoDemo` desapareció. Lo demás —proyectos, catálogo, postulaciones, documentos, encargos— sigue en datos de ejemplo de Zustand, filtrados por el `auth.uid()` real: una cuenta nueva empieza vacía y lo que crea se pierde al recargar.

## Lo último que se hizo

- **Sesión 010: entrada con dos puertas (RF-84), paso 6 y último entregable del Sprint 1.**
  - Landing: las tarjetas "Soy empresa o entidad" y "Soy consultor", cada una con "Crear cuenta" y "Ya tengo cuenta". Se quitaron las tres convocatorias "destacadas", que mostraban convocatorias individuales a visitantes (RN-33).
  - `/registro` y `/login` comparten `SelectorPuerta` y aceptan `?puerta=`. En el registro la puerta fija el rol; en el login solo orienta.
  - `iniciarSesion` lleva siempre al inicio del rol real y agrega `?aviso=puerta` si la puerta no coincide. `AvisoPuerta` lo muestra en ambos portales y lo quita de la dirección. El administrador va a `/mfa` sin aviso.
  - Probado en el navegador contra Supabase real con tres cuentas temporales, ya borradas: los cinco casos de puerta. `tsc`, `next build` y `lint` sin errores nuevos.
  - **Agregado a pedido del Product Owner:**
    - Recuperación de contraseña (RF-03): "¿Olvidaste tu contraseña?" en `/login` → `/auth/recuperar` → enlace → `/auth/definir-contrasena`. Probado con una cuenta temporal.
    - Las puertas anuncian su nombre a los lectores de pantalla.
    - Las cuentas s004 tienen contraseña nueva, dada en el chat de la sesión 010 (no está en el repositorio).
- **Sesión 009:** gestión de administradores (invitar, reenviar, cancelar, revocar).

Detalle en [`docs/bitacora/2026-09-17-sesion-010.md`](docs/bitacora/2026-09-17-sesion-010.md).

## En curso

Nada a medias en el código. **Sprint 1 cerrado: entregables completos y Hito 1 cumplido** (decisión del Product Owner, 17-sep). Del recorrido de administradores falta solo reenviar, cancelar y revocar (pendiente 3).

## Lo siguiente

**Sprint 1 — completado** (pasos 1 a 6, sesiones 002 a 010, más RF-03 agregado en la 010). **Al abrir la sesión 011, el Product Owner termina la prueba de la gestión de administradores**: reenviar, cancelar y revocar (pendiente 3). Invitar, aceptar y activar el MFA ya funcionaron con correo real (17-sep). Después empieza el Sprint 2.

**Sprint 2 — Catálogo y administración de contenido** (`docs/10 §Sprint 2`):

1. **← Empezar aquí.** Endpoints de fuentes, convocatorias, categorías, requisitos y documentos adjuntos (RF-04..08).
2. Storage: 3 buckets, hoja de vida privada con URLs firmadas de 15 min (RNF-16, RNF-18).
3. Publicación validada en servidor, incluido el enlace oficial (RF-09, RN-01, RNF-29).
4. Catálogo, filtros, chips e indicadores de la landing contra datos reales (RF-11, 12, 13, 43, 44).
5. Cerradas fuera del listado salvo filtro explícito (RF-11, RN-02).
6. Job diario de cierre (RF-10, CU-06).
7. Vigencia verificada en servidor al postular y al generar (RF-78).

**Regla vigente:** toda pantalla o endpoint nuevo se declara en `lib/autorizacion/matriz.ts`; si no, responde 404.

**Hito 1 (día 6) — cumplido.** Un consultor recibe **404** en `/admin` (como un anónimo y como una ruta inventada) y **403** en `/convocatorias/[id]/generar`; solo el Propietario crea administradores; dos empresas no ven nada la una de la otra en los cuatro listados. Probado, no supuesto.
- *Rutas (sesión 007):* consultor → 404 en `/admin` y 403 en `/convocatorias/[id]/generar`.
- *"Solo el Propietario crea administradores":* probado en la base y en rutas en la sesión 009 (otro administrador recibe 404 y no crea nada). **El 17-sep el Propietario lo hizo desde su sesión con correo real**: invitó a `danielangeline322@gmail.com`, la persona definió la contraseña y activó el MFA, y la invitación quedó `aceptada` (eventos `admin_invitado` y `mfa_activado`).
- *Aislamiento entre empresas:* probado en RLS (sesión 003). **Decisión del Product Owner (17-sep, opción a):** el hito se da por cumplido con esa prueba. **Condición:** al conectar cada uno de los cuatro listados —proyectos y postulaciones en el Sprint 3, documentos y encargos en el Sprint 4— se repite la prueba con dos empresas en pantalla, y ese listado no está terminado sin ella.

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
3. **Probar la gestión de administradores con la cuenta del Propietario** (sesión 009) — **a medias; se termina al abrir la sesión 011**, en producción (`https://convocatorias-neon.vercel.app`) o en local:
   - ~~`/admin/administradores` aparece en el menú~~, ~~invitar a un correo real sin cuenta~~, ~~abrir el enlace, definir la contraseña, activar el MFA; la invitación pasa a "aceptada"~~ — **hecho el 17-sep** con `danielangeline322@gmail.com` (confirmado en la base: invitación `aceptada`, MFA TOTP verificado, eventos `admin_invitado` y `mfa_activado`);
   - **falta:** reenviar y cancelar una segunda invitación; revocar al administrador de prueba y comprobar que su sesión abierta pierde el panel. **Ojo:** `danielangeline322@gmail.com` hoy es administrador con acceso real al panel. Si solo era de prueba, conviene que sea el que se revoca;
   - en `/admin/seguridad` todavía no se verán los eventos: esa pantalla sigue leyendo el mock.
4. **Probar en el navegador con sesión** las cuentas de prueba `empresa.s004@example.com` y `consultor.s004@example.com`: login (ahora con las dos puertas y el aviso si eliges la otra), navbar con iniciales y "Salir", 3 créditos en el indicador y `/suscripcion` con el trial. Contraseña nueva dada en el chat de la sesión 010. **Ojo:** `scripts/prueba-matriz-roles.mjs` la vuelve a cambiar si se corre; en ese caso, pedir otra al agente. El QR de `/mfa` se prueba con la cuenta del Propietario.
5. **SMTP propio antes de los pilotos** (p. ej. Resend): el correo por defecto de Supabase envía muy pocos mensajes por hora.
6. **Cambiar la contraseña de la base de datos** (quedó escrita en el chat de la sesión 003).
7. **Docker Desktop no arranca** en esta máquina: no bloquea (las migraciones se ensayan en una transacción con `ROLLBACK` contra el remoto).

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

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/).
2. Confirmar si alguna decisión abierta se resolvió.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
