# Plan de desarrollo — 30 días

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.
> **Estado vivo del trabajo: [`ESTADO.md`](../ESTADO.md) en la raíz.**

---

## 16. Por qué este plan existe y en qué se diferencia del cronograma v4

`docs/08-roadmap.md` describe el cronograma original: **18 semanas, 9 sprints, un equipo de seis personas**. Sigue siendo la referencia de cómo se construiría esto con un equipo completo, y no queda derogado.

Este documento plantea otra cosa: **llevar el MVP a producción en 30 días con una persona y un agente de IA**. Es viable por una razón concreta, no por optimismo: **el prototipo ya implementa el modelo v6 completo en la interfaz** —37 pantallas, los tipos, y las reglas de negocio en `lib/store.ts`—. Lo que falta no es inventar el producto, es **sustituir la capa de datos simulada por Supabase y hacer cumplir en el servidor las reglas que hoy solo viven en el cliente**.

Dicho de otro modo: los sprints 1 a 7 del cronograma v4 produjeron pantallas; aquí esas pantallas ya existen. El trabajo de 30 días es el Sprint 0 más el endurecimiento.

### 16.1 Lo que este plazo asume, y lo que pone en riesgo

Tres cosas no dependen de la velocidad de programación y conviene decirlas antes de empezar:

| Riesgo | Por qué no se resuelve programando más rápido | Mitigación en el plan |
|---|---|---|
| **Medir el costo real de IA sobre 20 generaciones con TDR colombianos** (RNF-21, `docs/07 §10.3`) | Requiere 20 TDR reales y juicio experto sobre la calidad del resultado | Se reserva el Sprint 4 completo y se aceptan 10 TDR como mínimo viable; el precio definitivo queda como decisión abierta |
| **Piloto con 3 usuarios reales** (RNF-07) y **≥50 convocatorias publicadas** (métrica de éxito) | Depende de personas y de carga manual de contenido, no de código | Se saca del plazo de 30 días: el día 30 entrega la plataforma en producción, no el piloto ejecutado |
| **Auditoría de veracidad sobre 10 documentos** (RNF-23) | Necesita revisión experta, no automatizable | Se ejecuta en el Sprint 5 con proyectos deliberadamente incompletos |

**Compromiso del día 30:** la aplicación completa en producción, con las 26 tablas bajo RLS, los tres portales funcionando contra datos reales, la generación con IA operativa y los 83 RF verificados. **No** incluye el piloto con usuarios ni el catálogo poblado con 50 convocatorias reales: eso es trabajo de contenido que corre en paralelo y después.

---

## 17. Scrum adaptado a una persona y un agente

Scrum supone un equipo que se sincroniza entre sí. Aquí hay una persona que decide y un agente que ejecuta entre sesiones que pueden estar separadas por horas o días. La adaptación no es ceremonial: **sustituye la memoria del equipo por archivos en el repositorio**.

### 17.1 Roles

| Rol de Scrum | Aquí |
|---|---|
| Product Owner | El fundador. Decide alcance, prioridad y acepta lo terminado. Es quien resuelve las decisiones abiertas que la bitácora deja marcadas |
| Equipo de desarrollo | El agente, dentro de cada sesión |
| Scrum Master | Lo sustituye este plan más el ritual de sesión: nadie recuerda el estado, **lo lee de `ESTADO.md`** |

### 17.2 Ceremonias, traducidas a sesiones

| Ceremonia | Cuándo | Qué es en la práctica |
|---|---|---|
| **Daily** | Al abrir **cada** sesión | Leer `ESTADO.md` y la última entrada de `docs/bitacora/`. Son dos minutos y son lo que evita repetir trabajo o contradecir una decisión ya tomada |
| **Planning** | Primera sesión de cada sprint | Elegir del backlog de abajo lo que entra, y escribirlo en `ESTADO.md` |
| **Review** | Última sesión de cada sprint | Comprobar el hito contra su criterio de verificación, con evidencia (captura, salida de consola, prueba) en la bitácora |
| **Retrospectiva** | Junto con la Review | Una sección en la entrada de bitácora: qué frenó, qué ajustar. Si sale una regla estable, se sube a `CLAUDE.md` |

### 17.3 Ritual de sesión

Es la parte que hace que todo lo demás funcione. Está descrito también en `CLAUDE.md` para que se cargue de entrada.

**Al abrir sesión**
1. Leer [`ESTADO.md`](../ESTADO.md) — dónde vamos, qué está en curso, qué bloquea.
2. Leer la última entrada de `docs/bitacora/`.
3. Confirmar con el Product Owner si hay decisiones abiertas que lo afecten.

**Durante**
4. Trabajar sobre la tarea del sprint activo, citando el `RF-xx`/`RNF-xx` correspondiente.
5. Si aparece algo fuera de alcance, **no** desviarse: anotarlo en `ESTADO.md` bajo "Hallazgos no planificados".

**Al cerrar sesión — obligatorio, aunque la sesión haya sido corta**
6. Actualizar [`docs/11-avance-por-requerimiento.md`](11-avance-por-requerimiento.md) con los requerimientos que cambiaron de estado.
7. Actualizar `ESTADO.md`: hecho, en curso, siguiente, bloqueos.
8. Escribir la entrada en `docs/bitacora/` siguiendo la plantilla.
9. Commit citando los identificadores tocados.

> **Si una sesión se corta sin cerrar el ritual**, la siguiente empieza reconstruyendo el estado desde `git log` y dejando constancia de ello en la bitácora. Es el único caso en que la bitácora se escribe en pasado y con incertidumbre; conviene evitarlo.

### 17.4 Definición de terminado

Una tarea no está hecha hasta que cumple **las siete**:

1. El `RF-xx`/`RNF-xx` que la respalda está citado en el commit.
2. `npx tsc --noEmit` y `npm run lint` sin errores nuevos.
3. La regla se hace cumplir **en el servidor**, no solo en la interfaz (RNF-20).
4. Si toca una tabla, tiene su política RLS escrita y probada (RNF-25, RN-24).
5. Verificada de verdad —navegador, consulta o prueba— con la evidencia en la bitácora.
6. `docs/11-avance-por-requerimiento.md` refleja el nuevo estado.
7. `ESTADO.md` actualizado.

---

## 18. Los cinco sprints

Cinco sprints de seis días. Cada uno cierra con un hito verificable, no con una lista de tareas terminadas.

### Sprint 1 · Días 1–6 — Cimientos: datos, identidad y autorización

Lo primero es lo que el prototipo no puede simular y lo que más caro sale corregir tarde.

| Entregable | Requerimientos |
|---|---|
| Proyecto Supabase, migraciones de las 26 tablas, **cada una con su política RLS en el mismo commit** | RNF-25, RN-24 |
| Columnas de propietario en proyectos, postulaciones, documentos generados y encargos | **RN-30** |
| Supabase Auth con los tres roles; `lib/session.ts` y el `ModoDemo` desaparecen | RF-01, RF-02, RN-06 |
| Middleware `requireRole()` en toda ruta y endpoint | **RNF-30** |
| MFA obligatorio para administradores | RNF-28, RF-64 |
| Storage: 3 buckets, hoja de vida privada con URLs firmadas de 15 min | RNF-16, RNF-18 |
| CI/CD en Vercel con despliegue de vista previa | — |

**Hito 1 —** Un consultor autenticado recibe **403** en `/admin` y en `/convocatorias/[id]/generar`; dos empresas distintas no ven nada la una de la otra en ninguno de los cuatro listados. Ambas cosas probadas, no supuestas.

---

### Sprint 2 · Días 7–12 — Catálogo y administración de contenido

| Entregable | Requerimientos |
|---|---|
| Endpoints de fuentes, convocatorias, categorías, requisitos y documentos adjuntos | RF-04..08 |
| Publicación validada en servidor, incluido el enlace oficial | RF-09, RN-01, RNF-29 |
| Catálogo, filtros, chips e indicadores de la landing contra datos reales | RF-11, 12, 13, 43, 44 |
| Cerradas fuera del listado salvo filtro explícito | RF-11, RN-02 |
| Job diario de cierre de convocatorias | RF-10, CU-06 |
| Vigencia verificada en servidor al postular y al generar | **RF-78** |

**Hito 2 —** Un administrador carga una convocatoria real de principio a fin —datos, adjuntos, requisitos, enlace— y aparece en el catálogo público; una vencida desaparece sola al correr el job.

---

### Sprint 3 · Días 13–18 — Proyectos, sugerencias y postulaciones

| Entregable | Requerimientos |
|---|---|
| Proyectos con datos de contenido y completitud, filtrados por propietario | RF-14, 45, 46, 47, **81** |
| Sugerencias con porcentaje y desglose, indexadas, solo vigentes | RF-15, 16, RN-05, RNF-05 |
| Postulaciones con checklist copiado de los requisitos | RF-17, 18, RN-04 |
| Estados según el grafo de transiciones, validados en servidor | **RF-83** |
| Enlace al portal de la entidad como acción primaria | **RF-73**, RN-19 |

**Hito 3 —** Una empresa registra un proyecto, recibe sugerencias ordenadas por compatibilidad, inicia una postulación y avanza su checklist. Todo persistido y aislado por RLS.

---

### Sprint 4 · Días 19–24 — Generación con IA, créditos y suscripciones

El sprint con más riesgo técnico y el único que depende de un proveedor externo.

| Entregable | Requerimientos |
|---|---|
| Servicio de generación **aislado tras interfaz propia** | RNF-22 |
| Claude API con la plantilla versionada y las reglas de veracidad | RF-53..57, 62, 63, RNF-23 |
| Saneamiento del texto del TDR antes del prompt | RN-23, **RNF-31** |
| Créditos: consumo por generación exitosa, cupos, ajustes gratis, reinicio mensual | RF-48..52, RN-17, RN-18 |
| Validación del cupo de la empresa dueña en los ajustes del consultor | **RF-77** |
| Planes con sus atributos diferenciadores leídos del dato | **RF-82**, RNF-14 |
| Exportación **.docx real** (hoy es HTML disfrazado) | RF-60 |
| Medición de costo y tokens sobre generaciones reales | RF-52, RNF-24, RNF-21 |

**Hito 4 —** Un documento generado a partir de un proyecto incompleto, con los pendientes marcados y **ningún dato inventado**, editado, ajustado y exportado a Word; con su costo por generación registrado.

---

### Sprint 5 · Días 25–30 — Consultores, encargos y endurecimiento

| Entregable | Requerimientos |
|---|---|
| Perfil del consultor, revisión y aprobación, directorio | RF-22..27, 34, 35, RN-08, RN-13 |
| Visibilidad de contacto por pareja empresa-consultor | **RF-80**, RN-12 |
| Encargos de punta a punta, contacto al aceptar, avances, calificación | RF-28..33, 68, 69, 70, RN-09, RN-26 |
| Autorización de documentos y **revocación automática en cascada** | RF-71, 72, **76**, RN-27 |
| Traza de lectura de documentos compartidos | **RF-79**, RNF-11 |
| Límite de tasa con comportamiento fail-closed | RNF-27, **RNF-33** |
| Jobs de vencimiento de suscripciones y reinicio de créditos | RF-39, CU-32, CU-35 |
| Pruebas de los RNF críticos y despliegue a producción | RNF-01..04, 09..12, 20, 25..34 |

**Hito 5 —** Un encargo completo: solicitud, aceptación con revelación de contacto, documento autorizado y editado por el consultor, entrega y calificación. Y al suspender a ese consultor, **pierde el acceso al documento sin que nadie intervenga**.

---

## 19. Lo que queda fuera de los 30 días

No por falta de tiempo, sino porque no es construcción de software:

- **Carga de ≥50 convocatorias reales** — trabajo de contenido del administrador, en paralelo desde el Sprint 2.
- **Piloto con 3 empresas y 5 consultores** — empieza cuando la plataforma esté en producción.
- **Conversión de trial a pago, encargos completados** — métricas que necesitan usuarios y semanas.
- **Todo lo de `docs/08-roadmap.md §14`** (fases E1–E10): pasarela Wompi, alertas por correo, extracción de TDR, matching semántico, scraping.

---

## 20. Registro del trabajo

| Archivo | Qué contiene | Cada cuánto cambia |
|---|---|---|
| [`ESTADO.md`](../ESTADO.md) | Dónde vamos hoy: sprint, hecho, en curso, siguiente, bloqueos | **Cada sesión** |
| [`docs/11-avance-por-requerimiento.md`](11-avance-por-requerimiento.md) | Los 83 RF y 34 RNF con su estado de implementación | Cada sesión que cambie alguno |
| [`docs/bitacora/`](bitacora/) | Una entrada por sesión: qué se hizo, qué se decidió, qué quedó abierto | **Cada sesión** |
| `git log` | El cambio exacto, línea a línea | Cada commit |

La regla que evita que esto se pudra: **la bitácora narra y decide; el `git log` detalla.** Si algo se puede reconstruir del diff, no va en la bitácora. Lo que va es lo que el diff no dice: por qué se eligió un camino, qué se descartó, qué quedó a medias y con qué idea seguir.

---
