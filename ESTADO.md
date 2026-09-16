# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 16 de septiembre de 2026 · cierre de la sesión 004
**Sprint:** 1 · día 1 de 30
**Rama de trabajo:** `sprint-1` — sin fusionar a `main`

---

## Dónde vamos

La especificación está cerrada en **v6**. **La base de datos existe en Supabase** (26 tablas con RLS, prueba cruzada pasada) y **la identidad ya es real**: registro, login, confirmación de correo y MFA del administrador con Supabase Auth. El `ModoDemo` desapareció. Lo demás —proyectos, catálogo, postulaciones, documentos, encargos— sigue en datos de ejemplo de Zustand, filtrados por el `auth.uid()` real: una cuenta nueva empieza vacía y lo que crea se pierde al recargar.

## Lo último que se hizo

- **El trial pasa de 14 a 7 días** (decisión del Product Owner), con 3 créditos. Cambiado primero en la especificación: RF-01, RF-37, RN-11, CU-14, docs/00, docs/07.
- **El trial es un plan** (`planes.es_trial`, `dias_trial`): la suscripción trial ya no tiene `plan_id` nulo. Decisión del Product Owner.
- **Paso 3 del Sprint 1 hecho.** Migración `20260916130000`: trigger `al_registrar_cuenta` sobre `auth.users` que crea perfil y trial (empresa) o perfil incompleto (consultor); pedir `administrador` produce empresa (RN-06).
- **App:** `proxy.ts`, layouts que exigen sesión en el servidor, `/registro`, `/login`, `/auth/confirmar`, `/mfa` (TOTP), Server Actions con eventos `login_fallido` / `mfa_activado` / `mfa_fallido`.
- **Pasan a `servidor`:** RF-01, RF-37, RF-64, RNF-28, RN-06, RN-11.

Detalle en [`docs/bitacora/2026-09-16-sesion-004.md`](docs/bitacora/2026-09-16-sesion-004.md).

## En curso

Nada a medias en el código. **Falta la prueba en el navegador con sesión iniciada** (ver "Pendiente del Product Owner"): el agente no escribe contraseñas en formularios.

## Lo siguiente — Sprint 1

1. ~~Columnas de propietario (RN-30) sobre mocks~~ — sesión 002.
2. ~~Proyecto Supabase y migraciones con RLS~~ — sesión 003.
3. ~~Supabase Auth con los tres roles, trial y MFA~~ — sesión 004.
4. **← Empezar aquí.** **`requireRole()` en toda ruta y endpoint** (RNF-30): hoy cualquier usuario autenticado abre `/admin`, `/consultor/*` o el portal empresa. Responder 403 y escribir `acceso_denegado` (RF-65). Los layouts ya leen la sesión con `obtenerSesion()` de `lib/auth.ts`: la guarda se apoya ahí.
5. **Storage: 3 buckets**, hoja de vida privada con URLs firmadas de 15 min (RNF-16, RNF-18).

**Hito 1 (día 6):** un consultor recibe 403 en `/admin` y en `/convocatorias/[id]/generar`; dos empresas no ven nada la una de la otra en los cuatro listados. Probado, no supuesto. *La mitad RLS está probada; la autenticación real existe; falta la de rutas y endpoints.*

## Infraestructura que ya existe

- **Repositorio oficial (desde el 16-sep): `https://github.com/danielangeline/Convocatorias`**, remoto `origin`. El anterior, `DanielBohorquezP/Convocatorias`, queda como remoto `anterior` y ya no recibe pushes. La cuenta de la máquina (DanielBohorquezP) es colaboradora y ya subió `main`, `auditoria-v6` y `sprint-1`. Vercel ya está reconectado al repositorio nuevo (confirmado por el Product Owner en la sesión 003).
- **Vercel está conectado al repositorio.** Cada push a `main` despliega a producción y cada push a otra rama crea una vista previa. El entregable "CI/CD en Vercel" del Sprint 1 **ya está cubierto**, con las variables de Supabase ya cargadas.
- **Supabase** (`lqrqhehwqyphtdzplxhv`): enlazado con el CLI (`npx supabase`, dependencia de desarrollo). Esquema en `supabase/migrations/`, prueba de RLS en `supabase/tests/rls_aislamiento.sql`, 3 jobs en `pg_cron`.
- **Producción:** `https://convocatorias-gamma.vercel.app`. Es la única URL que siempre sirve lo último.
- Las URLs con código (`convocatorias-xxxxxxxx-danielbohorquezps-projects.vercel.app`) apuntan a un despliegue fijo y **están protegidas con el inicio de sesión de Vercel**: no sirven para verificar desde fuera.
- `.gitignore` ya excluye `.env*`, así que las claves locales no se suben al repositorio.

## Bloqueos

Ninguno para seguir programando. **Sí bloquea el registro real desde Vercel** el punto 1 de abajo.

Pendiente del Product Owner:

1. **URL Configuration de Auth en Supabase** (*Authentication → URL Configuration*): *Site URL* = `https://convocatorias-gamma.vercel.app`; *Redirect URLs* = `http://localhost:3000/**`, `https://convocatorias-gamma.vercel.app/**` y `https://convocatorias-*-danielbohorquezps-projects.vercel.app/**`. Sin esto, el enlace de confirmación de correo no vuelve a `/auth/confirmar`.
2. **Probar en el navegador con sesión** las cuentas de prueba de la sesión 004 (`empresa.s004@example.com`, `consultor.s004@example.com`, `admin.s004@example.com`; la contraseña se dio en el chat de la sesión 004, no está en el repositorio): login, navbar con iniciales y "Salir", 3 créditos en el indicador, `/suscripcion` con el trial, y el QR de `/mfa` con una app autenticadora.
3. **SMTP propio antes de los pilotos** (p. ej. Resend): el correo por defecto de Supabase envía muy pocos mensajes por hora.
4. **Cambiar la contraseña de la base de datos** (quedó escrita en el chat de la sesión 003).
5. **Docker Desktop no arranca** en esta máquina: no bloquea (las migraciones se ensayan en una transacción con `ROLLBACK` contra el remoto).

## Decisiones abiertas

Esperan al Product Owner. No bloquean el Sprint 1.

| Decisión | Contexto | Cuándo hace falta |
|---|---|---|
| **Precio del plan Consultor** | Quedó en COP $69.000 al retirarle el cupo de IA. `docs/07 §10.2` marca los planes como "a validar con los pilotos" | Antes de cobrar |
| **¿El catálogo es público?** | La landing prometía "Ver convocatorias sin registrarme", pero `docs/04 §8.2` marca `/convocatorias` como solo `empresa`, y la RLS sí deja leer el catálogo publicado a `anon`. En la sesión 004 el botón pasó a "Ya tengo cuenta" | Antes de `requireRole()` (paso 4) |
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
| Hay 3 cuentas de prueba `*.s004@example.com` en la base remota (una con factor TOTP) | Supabase remoto | baja · borrarlas antes de los pilotos |
| El reloj de esta máquina va ~141 s atrasado frente a Supabase: los códigos TOTP generados en ella fallan | máquina local | baja · sincronizar la hora de Windows |
| En la sesión 004, el primer `update` de `perfiles.rol` con `service_role` no persistió y el error no se leyó; al repetirlo funcionó. No se reprodujo | script de prueba | baja · vigilar al escribir el endpoint de asignar rol |
| El perfil de consultor real se edita solo en el store: nombre, descripción, portafolio y demás se pierden al recargar | `app/consultor/perfil` | media · entra con los endpoints de perfil (Sprint 2/5) |
| La transición de estados de la postulación (RF-83) no se valida en la base: RLS deja a la dueña poner cualquier estado | `postulaciones` | media · validar en el endpoint o con trigger en el Sprint 2 |

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/).
2. Confirmar si alguna decisión abierta se resolvió.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
