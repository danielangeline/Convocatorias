# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 16 de septiembre de 2026 · cierre de la sesión 009
**Sprint:** 1 · día 1 de 30
**Rama de trabajo:** `sprint-1` — `main` y `sprint-1` iguales en `498fc22` al cierre de la sesión 009 (producción despliega la gestión de administradores; la migración `20260916170000` ya está aplicada en Supabase)

---

## Dónde vamos

La especificación está cerrada en **v6**. **La base de datos existe en Supabase** (27 tablas con RLS, prueba cruzada pasada) y **la identidad ya es real**: registro, login, confirmación de correo y MFA del administrador con Supabase Auth. El `ModoDemo` desapareció. Lo demás —proyectos, catálogo, postulaciones, documentos, encargos— sigue en datos de ejemplo de Zustand, filtrados por el `auth.uid()` real: una cuenta nueva empieza vacía y lo que crea se pierde al recargar.

## Lo último que se hizo

- **Sesión 009: gestión de administradores (paso 5 del Sprint 1).**
  - Especificación primero: `docs/05 §9.12` (funciones nuevas, vigencia ampliada a invitaciones canceladas o vencidas, cómo se reenvía, revoca y registra) y `docs/04` (rutas solo del Propietario).
  - Migración `20260916170000`: `crear_invitacion_admin`, `cancelar_invitacion_admin` y `revocar_admin` (solo `service_role`, comprueban al Propietario), `soy_propietario()` para el proxy, y la FK de la invitación con `on delete set null`.
  - Matriz con `soloPropietario`; `proxy.ts` consulta `soy_propietario()`; segunda barrera `sesionDePropietario()`.
  - Endpoints en `app/api/admin/administradores` e `invitaciones`, con la lógica en `lib/admin/administradores.ts`; pantalla `/admin/administradores`, enlazada en el menú solo para el Propietario. `confirmarMfa` marca la invitación `aceptada`.
  - Probado: prueba de RLS (sección 8 nueva), `scripts/prueba-gestion-administradores.mjs` contra Auth real (22) y la matriz (58). **Sin probar con la sesión del Propietario ni con correo real.**
- **Sesión 008:** invitación por aceptación explícita del servidor (`aceptar_invitacion_admin`).

Detalle en [`docs/bitacora/2026-09-16-sesion-009.md`](docs/bitacora/2026-09-16-sesion-009.md).

## En curso

Nada a medias en el código. **Falta la prueba en el navegador con la sesión del Propietario** (ver "Pendiente del Product Owner", punto 3): el agente no tiene ni debe usar sus credenciales, así que los endpoints no se ejercitaron con esa sesión ni se envió un correo real.

## Lo siguiente — Sprint 1

1. ~~Columnas de propietario (RN-30)~~ — sesión 002.
2. ~~Supabase y migraciones con RLS~~ — sesión 003.
3. ~~Supabase Auth, trial y MFA~~ — sesión 004.
4. ~~`requireRole()` y panel oculto~~ — sesión 007.
5. ~~Gestión de administradores en la app~~ — sesión 009. Queda la prueba del Product Owner en el navegador (abajo).
6. **← Empezar aquí.** **Entrada con dos puertas** en landing y login, con la etiqueta "empresa o entidad" (RF-84).

Storage (3 buckets) pasó al Sprint 2 (sesión 006). **Regla nueva:** toda pantalla o endpoint nuevo se declara en `lib/autorizacion/matriz.ts`; si no, responde 404.

**Hito 1 (día 6):** un consultor recibe **404** en `/admin` (como un anónimo y como una ruta inventada) y **403** en `/convocatorias/[id]/generar`; solo el Propietario crea administradores; dos empresas no ven nada la una de la otra en los cuatro listados. Probado, no supuesto. *Sesión 007: la parte de rutas está probada (consultor → 404 en `/admin`, 403 en `/convocatorias/[id]/generar`). El aislamiento entre dos empresas está probado en RLS; los cuatro listados de la app siguen leyendo el mock. Sesión 009: "solo el Propietario crea administradores" está probado en la base y en rutas (otro administrador recibe 404 y no crea nada); falta verlo funcionar con la sesión del Propietario.*

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
3. **Probar la gestión de administradores con la cuenta del Propietario** (sesión 009), en producción (`https://convocatorias-neon.vercel.app`) o en local:
   - `/admin/administradores` aparece en el menú y lista al Propietario;
   - invitar a un correo **que controles y que no tenga cuenta**. Ojo: según la documentación de Supabase, mientras no haya SMTP propio (punto 5) su correo por defecto solo entrega a direcciones del equipo de la organización;
   - abrir el enlace, definir la contraseña en `/auth/definir-contrasena`, activar el MFA y entrar al panel; la invitación debe pasar a "aceptada";
   - reenviar y cancelar una segunda invitación; revocar al administrador de prueba y comprobar que su sesión abierta pierde el panel;
   - en `/admin/seguridad` todavía no se verán los eventos: esa pantalla sigue leyendo el mock.
4. **Probar en el navegador con sesión** las cuentas de prueba `empresa.s004@example.com` y `consultor.s004@example.com` (contraseña dada en el chat de la sesión 004, no está en el repositorio): login, navbar con iniciales y "Salir", 3 créditos en el indicador y `/suscripcion` con el trial. El QR de `/mfa` se prueba con la cuenta del Propietario.
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

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/).
2. Confirmar si alguna decisión abierta se resolvió.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
