# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 16 de septiembre de 2026 · cierre de la sesión 008
**Sprint:** 1 · día 1 de 30
**Rama de trabajo:** `sprint-1` — fusionada a `main` al cierre de la sesión 006 (producción ya despliega Auth real)

---

## Dónde vamos

La especificación está cerrada en **v6**. **La base de datos existe en Supabase** (27 tablas con RLS, prueba cruzada pasada) y **la identidad ya es real**: registro, login, confirmación de correo y MFA del administrador con Supabase Auth. El `ModoDemo` desapareció. Lo demás —proyectos, catálogo, postulaciones, documentos, encargos— sigue en datos de ejemplo de Zustand, filtrados por el `auth.uid()` real: una cuenta nueva empieza vacía y lo que crea se pierde al recargar.

## Lo último que se hizo

- **Sesión 008: rediseño de las invitaciones de administrador.**
  - El trigger de registro ya no intenta reconocer invitaciones: nunca veía `app_metadata`.
  - El servidor convierte la cuenta con `aceptar_invitacion_admin()`, que solo ejecuta `service_role` y valida que la invitación esté pendiente y vigente, que el correo coincida y que la cuenta sea posterior a la invitación.
  - `privado.admin_vigente()` es la regla única de administrador con privilegios (no revocado y sin invitación vencida sin activar). La usan la RLS y `rol_efectivo()`, que leen `proxy.ts` y `obtenerSesion()`.
  - Migración `20260916160000`, especificación en `docs/05 §9.12`, CU-41, CU-42, RF-86 y `docs/04`.
  - Probado en la prueba de RLS, contra el servicio real de Auth y en `scripts/prueba-matriz-roles.mjs`, que ahora crea su administrador por invitación: 46 comprobaciones que pasan.
- **Sesión 007:** `requireRole()` en `proxy.ts` con panel oculto (404) y corrección del permiso de `service_role`.

Detalle en [`docs/bitacora/2026-09-16-sesion-008.md`](docs/bitacora/2026-09-16-sesion-008.md).

## En curso

Nada a medias en el código. **Falta la prueba en el navegador con sesión iniciada** (ver "Pendiente del Product Owner"): el agente no escribe contraseñas en formularios.

## Lo siguiente — Sprint 1

1. ~~Columnas de propietario (RN-30)~~ — sesión 002.
2. ~~Supabase y migraciones con RLS~~ — sesión 003.
3. ~~Supabase Auth, trial y MFA~~ — sesión 004.
4. ~~`requireRole()` y panel oculto~~ — sesión 007.
5. **← Empezar aquí.** **Gestión de administradores en la app** (CU-41, CU-42, RF-86, RF-87, RN-32). La base ya está rediseñada y probada (sesión 008). Falta:
   - declarar en `lib/autorizacion/matriz.ts` las rutas `/admin/administradores` y `/api/admin/administradores`, `/api/admin/invitaciones`, **solo para el Propietario**, con 404 para los demás administradores (hoy la matriz solo distingue el rol);
   - endpoints, según docs/04 §8.3 y docs/05 §9.12:
     - invitar: `correo_tiene_cuenta` → invitación → `inviteUserByEmail` → `aceptar_invitacion_admin`, y si algo falla, borrar la cuenta;
     - reenviar;
     - cancelar, que borra la cuenta sin activar;
     - revocar, que marca, bloquea en Auth y registra `admin_revocado`;
   - pantalla `/admin/administradores`;
   - `confirmarMfa` marca la invitación `aceptada`.
   - Probar la invitación con un correo real: el enlace de `inviteUserByEmail` y la pantalla `/auth/definir-contrasena`.
6. **Entrada con dos puertas** en landing y login, con la etiqueta "empresa o entidad" (RF-84).

Storage (3 buckets) pasó al Sprint 2 (sesión 006). **Regla nueva:** toda pantalla o endpoint nuevo se declara en `lib/autorizacion/matriz.ts`; si no, responde 404.

**Hito 1 (día 6):** un consultor recibe **404** en `/admin` (como un anónimo y como una ruta inventada) y **403** en `/convocatorias/[id]/generar`; solo el Propietario crea administradores; dos empresas no ven nada la una de la otra en los cuatro listados. Probado, no supuesto. *Sesión 007: la parte de rutas está probada (consultor → 404 en `/admin`, 403 en `/convocatorias/[id]/generar`). El aislamiento entre dos empresas está probado en RLS; los cuatro listados de la app siguen leyendo el mock.*

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
3. **Probar en el navegador con sesión** las cuentas de prueba `empresa.s004@example.com` y `consultor.s004@example.com` (contraseña dada en el chat de la sesión 004, no está en el repositorio): login, navbar con iniciales y "Salir", 3 créditos en el indicador y `/suscripcion` con el trial. El QR de `/mfa` se prueba con la cuenta del Propietario.
4. **SMTP propio antes de los pilotos** (p. ej. Resend): el correo por defecto de Supabase envía muy pocos mensajes por hora.
5. **Cambiar la contraseña de la base de datos** (quedó escrita en el chat de la sesión 003).
6. **Docker Desktop no arranca** en esta máquina: no bloquea (las migraciones se ensayan en una transacción con `ROLLBACK` contra el remoto).

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

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/).
2. Confirmar si alguna decisión abierta se resolvió.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
