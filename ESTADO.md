# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 16 de septiembre de 2026 · cierre de la sesión 002
**Sprint:** 1 · día 1 de 30
**Rama de trabajo:** `sprint-1` — sin fusionar a `main`

---

## Dónde vamos

La especificación está cerrada en **v6** y el prototipo implementa el modelo completo en la interfaz, con datos simulados. **No hay backend.** El Sprint 1 arrancó: el paso 1 del día 1 (propiedad del dato, RN-30) está hecho sobre mocks; el paso 2 espera las claves de Supabase.

Dos auditorías cerraron esta etapa —una de implementación y otra de interfaz— y produjeron 14 requerimientos nuevos (RF-76..83, RNF-30..34, RN-30). Los de usabilidad ya están implementados; los de seguridad están escritos y **pendientes de construir**.

## Lo último que se hizo

- **RN-30 en prototipo:** `usuarioId` en `Proyecto`, `Postulacion` y `DocumentoGenerado`; el propietario lo fija la sesión al crear, incluido `empresaId` de los encargos, que estaba fijo a `empresa-1`.
- Listados y fichas del portal Empresa filtrados por propietario (`lib/hooks.ts`); el store ignora ediciones sobre registros ajenos.
- Datos semilla de `empresa-4` y `empresa-2` para que la prueba cruzada tenga qué ocultar.
- **RNF-03 probado sobre mocks:** empresa-1 y empresa-4 no se ven entre sí en los 4 listados ni por URL directa; 11/11 comprobaciones del store.
- De paso, por la misma columna: RN-28 (el crédito ya no puede recaer en el consultor) y RF-80 (contacto por pareja).

Detalle en [`docs/bitacora/2026-09-16-sesion-002.md`](docs/bitacora/2026-09-16-sesion-002.md).

## En curso

Nada. Sesión cerrada limpiamente.

## Lo siguiente — Sprint 1

Por orden, porque cada uno desbloquea al siguiente:

1. ~~Columnas de propietario (RN-30) sobre mocks~~ — hecho en la sesión 002 (estado `prototipo`).
2. **Proyecto Supabase y migraciones** de las 24 tablas, cada una con su política RLS en el mismo commit (RNF-25, RN-24). El esquema está en `docs/05-modelo-de-datos.md §9.1–9.10`.
3. **Supabase Auth con los tres roles**, reemplazando `lib/session.ts` y el `ModoDemo`.
4. **`requireRole()` en toda ruta y endpoint** (RNF-30) — corrige de paso la condición invertida de `components/GuardaMFA.tsx:26`.

**Hito 1 (día 6):** un consultor recibe 403 en `/admin` y en `/convocatorias/[id]/generar`; dos empresas no ven nada la una de la otra en los cuatro listados. Probado, no supuesto.

## Infraestructura que ya existe

- **Repositorio oficial (desde el 16-sep): `https://github.com/danielangeline/Convocatorias`**, remoto `origin`. El anterior, `DanielBohorquezP/Convocatorias`, queda como remoto `anterior` y ya no recibe pushes. **Pendiente:** la cuenta autenticada en la máquina (DanielBohorquezP) no tiene permiso de escritura en el nuevo, y Vercel sigue conectado al anterior.
- **Vercel está conectado al repositorio.** Cada push a `main` despliega a producción y cada push a otra rama crea una vista previa. El entregable "CI/CD en Vercel" del Sprint 1 **ya está cubierto**; solo faltará cargar ahí las variables de entorno de Supabase.
- **Producción:** `https://convocatorias-gamma.vercel.app`. Es la única URL que siempre sirve lo último.
- Las URLs con código (`convocatorias-xxxxxxxx-danielbohorquezps-projects.vercel.app`) apuntan a un despliegue fijo y **están protegidas con el inicio de sesión de Vercel**: no sirven para verificar desde fuera.
- `.gitignore` ya excluye `.env*`, así que las claves locales no se suben al repositorio.

## Bloqueos

**Para el paso 2 — es lo que bloquea ahora mismo.** Al abrir la sesión 002 seguía sin existir `.env.local`. El agente no puede crear cuentas ni escribir claves, así que esto lo hace el Product Owner:

1. Crear el proyecto en [supabase.com](https://supabase.com) (región recomendada: la más cercana a Colombia, `us-east-1`).
2. Crear en la raíz del repositorio un archivo `.env.local` con la URL del proyecto y las dos claves:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — **nunca** con prefijo `NEXT_PUBLIC_`: esta clave se salta RLS y solo puede vivir en el servidor (RNF-26).
3. Cargar las mismas tres variables en Vercel → *Settings* → *Environment Variables*.

Las claves no se pegan en el chat. El agente solo necesita que existan; el código las lee del entorno.

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
| Sin guarda de propietario en las mutaciones de documento (editar sección, exportar, compartir): hoy solo las protege la ficha | `lib/store.ts` | media · entra con RNF-30 / RN-27 |

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/).
2. Confirmar si alguna decisión abierta se resolvió.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
