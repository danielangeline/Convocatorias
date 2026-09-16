# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 16 de septiembre de 2026 · cierre de la sesión 003
**Sprint:** 1 · día 1 de 30
**Rama de trabajo:** `sprint-1` — sin fusionar a `main`

---

## Dónde vamos

La especificación está cerrada en **v6** y el prototipo implementa el modelo completo en la interfaz, con datos simulados. **La base de datos ya existe en Supabase**: 26 tablas, todas con RLS y su prueba cruzada pasada. La aplicación todavía **no lee de ella**: sigue en Zustand y `ModoDemo`, y no hay autenticación real.

## Lo último que se hizo

- **Paso 2 del Sprint 1 hecho.** CLI de Supabase instalado y enlazado; 8 migraciones aplicadas al proyecto remoto (`supabase/migrations/`).
- **Decisiones del Product Owner** llevadas primero a `docs/05 §9.11`: mínimo privilegio en escritura, documentos sin contador ni creación desde el cliente (RN-17), solicitud activa = `pendiente`/`en_curso` (RF-80), contacto del consultor por permisos de columna.
- **El esquema tiene 26 tablas, no 24**: la cifra se corrigió en toda la documentación.
- **Prueba cruzada** `supabase/tests/rls_aislamiento.sql`: 2 empresas, 2 consultores, admin con y sin MFA y anónimo; pasa completa contra la base remota y no deja datos.
- **RNF-25, RN-24, RF-10, RF-39 y RF-49 pasan a `servidor`.** Los demás conservan su estado con la mitad RLS lista.

Detalle en [`docs/bitacora/2026-09-16-sesion-003.md`](docs/bitacora/2026-09-16-sesion-003.md).

## En curso

Nada. Sesión cerrada limpiamente.

## Lo siguiente — Sprint 1

1. ~~Columnas de propietario (RN-30) sobre mocks~~ — sesión 002.
2. ~~Proyecto Supabase y migraciones con RLS~~ — sesión 003.
3. **← Empezar aquí.** **Supabase Auth con los tres roles**, reemplazando `lib/session.ts` y el `ModoDemo`. Incluye el trigger que crea `perfiles` al registrarse (el rol nace como `empresa` o `consultor`, nunca `administrador` — RN-06), el trial de 14 días con 3 créditos (RF-37) y el enrolamiento MFA del admin (RNF-28). Las migraciones se escriben en `supabase/migrations/` y se aplican con `npx supabase db push --linked`; tras cada cambio de esquema, correr `npx supabase db query --linked -f supabase/tests/rls_aislamiento.sql`.
4. **`requireRole()` en toda ruta y endpoint** (RNF-30) — corrige de paso la condición invertida de `components/GuardaMFA.tsx:26`.

**Hito 1 (día 6):** un consultor recibe 403 en `/admin` y en `/convocatorias/[id]/generar`; dos empresas no ven nada la una de la otra en los cuatro listados. Probado, no supuesto. *La mitad RLS de este hito ya está probada; falta la de rutas y endpoints.*

## Infraestructura que ya existe

- **Repositorio oficial (desde el 16-sep): `https://github.com/danielangeline/Convocatorias`**, remoto `origin`. El anterior, `DanielBohorquezP/Convocatorias`, queda como remoto `anterior` y ya no recibe pushes. La cuenta de la máquina (DanielBohorquezP) es colaboradora y ya subió `main`, `auditoria-v6` y `sprint-1`. Vercel ya está reconectado al repositorio nuevo (confirmado por el Product Owner en la sesión 003).
- **Vercel está conectado al repositorio.** Cada push a `main` despliega a producción y cada push a otra rama crea una vista previa. El entregable "CI/CD en Vercel" del Sprint 1 **ya está cubierto**, con las variables de Supabase ya cargadas.
- **Supabase** (`lqrqhehwqyphtdzplxhv`): enlazado con el CLI (`npx supabase`, dependencia de desarrollo). Esquema en `supabase/migrations/`, prueba de RLS en `supabase/tests/rls_aislamiento.sql`, 3 jobs en `pg_cron`.
- **Producción:** `https://convocatorias-gamma.vercel.app`. Es la única URL que siempre sirve lo último.
- Las URLs con código (`convocatorias-xxxxxxxx-danielbohorquezps-projects.vercel.app`) apuntan a un despliegue fijo y **están protegidas con el inicio de sesión de Vercel**: no sirven para verificar desde fuera.
- `.gitignore` ya excluye `.env*`, así que las claves locales no se suben al repositorio.

## Bloqueos

Ninguno. La clave de servicio se rotó y las variables están cargadas en Vercel (confirmado en la sesión 003).

Pendiente del Product Owner que no bloquea:

1. **Cambiar la contraseña de la base de datos**: en la sesión 003 se escribió en el chat por error, en lugar del identificador del proyecto. Supabase → *Project Settings → Database → Reset database password*. El CLI ya enlazado no la necesita de nuevo.
2. **Docker Desktop no arranca en esta máquina** (se cierra al abrirlo). No bloquea, porque las migraciones se prueban contra el proyecto remoto dentro de una transacción con `ROLLBACK`; pero impide tener una base local para probar antes de aplicar.

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
| La transición de estados de la postulación (RF-83) no se valida en la base: RLS deja a la dueña poner cualquier estado | `postulaciones` | media · validar en el endpoint o con trigger en el Sprint 2 |

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/).
2. Confirmar si alguna decisión abierta se resolvió.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
