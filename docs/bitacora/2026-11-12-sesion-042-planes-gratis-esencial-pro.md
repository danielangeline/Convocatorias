# Sesión 042 · 2026-11-12

**Sprint:** 5 · planes y portada, pedidos por el Product Owner
**Commits:** el de cierre de esta sesión (ver `git log`)

---

## Objetivo de la sesión

Dos tareas con decisiones ya tomadas por el Product Owner: (1) **nuevos planes de empresa** —Gratis, Esencial y Pro, con funciones por plan, sin Trial y con bajada a Gratis al vencer un plan de pago—, documentado primero y luego con migración, servidor + RLS y pantallas; (2) **portada** más completa y persuasiva, enfocada en beneficios.

Al abrir: `ESTADO.md` y la bitácora 041 (carga de datos, sin código). El MCP de Supabase no estaba cargado en esta sesión, así que todo fue con `npx supabase db query --linked`; `supabase/.temp/project-ref` y `list_tables` confirmaron el proyecto de Convocatorias (`lqrqhehwqyphtdzplxhv`: `planes`, `convocatorias`, `suscripciones`…), no la tienda.

## Qué se hizo

**Documentación primero** (regla de `CLAUDE.md`):
- docs/07 §10.2: tabla Gratis / Esencial / Pro con precios, créditos y la tabla de funciones del Product Owner.
- docs/03: **RN-11** reescrita (sin Trial; Gratis sin vencimiento), **RN-16** ampliada (al terminar la gracia, la empresa baja a Gratis sin borrar nada), **RN-41 nueva** (funciones por plan como datos; bloqueado pero visible; lo creado sigue siendo de la empresa).
- docs/01: CU-28, CU-29, CU-31 (paso 6: funciones del plan), CU-32 y las precondiciones de CU-10, CU-11, CU-19, CU-33, CU-43; ciclo de vida de la suscripción.
- docs/02: RF-01, RF-36, RF-37 (reescrito), RF-39, RF-40, RF-82 y **RF-120 nuevo** (función bloqueada pero visible).
- docs/05 **§9.38**; docs/04 (rutas, endpoints, portada); docs/09; docs/00; `CLAUDE.md` (introducción, tabla de roles, regla 5 y flujo del catálogo).

**Base de datos** — migración `20261112100000_planes_con_funciones.sql`, ensayada con `raise` final (sola y junto a cada suite SQL) y aplicada con `db push`:
- `planes.es_trial` → `es_gratuito`; `dias_trial` eliminada; banderas `incluye_proyecto_ia`, `incluye_sugerencias`, `incluye_documento_ia`, `incluye_postulaciones`, `incluye_consultores` (solo en planes de empresa, por check). Trial → **Gratis** (0 créditos, sin funciones); Esencial: todas menos consultores; Pro: todas.
- Suscripciones: estado y modalidad `gratis`, `fecha_vencimiento` nula si y solo si es Gratis. **Las 4 empresas con Trial vencido quedaron en Gratis.**
- `privado.plan_efectivo`, `privado.plan_incluye`, `privado.sesion_incluye` (para RLS) y `public.mi_plan_efectivo()` (para la pantalla).
- Verificación por función (`funcion_no_incluida`) en `iniciar_estructuracion`, `iniciar_transcripcion`, `iniciar_edicion_apartado`, `iniciar_generacion`, `preparar_ajuste` (plan de la empresa dueña, RN-28), `sugerencias_proyecto`, `iniciar_postulacion`, `solicitar_encargo`, `elegir_propuesta`, `calificar_encargo`, `compartir_documento`; y en la RLS de `postulaciones` (insertar y actualizar), `postulacion_checklist` (actualizar) y `calificaciones` (insertar).
- `crear_cuenta` deja a la empresa en Gratis; `vencer_suscripciones` baja a Gratis a la empresa y vence al consultor (devuelve `a_gratis`); `guardar_plan` con banderas opcionales (`gratuito_fijo`, `funciones_de_empresa`); `activar_suscripcion` rechaza Gratis; tablero con `gratis`. `tarifas_ia` legible sin sesión para la portada.

**Servidor y pantallas (RF-40, RF-120):**
- `lib/plan-servidor.ts` (`exigirFuncion`, mensajes 402 que dicen el plan); mapeo de `funcion_no_incluida` en postulaciones, encargos, propuestas, documentos, proyectos con IA y sugerencias; el directorio se bloquea en el servidor (`/consultores`, `/api/consultores` y el perfil, salvo un consultor de sus encargos).
- Menú lateral y pestañas móviles con candado; `components/plan/FuncionBloqueada.tsx` (pantalla, aviso y diálogo) con «Disponible en el plan X» → «Mejorar plan» → `/suscripcion?plan=<id>`, que señala el plan. Bloqueados: sugeridas, postulaciones, documentos, generar, crear y editar con IA, directorio, encargos, solicitar consultor, compartir y calificar. Con datos de un plan anterior, **solo lectura** con descarga.
- Comparador con Gratis, Esencial y Pro, funciones incluidas y no incluidas (tachadas) leídas de las banderas (`planesIndistinguibles` sigue distinguiendo Esencial de Pro). Panel `/admin/planes` con las casillas de funciones. Franja de aviso y «Plan y créditos» explican la bajada a Gratis.
- El plan efectivo y los planes llegan por un **contexto por petición** (`lib/contexto-plan.tsx`) desde el layout del portal: el store de Zustand es global en el proceso del servidor y, sin esto, el HTML inicial salía desbloqueado hasta hidratar.

**Portada (`app/page.tsx`, RF-44, RF-82, RF-84, RN-19, RN-33):** portada con el titular pedido, «Empiece gratis» y «Ver planes», cifras reales; el problema; 6 beneficios (con «Desde Esencial» / «Plan Pro» sacado de los datos); cómo funciona en 4 pasos; qué hacemos y qué no; las 3 tarjetas de la base con mensual/anual y Esencial «Más elegido»; puerta del consultor; preguntas frecuentes (con las tarifas reales); cierre. Las dos puertas siguen; ninguna convocatoria individual sin cuenta.

## Cómo se verificó

- **SQL** (`npx supabase db query --linked -f …`): `planes_funciones.sql` **nueva, 18/18**; `planes_suscripciones` 29/29, `vencimiento_suscripciones` (reescrita) 12/12, `generacion_ia` 52/52, `creditos_por_tarifa` 13/13, `estructuracion_proyecto` 22/22, `postulaciones` 31/31, `sugerencias` 19/19, `encargos` 51/51, `propuestas_encargo` 40/40, `revision_consultores` 29/29, `vigencia_al_crear` 14/14, `directorio_consultores` 14/14, `perfil_consultor` 25/25, `cierre_convocatorias` 7/7, `guardar_publicada_completa` 8/8, `plantillas_generacion` 16/16, `rnf_esquema` en verde, `rls_aislamiento` «TODAS LAS COMPROBACIONES PASARON». `paises_y_moneda` 25/27: los 2 fallos **ya fallaban sin la migración** (datos de la sesión 041).
- **HTTP** (`IA_PROVEEDOR=prueba`, sin gasto de OpenAI): `prueba-planes-funciones.mjs` **nueva, 19/19** (los tres planes contra la API y las pantallas, y la Pro vencida en solo lectura). Regresión con `next dev`: `prueba-planes-suscripciones` 49 ok, `prueba-vencimiento-suscripciones` (reescrita: Esencial que vence y baja a Gratis) 12 ok, `prueba-generacion-ia` 59, `prueba-proyecto-ia` 27, `prueba-editar-apartado` en verde, `prueba-sugerencias` en verde, `prueba-propuestas-encargo` 49, `prueba-directorio-consultores` 38, `prueba-proyectos` 43, `prueba-catalogo-empresa` 49, `prueba-rnf-criticos` TODO PASA. Con `next build` + `next start` (puerto 3100): `prueba-matriz-roles` **58/58** y `prueba-planes-funciones` 19/19. Fallos **previos a esta sesión**, sin relación con los planes: `prueba-postulaciones` 2 (RF-73, ver hallazgos), `prueba-encargos` 1 (la etiqueta del contador del panel cambió en la 040), `prueba-guardadas` 2 (`/sugeridas` y `/guardadas` redirigen desde la 040) y `prueba-paises-y-moneda` 1 (supone que no hay tasa USD y hay una desde el 4-nov).
- **En pantalla** (Playwright contra `localhost`, navegador aparte, nunca la sesión del Product Owner): cuentas temporales `9c1c5c` —Gratis, Esencial, Pro, Pro vencida con postulación y encargo, consultora— creadas y **borradas** con `scripts/recorrido-planes.mjs`. Portada a 1366 y 375 px, claro y oscuro, sin nada fuera de pantalla. Evidencias en `docs/evidencias/sesion-042/`.
- `tsc`, `eslint` y `next build` en verde.

## Decisiones tomadas

- **Aplicar la migración y fusionar al final** (decisión del Product Owner en la sesión): la base es la de producción y `main` desplegado leía `planes.es_trial`, así que el portal empresa de producción estuvo caído entre el `db push` y la fusión. Se descartó una capa de compatibilidad (alias `es_trial` y fecha lejana en vez de nula) para no dejar deuda.
- **Gratis es una suscripción `gratis` sin vencimiento**, no la ausencia de suscripción: se conserva «una suscripción por cuenta» y la bajada reutiliza la misma fila (paquetes intactos). Descartado: dejar la fila de pago `vencida` y calcular Gratis aparte (dos verdades).
- **Plan efectivo con respaldo en Gratis**: una empresa vencida que el job aún no movió, o suspendida, ya se trata como Gratis; no depende del job (como RF-40 desde la sesión 023).
- **Al bajar a Gratis no se cancela nada**: los encargos en curso siguen (el consultor puede terminar), los documentos compartidos siguen compartidos y la empresa puede revocar o retirar; lo que no puede es avanzar postulaciones, calificar, elegir propuestas, compartir de nuevo ni usar la IA. **Pide confirmación del Product Owner** (ver abierto).
- **El directorio sigue siendo de lectura pública en la base** (lo usa RF-44 y los perfiles aprobados son públicos por diseño, §9.20): el bloqueo de Pro está en el servidor y en toda acción con un consultor.
- **Tratamiento de usted** en todo lo nuevo, también en el titular y los botones que el Product Owner escribió en tuteo («Encuentre…», «Empiece gratis»), por la regla de la portada.
- **«Soporte prioritario y más usuarios»** no se muestra en las tarjetas: no está modelado ni construido (no hay cuentas con varios usuarios) y anunciarlo sería prometer algo que no existe.
- Las suites antiguas pasan sus empresas a un **plan temporal inactivo de 125 créditos con todas las funciones** (`scripts/plan-prueba.mjs`), que se borra al final: así no se tocan los planes reales y la aritmética de créditos de esas pruebas no cambia.

## Qué quedó abierto

- **Product Owner:** confirmar qué pasa con los encargos en curso y los documentos compartidos cuando un Pro baja a Gratis (hoy siguen vivos).
- **Product Owner:** la meta «conversión de trial a pago ≥ 30 %» de docs/00 quedó como `[COMPLETAR]` para el plan Gratis sin vencimiento.
- Hasta que esta rama llegue a `main`, el portal empresa de producción no funciona (ver «Estado al cerrar»).

## Hallazgos no planificados

- **14 modales con `bg-overlay\x01`** (un carácter de control de un `sed` de la sesión 040): la clase no existe y esos modales no oscurecen el fondo (`ModalCreditos`, `ModalSuscripcion`, `SolicitarConsultorModal`, `EditorDocumento`, `AsistenteProyecto`, `FichaProyecto`, `EncargosEmpresa`, `PerfilConsultorVista` y 6 del panel). Arreglo trivial; no se tocó por la regla de no arreglar de paso.
- **RF-73 posiblemente roto desde la sesión 040:** el detalle de la postulación solo muestra el enlace al portal de la entidad cuando todos los requisitos están listos; `prueba-postulaciones.mjs` falla en «Ir al portal de la entidad» y en su orden frente a «Solicitar consultor» (fallo previo a esta sesión).
- **El store de Zustand es global en el proceso del servidor**: en el render del servidor los componentes cliente lo ven vacío o con datos de ejemplo (el comparador salía con los planes de `mock-data`). Se comprobó que **no** filtra datos de otra cuenta (dos cuentas temporales seguidas), pero todo lo que depende del store solo es correcto tras hidratar. Las pantallas de esta sesión ya usan el contexto por petición.
- El portal mezcla tuteo (pantallas existentes) y usted (identidad, portada y lo nuevo de esta sesión).
- `paises_y_moneda.sql` falla 2 comprobaciones por los datos de la sesión 041 (convocatorias sin Colombia y una tasa).
- Suites HTTP desactualizadas desde el rediseño de la 040: `prueba-encargos` (busca `aria-label="N esperando"`; hoy es «pendientes») y `prueba-guardadas` (espera 200 en `/sugeridas` y `/guardadas`, que ahora redirigen). Varias suites apuntan por defecto al puerto 3100 (`next start`) y otras al 3000: conviene unificar o documentarlo en cada una.

## Estado al cerrar

- Migración aplicada en producción; código en `sprint-2`, fusionado a `main` a pedido del Product Owner en esta sesión (ver commit).
- RF-36, RF-37, RF-39, RF-40, RF-82, RF-120, RN-11, RN-16 y RN-41 en `verificado`.
