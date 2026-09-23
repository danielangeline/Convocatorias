# Plataforma de Gestión de Convocatorias

Aplicación web que ayuda a empresas colombianas a **encontrar convocatorias de financiación, generar con IA el documento base de postulación, preparar la postulación y contratar consultores**. Monetiza con suscripción mensual/anual por rol; los planes de **empresa** se diferencian por créditos de IA, el de **consultor** por acceso al directorio y a los encargos.

**Especificación vigente: v6.** Este archivo es el contexto mínimo. El detalle vive en `docs/` y se lee **bajo demanda**, no completo.

---

## Lo primero de cada sesión

El proyecto está en desarrollo activo con un plan de 30 días. **Antes de tocar nada:**

1. Lee **[`ESTADO.md`](ESTADO.md)** — sprint actual, qué está hecho, qué está en curso, qué bloquea y cuál es el siguiente paso.
2. Lee la **última entrada de [`docs/bitacora/`](docs/bitacora/)** — qué se decidió y qué quedó abierto.

**Antes de cerrar la sesión, siempre —aunque haya sido corta:**

3. Actualiza `docs/11-avance-por-requerimiento.md` con los requerimientos que cambiaron de estado.
4. Actualiza `ESTADO.md`.
5. Escribe la entrada de bitácora con la plantilla de `docs/bitacora/PLANTILLA.md`.
6. Haz commit citando los `RF-xx`/`RNF-xx` tocados.

El ritual completo y la definición de terminado están en `docs/10-plan-de-desarrollo.md §17`. **Sin ese cierre, la siguiente sesión empieza a ciegas y repite trabajo.**

Reglas que se rompen con facilidad:

- **Un requerimiento no está hecho porque funcione en pantalla.** Si la regla vive en `lib/store.ts` y no en el servidor, su estado es `prototipo`, no `servidor` (RNF-20).
- **Lo que aparece de paso no se arregla de paso.** Se anota en "Hallazgos no planificados" de `ESTADO.md` y se planifica.
- **Ante un fallo que no se reproduce en un caso mínimo, descarta primero el entorno** antes de tocar código o migraciones: la red local (`scripts/diagnostico-red-supabase.mjs`) y el desfase del reloj frente a Supabase. Los dos costaron sesiones enteras en el Sprint 2 (`docs/incidentes/`).

---

## Reglas de producto que nunca se rompen

1. **La plataforma NO radica postulaciones.** La presentación se hace en el portal de la entidad convocante. Aquí se *prepara*: buscar, evaluar compatibilidad, generar el documento base, organizar el checklist y hacer seguimiento. (RN-19)
2. **Veracidad del contenido generado.** La IA nunca inventa datos, cifras ni antecedentes que no vengan del proyecto del usuario o de la convocatoria. Lo que falte se marca como `[COMPLETAR: ...]` y se lista al usuario. (RNF-23, RF-57)
3. **La IA se usa en un solo lugar:** generar el documento base de postulación. **No** estructura el catálogo ni hace matching semántico — el matching es un cruce determinístico de atributos. (RN-05)
4. **Las convocatorias se cargan manualmente** por un administrador. Sin scraping en el MVP.
5. **Un crédito por generación exitosa.** Una generación fallida **nunca** consume crédito. 3 ajustes con IA gratis por documento. (RN-17)
6. **Suscripción y cupo se validan en el servidor y en RLS**, nunca solo en la interfaz. (RNF-20)
7. **La plataforma no intermedia el pago de los encargos** entre empresa y consultor. Los ingresos vienen de las suscripciones. (RN-14)
8. **Ninguna tabla se despliega sin RLS con política explícita, y ninguna sesión administrativa opera sin MFA verificado.** Ambos son requisitos de diseño desde el Sprint 0, no revisiones posteriores. (RN-24, RNF-25, RNF-28)
9. **Toda entidad de usuario declara su propietario y ningún listado se sirve sin filtrar por él** (RN-30), y **toda ruta y endpoint declara los roles que admite** (RNF-30). Ocultar un botón no es autorizar: el control vive en el servidor. También son requisitos de Sprint 0.
10. **El consultor no tiene cupo propio de créditos de IA.** No genera documentos; los ajustes que pide sobre un documento autorizado los paga siempre la empresa dueña, y no existe caso de respaldo que cargue el consumo a quien dispara la acción. (RN-28)
11. **El rol administrador solo lo otorga el Propietario, por invitación, y el panel no existe para nadie más.** Ningún registro ni dato enviado por el usuario produce un administrador; hay un único Propietario, designado fuera de la aplicación; la cuenta de administrador es dedicada. `/admin`, `/mfa` y `/api/admin` responden 404 a quien no es administrador. (RN-06, RN-31, RN-32, RF-85, RF-86)

---

## Los tres roles

| Rol | Qué hace | Acceso |
|---|---|---|
| **Empresa** (o entidad) | Busca convocatorias, registra proyectos, genera documentos con IA, postula, contrata consultores | Registro libre + trial 7 días con 3 créditos |
| **Consultor** | Perfil con portafolio/CV/redes, recibe y ejecuta encargos, recibe calificaciones. **No genera documentos ni tiene cupo propio de IA** (RN-28) | Requiere **aprobación de un administrador** antes de operar |
| **Administrador** | Fuentes, convocatorias, requisitos, aprobación de consultores, planes y créditos, plantilla del prompt, seguridad y auditoría | **Solo por invitación del Propietario** (RN-06, RN-31) con cuenta dedicada + **MFA obligatorio** (RNF-28). El panel es invisible (404) para todos los demás (RF-85) |

## Flujos centrales

```
ENTRADA       dos puertas: "Soy empresa o entidad" / "Soy consultor" → registro fija el rol ·
              login lleva al portal del rol (sin opción de administrador en ninguna pantalla pública)
ADMINS        Propietario → invita por correo → la persona define contraseña + MFA → panel · revocar
CATÁLOGO      (solo cuentas de empresa, RN-33) buscar/filtrar → ficha → [Postular] o [Generar documento con IA]
SUGERENCIAS   proyecto registrado → cruce de atributos → % de compatibilidad + desglose
GENERACIÓN    convocatoria → elegir proyecto → generar (1 crédito) → editar → exportar .docx
POSTULACIÓN   crear → checklist copiado de los requisitos → avance → estados con historial
ENCARGOS      proyecto → tipo de ayuda (convocatoria específica o buscar convocatoria) → directorio
              o asignación interna → aceptación (revela contacto) → ejecución → calificar
```

## Stack

Next.js (App Router) + TypeScript + Tailwind, desplegado en **Vercel**. Backend con **Supabase**: PostgreSQL con RLS, Auth (3 roles), Storage (3 buckets) y pg_cron (3 jobs diarios). La IA es **Claude API**, aislada tras una interfaz propia (RNF-22).

## Convenciones

- Todo el producto y el código de cara al usuario está **en español**; montos en **COP**.
- Paleta: azul `#1F3864` (base), rojo `#8A2A21` (módulo de consultores), verde azulado `#0F766E` (módulo de IA y créditos).
- Los identificadores `CU-xx`, `RF-xx`, `RNF-xx` y `RN-xx` son la referencia canónica: al implementar o discutir una funcionalidad, cítalos.

---

## Dónde buscar el detalle (`docs/`)

| Necesitas… | Lee |
|---|---|
| Alcance, actores, métricas de éxito | `docs/00-contexto-y-alcance.md` |
| Flujos paso a paso, precondiciones, alternos | `docs/01-casos-de-uso.md` |
| Qué debe hacer el sistema (RF-01..87) | `docs/02-requerimientos-funcionales.md` |
| Rendimiento, seguridad, veracidad, reglas de negocio | `docs/03-requerimientos-no-funcionales.md` |
| Capas, rutas de pantallas, endpoints, servicios | `docs/04-arquitectura.md` |
| **Tablas, columnas, RLS, índices, SQL** | `docs/05-modelo-de-datos.md` |
| Procesos core vs. tercerizables | `docs/06-procesos-de-negocio.md` |
| Planes, precios, créditos, competencia | `docs/07-modelo-de-negocio.md` |
| Sprints, hitos, qué viene después del MVP | `docs/08-roadmap.md` (cronograma original de 18 semanas) |
| **El plan de 30 días en curso, ceremonias y definición de terminado** | `docs/10-plan-de-desarrollo.md` |
| **Qué requerimiento está hecho y cuál falta** | `docs/11-avance-por-requerimiento.md` |
| **Qué se hizo en cada sesión y por qué** | `docs/bitacora/` |
| Qué RF/RNF cubre cada caso de uso | `docs/09-trazabilidad.md` |
| Todo junto (solo si hace falta) | `docs/99-especificacion-completa.md` |
| Cómo levantar el proyecto localmente | `docs/INSTRUCCIONES-INSTALACION.md` |

Diagramas en `docs/diagramas/`: arquitectura v4 (pendiente de actualizar a v6), modelo de datos base, módulo de consultores y módulo de IA.

**Antes de implementar una pantalla o endpoint, lee el caso de uso correspondiente y su requerimiento.** No infieras el comportamiento: está escrito. Al agregar un CU o RF nuevo, continúa la numeración y añádelo también a `docs/09-trazabilidad.md`.

## Ruta para modificar arquitectura, RF/RNF o casos de uso

Este proyecto documenta primero y programa después (ver regla de `docs/README.md`: *"si el código y estos documentos se contradicen, gana el documento"*). Para **agregar una funcionalidad nueva** o **modificar/editar una existente**, sigue este orden — nunca empieces por el código:

### 1. Ubica qué tipo de cambio es y qué documento se edita primero

| El cambio afecta… | Edita primero | Formato a seguir |
|---|---|---|
| Un flujo de pantalla, un actor, precondiciones/postcondiciones | `docs/01-casos-de-uso.md` | Sigue la numeración `CU-xx`; si es nuevo, usa el siguiente número libre y márcalo con la versión vigente —hoy `(nuevo v6)`—; si modificas uno existente, `(mod. v6)` |
| Qué debe hacer el sistema (un comportamiento concreto) | `docs/02-requerimientos-funcionales.md` | Numeración `RF-xx` continua, con prioridad MoSCoW (Must/Should) y el `CU` al que pertenece |
| Seguridad, rendimiento, disponibilidad, veracidad de IA | `docs/03-requerimientos-no-funcionales.md` | Numeración `RNF-xx`, con criterio de verificación medible |
| Una regla de negocio transversal (no un flujo, una restricción) | `docs/03-requerimientos-no-funcionales.md` §6 | Numeración `RN-xx` |
| Capas, rutas de pantalla, endpoints, servicios | `docs/04-arquitectura.md` | Actualiza la tabla de rutas del portal correspondiente y/o la tabla de endpoints |
| Tablas, columnas, índices, RLS | `docs/05-modelo-de-datos.md` | Agrega la columna/tabla con tipo y restricción; revisa si necesita índice o política RLS nueva |
| Qué se terceriza o no | `docs/06-procesos-de-negocio.md` | — |
| Precio, plan, créditos, competencia | `docs/07-modelo-de-negocio.md` | — |
| Fecha, sprint, fase posterior al MVP | `docs/10-plan-de-desarrollo.md` (plan en curso) y `docs/08-roadmap.md` (fases E1–E10) | Si cambia el plan de sprints, refléjalo también en `ESTADO.md` |

Si el cambio es amplio (por ejemplo, un módulo nuevo), es normal que toque varios de estos documentos a la vez — ese es justo el caso de "generación documental con IA" en v4, que tocó CU, RF, RNF, arquitectura y modelo de datos juntos.

### 2. Antes de editar, lee las dependencias

Revisa `docs/09-trazabilidad.md` para ver qué CU, RF y RNF/RN ya están relacionados con lo que vas a tocar — así no rompes algo que depende de ese comportamiento sin darte cuenta. Si tu cambio introduce una relación nueva (p. ej. un RF nuevo que depende de un CU existente), agrégala a esa matriz.

### 3. Edita el o los documentos

- Continúa la numeración existente (nunca reutilices un ID retirado).
- Si el comportamiento cambia RN-19, RN-20, RN-05, RN-17 o cualquier otra que esté citada en "Reglas de producto que nunca se rompen" (arriba en este archivo), actualiza también esa sección de `CLAUDE.md`.
- Si agregas o cambias una tabla en `docs/05-modelo-de-datos.md`, revisa si `docs/04-arquitectura.md` necesita un endpoint nuevo o modificado.
- Actualiza `docs/09-trazabilidad.md` con las nuevas filas o relaciones.

### 4. Solo después, implementa en el código

Con el documento ya actualizado como fuente de verdad, traduce el cambio al prototipo siguiendo el mapeo de la sección siguiente ("Estructura del código"): tipos en `lib/types.ts`, datos semilla en `lib/mock-data.ts`, lógica de negocio en `lib/store.ts`, pantallas en `app/`. Cita el `CU-xx`/`RF-xx` correspondiente en el commit o en comentarios donde no sea obvio, igual que hace la documentación.

### 5. Si algo es ambiguo, no lo inventes

Si una funcionalidad nueva no tiene un requerimiento claro que la respalde, o si modificar uno existente puede romper una regla de negocio (`RN-xx`) no declarada como tal, pregunta antes de asumir el comportamiento — es exactamente el error que RN-19/RN-20/RNF-23 existen para prevenir en el propio producto (no inventar lo que falta), y aplica igual al proceso de especificarlo.

## Estructura del código (prototipo actual)

El código ya sigue la organización de `docs/04-arquitectura.md`. Antes de crear un archivo nuevo, ubica dónde encaja:

```
app/(portal)/          → Portal Empresa: convocatorias, proyectos, documentos,
                          postulaciones, consultores, encargos, suscripción
app/consultor/         → Portal Consultor: perfil, encargos, documentos, suscripción
app/admin/             → Panel Administrador: fuentes, convocatorias, categorías,
                          consultores/revision, encargos, planes, plantillas, suscripciones
components/            → Componentes compartidos (Navbar, cards, modales, badges)
components/ui/         → Primitivas de UI (Button, Chip, Badge, ProgressBar, EmptyState)
lib/types.ts           → Todos los tipos. Siguen el esquema de docs/05-modelo-de-datos.md,
                          incluidas las columnas de propietario (RN-30)
lib/mock-data.ts       → Datos semilla (reemplazar por Supabase en la fase de backend)
lib/store.ts           → Estado global con Zustand: toda la lógica de negocio del
                          prototipo vive aquí (crear proyecto, generar documento,
                          consumir crédito, cambiar estado de postulación, etc.)
lib/documentos.ts       → Composición del documento generado y aplicación de ajustes de IA
lib/proyectos.ts        → Cálculo del indicador de completitud del proyecto (RF-46)
lib/planes.ts           → Beneficios de cada plan derivados del dato del plan (RF-82)
lib/hooks.ts            → Sesión simulada, créditos y listados filtrados por propietario
                          (useProyectosPropios, etc. — RN-30): el portal Empresa lee de aquí
lib/session.ts          → Simulador de sesión/rol: **no hay auth real todavía**.
                          `ModoDemo` (empresa_trial, empresa_vencida, empresa_sin_creditos,
                          consultor_aprobado, consultor_revision, admin) sustituye a
                          Supabase Auth + RLS mientras no hay backend
```

**Importante para features nuevas:** mientras no exista backend, toda regla de negocio (RN-xx) que en producción sería enforcement en servidor/RLS (RNF-20) se implementa en `lib/store.ts` contra el `ModoDemo` activo. Al conectar Supabase, esa lógica se traslada a API routes + políticas RLS (ver `docs/04-arquitectura.md` §8.3 y `docs/05-modelo-de-datos.md` §9.5), y `session.ts` se reemplaza por Supabase Auth.

## Estado actual

**El estado del trabajo no se mantiene en este archivo: vive en [`ESTADO.md`](ESTADO.md)**, que se actualiza al cierre de cada sesión. Tener el estado en dos sitios es la forma más rápida de que uno de los dos mienta.

Lo único estable que conviene saber de entrada:

- El prototipo implementa el modelo **v6** en la interfaz, contra datos simulados (Zustand + `ModoDemo`). **No hay backend ni autenticación real.**
- La especificación va **por delante** del código: RF-76..80 y RNF-30..33 están escritos y sin construir. Hasta que un requerimiento no figure como `servidor` o `verificado` en `docs/11-avance-por-requerimiento.md`, no está hecho, aunque funcione en pantalla.
- El desarrollo sigue el plan de 30 días de `docs/10-plan-de-desarrollo.md`, en cinco sprints de seis días. A partir del Sprint 1 las reglas dejan de implementarse en `lib/store.ts` y pasan a API routes, migraciones y políticas RLS.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
