# Estado del trabajo

> **Este es el primer archivo que se lee al abrir una sesión.** Dice dónde vamos, qué está en curso y qué bloquea.
> Plan de sprints: [`docs/10-plan-de-desarrollo.md`](docs/10-plan-de-desarrollo.md) · Detalle por requerimiento: [`docs/11-avance-por-requerimiento.md`](docs/11-avance-por-requerimiento.md) · Historial: [`docs/bitacora/`](docs/bitacora/)

---

**Actualizado:** 23 de septiembre de 2026 · cierre de la sesión 018
**Sprint:** 3 · día 9 de 30 (el Sprint 2 terminó antes de su día 12)
**Rama de trabajo:** `sprint-2`, abierta desde `main` en la sesión 011 y subida a `origin` (sin fusionar a `main`: producción todavía no tiene el catálogo del panel). **Migraciones nuevas ya aplicadas al remoto:** `20260917100000_guardar_convocatoria`, `20260917200000_storage_y_adjuntos` , `20260918100000_publicar_convocatoria` y `20260918200000_nombres_normalizados_y_borrar_categorias`. No rompen `main`, que no las llama

---

## Dónde vamos

La especificación está cerrada en **v6**. **La base de datos existe en Supabase** (27 tablas con RLS, prueba cruzada pasada) y **la identidad ya es real**: registro, login, confirmación de correo y MFA del administrador con Supabase Auth. El `ModoDemo` desapareció. **Desde la sesión 011, el panel administra fuentes, categorías y convocatorias (datos y requisitos) contra Supabase**, con endpoints validados en el servidor, desde la 012 también los adjuntos, en Storage real —los 3 buckets existen, los tres privados, y todo archivo se entrega por URL firmada de 15 minutos— y **desde la 013 publica y despublica, validado en el servidor**. Con eso, el panel ya carga una convocatoria de principio a fin. Las tablas del catálogo siguen vacías: nadie ha cargado contenido real. Lo demás —el catálogo que ve la empresa, proyectos, postulaciones, documentos, encargos— sigue en datos de ejemplo de Zustand, filtrados por el `auth.uid()` real: una cuenta nueva empieza vacía y lo que crea se pierde al recargar.

## Lo último que se hizo

- **Sesión 018: Sprint 3, paso 1 — proyectos en Supabase (RF-14, RF-45, RF-46, RF-81, RN-30).**
  - `guardar_proyecto` (datos y categorías en una transacción, con la RLS de la empresa) y un trigger que **calcula la completitud en la base**: la aplicación no puede fijarla. Migración `20260923500000`.
  - `GET/POST /api/proyectos` y `GET/PATCH/DELETE /api/proyectos/[id]`: montos en formato colombiano (resuelve el hallazgo del monto del proyecto), validación de forma, borrar responde 409 si hay encargos y la pantalla avisa antes cuántos documentos generados se perderán. `conEmpresa` exige ahora mismo origen en las escrituras.
  - Listado y ficha pasan a componentes de servidor; el formulario guarda por la API; el layout entrega los proyectos reales al store para sugerencias, generar y postular. Se retiraron las acciones de proyectos del store.
  - El documento con IA ya no escribe un monto de proyecto que no existe: sin monto, `[COMPLETAR: …]` (RNF-23).
  - Verificado con `scripts/prueba-proyectos.mjs`: **43 comprobaciones**, todas pasan, incluidas dos empresas aisladas en las pantallas (condición del Hito 1). RF-14 y RF-45 `verificado`; RF-46 y RF-81 `servidor`, a falta de mirarlos en pantalla.
  - **La prueba RLS fallaba de noche:** sembraba sus convocatorias con `current_date` (UTC), y desde las 7 p. m. de Colombia la "vencida" seguía vigente. Pasa a `privado.hoy_colombia()`. Regresión completa en verde.
- **Sesión 017, al final: Sprint 2, paso 7 (RF-78) y advertencia al editar (CU-05 3e). El Sprint 2 queda completo.**
  - **RF-78 en la base:** un trigger en `postulaciones` y `documentos_generados` impide crear una fila (o mover una existente) sobre una convocatoria que no esté publicada y vigente, **también con `service_role`**, que las políticas RLS no frenan. Clave estable `convocatoria_no_vigente` para que los endpoints de postular (Sprint 3) y generar (Sprint 4) respondan 409. Probado: `supabase/tests/vigencia_al_crear.sql`, 14/14.
  - **Advertencia (decisión del Product Owner):** guardar una publicada con fecha de cierre ya pasada se permite, pero la pantalla pide confirmación antes y muestra en ámbar que se cerrará a medianoche; el endpoint devuelve el `aviso`. Verificado en `prueba-publicar-convocatoria.mjs` y **en el navegador** con la sesión de administrador: cancelar no envía nada; aceptar guarda, deja la convocatoria publicada y muestra el aviso en ámbar (convocatoria de prueba borrada después).
  - **El reloj de este equipo va 140 s atrasado y el servicio de hora de Windows está detenido.** Durante unos minutos alrededor de cada renovación horaria del token, el servidor local rechaza sesiones válidas: se vio en el navegador ("Acceso denegado" y luego `/login`). No afecta a producción. Arreglarlo es del Product Owner (ver "Bloqueos").
  - Regresión completa en verde: pruebas RLS, de cierre, de guardado y de vigencia, y las suites de catálogo, publicar, panel y adjuntos.
- **Sesión 017, después: Sprint 2, paso 6 — cierre diario (RF-10, CU-06).**
  - El job existía desde la sesión 003 y corre bien cada día (historial de `pg_cron`), pero nunca había tenido nada que cerrar. Ahora ejecuta `privado.cerrar_convocatorias_vencidas()`, que devuelve cuántas cerró.
  - **"Hoy" es el día en Colombia** (`privado.hoy_colombia()`): una convocatoria vence al terminar su día de cierre en hora de Bogotá. Antes el job ya lo cumplía por su horario (00:00 en Colombia), pero postular, publicar y los indicadores usaban `current_date` en UTC y la daban por vencida desde las 7 p. m. Resuelve el hallazgo de la sesión 017; RN-02 y CU-06 precisados.
  - Probado con `supabase/tests/cierre_convocatorias.sql` (7/7, se revierte sola). La prueba RLS, la del guardado y las suites de catálogo, publicar y panel pasan enteras. RF-11 pasa a `verificado` tras la revisión del Product Owner.
  - **Cierre real verificado:** el Product Owner devolvió su convocatoria de MinCiencias al 13-oct y se hizo la ejecución real el 23-sep: con la convocatoria de MinCiencias ya corregida, se creó una convocatoria temporal vencida y un job temporal de `pg_cron` que ejecutó la misma función como `postgres` (`succeeded`, 20:22 UTC); la temporal pasó a `cerrada`, la real siguió `publicada`; job y convocatoria retirados después. **RF-10 pasa a `verificado` y el Hito 2 queda cumplido.**
- **Sesión 017, después: Sprint 2, paso 5 — cerradas fuera del listado salvo filtro explícito (RF-11, RN-02).**
  - Migración `20260923200000_empresa_lee_cerradas`: la empresa lee las publicadas y las cerradas; borradores y despublicadas siguen invisibles. **Leer no es actuar**: postular a una cerrada lo sigue rechazando la RLS (RF-78), comprobado.
  - El listado por defecto filtra las vigentes en la consulta; con `incluirCerradas=true` (o la casilla de la pantalla) vienen detrás, de la más reciente a la más antigua, marcadas como cerradas. Una publicada vencida se presenta como cerrada aunque el job de RF-10 no la haya cerrado. En la ficha de una cerrada se deshabilitan las tres acciones de CU-08, incluido "Ir al portal de la entidad".
  - **La prueba de RLS estaba rota desde que hay contenido real**: suponía un catálogo vacío y una publicada que podía quedar incompleta. Se corrigió (línea base para los indicadores, comprobaciones limitadas a sus propias filas, y la prueba de RN-04 despublica antes de quitar un requisito) y se amplió con una cerrada y una despublicada. Pasa entera.
  - Suite del catálogo: **47 comprobaciones**, todas pasan. Sin regresiones en adjuntos, catálogo del panel y publicar. RN-02 pasa a `servidor`; RF-11 espera que el Product Owner mire la casilla.
- **Sesión 017: Sprint 2, paso 4 — el catálogo de la empresa contra datos reales (RF-11, 12, 13, 43, 44, RN-33).**
  - `lib/catalogo.ts` lee con la sesión de la empresa, así que **la RLS decide qué existe**. Endpoints `GET /api/convocatorias` (con filtros), `GET /api/convocatorias/[id]`, `GET .../documentos/[docId]/enlace` y `GET /api/indicadores` (público), declarados en la matriz (RNF-30) y con segunda barrera: 401 sin sesión, 403 con otro rol.
  - Catálogo y ficha son componentes de servidor que pasan los datos a la parte interactiva. Filtros en un solo módulo (`lib/catalogo-filtros.ts`) para pantalla y endpoint; chips derivados de lo vigente. El layout del portal entrega además el catálogo real al store, para que postular, generar y sugerencias trabajen con convocatorias y categorías reales.
  - **La empresa ya descarga los adjuntos**: política de Storage nueva (`20260923100000`) que hereda la visibilidad de la fila. Y un defecto previo corregido: **los nombres con tilde se descargaban como `T%C3%A9rminos.pdf`** (storage-js codifica dos veces); afectaba también al panel.
  - La landing muestra los indicadores reales, con caché de 1 hora que se invalida al publicar, despublicar o editar.
  - Montos y fecha de apertura pasan a admitir nulo en el tipo `Convocatoria`, y el rango se escribe sin inventar ("Hasta $X"). El texto del documento con IA ya no afirma un rango que la entidad no dio (RNF-23).
  - Verificado con `scripts/prueba-catalogo-empresa.mjs` (34 comprobaciones, todas pasan): RN-33 para visitante, consultor y empresa (también contra la tabla y contra Storage directamente), los filtros, la ficha, la descarga del archivo exacto y las pantallas. Sin regresiones en adjuntos, catálogo del panel y publicar. **RF-12, RF-13 y RF-44 pasan a `verificado`**; RF-11 y RF-43, a `servidor`.
- **Sesión 016: diagnosticado el cuelgue al guardar convocatorias. No es el código: es la red de este equipo.** Ciertas peticiones HTTPS hacia Supabase se pierden según su tamaño exacto en bytes. Windows retransmite ~19 s y aborta con `ECONNRESET`.
  - Se siguió el plan del reporte. Postgres **nunca** vio la llamada colgada: vigilante sin filtro cada 250 ms y `pg_stat_statements`, con 63 ms como máximo. Con `fetch` instrumentado solo fallaba esa RPC, y también fuera de Next. La prueba decisiva: **sin sesión, sin datos y sin pool**, un `POST` anónimo con 1 460 bytes de relleno muere 4 de cada 30 veces, con 1 000 ninguna, y con 10 bytes más pasan todas.
  - `scripts/diagnostico-red-supabase.mjs` nuevo: lo reproduce en ~1 minuto sin tocar la base.
  - **No se cambió código de la aplicación ni la base.** La instrumentación se retiró. Solo se corrigió el comentario equivocado de `prueba-publicar-convocatoria.mjs`.
  - **Confirmado en otra red y cerrado:** en el punto de acceso Wi-Fi del iPhone del Product Owner (misma tarjeta MT7902 y mismo filtro de VirtualBox), `diagnostico-red-supabase.mjs` salió `RED LIMPIA` dos veces (180/180; en la red de casa fallaban 6 de 90) y `prueba-publicar-convocatoria.mjs` pasó **tres veces seguidas, 39/39, sin un solo reintento**. No es el computador: es el router o el proveedor. Paso 3 del Sprint 2 y RF-07 pasan a `verificado`.
  - **Prueba como tester en el navegador**, con la sesión de administrador del Product Owner y sobre una convocatoria de prueba ya borrada: crear, validaciones, publicar incompleta y completa, editar una publicada, adjuntos, descarga, despublicar, 404 del panel sin sesión y la portada a 375 px. Salieron **cuatro hallazgos nuevos** (tabla de hallazgos). El más grave: **escribir `1.000.000` en un monto guarda 1 peso**.
  - **Los otros tres hallazgos de la prueba, resueltos:** la sesión ya no se da por perdida ante un fallo pasajero de Auth (se reintenta y se registra); los avisos del editor se limpian en cada acción nueva; la portada ofrece "Ir a mi portal" si hay sesión (RF-84). Verificado en el navegador y con las suites de catálogo, adjuntos y gestión de administradores, las tres enteras.
  - **Montos en formato colombiano** (CU-02 2b, RF-05), por decisión del Product Owner: `1.000.000` y `$ 50.000.000` se guardan bien, y lo ambiguo (`1.000000`, `1.5`, `1.000,50`, letras, negativos) se rechaza diciendo cómo escribirlo. El editor los muestra con puntos. Un solo lector, `lib/montos.ts`, para servidor y pantalla. Verificado con el teclado en el navegador y en `prueba-catalogo-admin.mjs`, que pasa entera.
  - **Una publicada ya no pierde su último adjunto** (RN-01, CU-03 1b): trigger en la base (`20260922960000_proteger_ultimo_adjunto`) y 409 con un mensaje que dice qué hacer. Verificado en pantalla y en la prueba SQL (8/8). Las suites de adjuntos y de catálogo pasan enteras.
  - **Restaurada la comprobación completa al guardar**, por decisión del Product Owner (RN-01, RF-09): editar una publicada ya no deja quitarle ubicación, descripción, categoría ni el segundo requisito (409 `publicada_incompleta`). Migración `20260922950000_guardar_con_ficha_completa`, ensayada y aplicada. Verificada con `supabase/tests/guardar_publicada_completa.sql`, **6 de 6**, que no deja nada escrito. La suite HTTP no llega a esos casos en esta red.
- **Sesión 015: lo que el Product Owner encontró probando, y una verificación en el navegador** (no planificada).
  - **La pantalla engañaba al publicar:** el botón no miraba el formulario, sino lo último guardado. Ahora **Publicar guarda primero** y solo publica si ese guardado pasa (CU-05 3d).
  - **RN-01 ampliado por decisión del Product Owner:** publicar exige ubicación, descripción, ≥1 categoría, **≥1 documento adjunto** y **≥2 requisitos**, además del enlace. Lo del adjunto **revierte** la decisión de la 012, confirmado expresamente. El rechazo enumera de una vez todo lo que falta.
  - **Recorrido A5–A7 verificado en el navegador** con la sesión del Product Owner: **19 de 19 pasos pasan**. De paso se corrigió un defecto de la sesión 014 (`setState` durante el render, en la sección de documentos).
  - **Sin resolver:** el cuelgue de ~20 s al guardar (ver "Bloqueos"). Para no dejar el panel peor, `guardar_convocatoria` volvió a la comprobación de la 011 y **queda el hueco** de que editar una publicada solo protege enlace y requisitos; publicar sí lo exige todo.
  - **El paso no se da por verificado:** 4 comprobaciones siguen en rojo, todas del mismo síntoma.
- **Sesión 014: tres cosas que el Product Owner encontró probando el panel** (no estaba planificada).
  1. **Desactivar una fuente no hacía nada** — no era el código: el `next dev` llevaba horas vivo y respondía **500** por caché corrupta. Con el proceso parado, `.next` borrada y el servidor de nuevo en pie, la misma petición responde 200. La fuente quedó como estaba. `.claude/launch.json` fija ahora `autoPort: false`, porque mover el puerto rompe en silencio la confirmación de correo.
  2. **`Transformación digital` y `Transformacion digital` entraban como categorías distintas.** Ahora los nombres se comparan **sin tildes, sin mayúsculas y sin espacios sobrantes**, en categorías **y en fuentes** —que no tenían ninguna restricción de nombre—. El nombre se guarda tal como se escribe (docs/05 §9.16).
  3. **No había forma de quitar una categoría equivocada.** Decisión del Product Owner: **se borra la que ninguna convocatoria usa**; la que ya clasifica algo solo se desactiva (RN-07 precisado). La condición vive en la política RLS; el endpoint cuenta el uso antes para responder 409 con el motivo, y el botón solo sale donde borrar es posible.
  - `prueba-catalogo-admin.mjs` pasa de 40 a **55 comprobaciones**, todas verdes. Las otras dos suites, sin regresiones.
  - **Quedó a medias:** al fusionar los duplicados existentes ganó la versión **sin tilde** (el criterio de desempate no servía, porque el nombre normalizado también baja a minúsculas). No se corrigió la migración porque ese código ya no vuelve a ejecutarse; el dato se arregla borrando la categoría y volviéndola a crear.
- **Sesión 013: Sprint 2, paso 3 — publicación validada en servidor (RF-09, RN-01, RN-03, RNF-11).**
  - Migración `publicar_convocatoria` (`security invoker`, docs/05 §9.15): exige datos mínimos, enlace oficial y ≥1 requisito, y **no publica lo ya vencido**. Los adjuntos no se exigen (decisión de la 012). Registra `publicada_at` y `publicado_por`. Despublicar conserva ese rastro (RN-07). Se publica desde cualquier estado que no sea `publicada`, incluido `cerrada`, para que corregir la fecha devuelva la salida.
  - `POST .../publicar` y `.../despublicar`. El endpoint enumera **todo** lo que falta de una vez; la función SQL es la barrera y rechaza igual si se la llama directamente (RNF-20, comprobado).
  - El editor ya trae el botón real, y antes de publicar **sin adjuntos** advierte que la generación con IA perderá el TDR como contexto (CU-05 3d). La advertencia no bloquea.
  - Verificado con `scripts/prueba-publicar-convocatoria.mjs`: **30 comprobaciones, todas pasan**. Las dos suites anteriores se volvieron a correr sin regresiones. `tsc` y `next build` correctos; `lint` sin errores nuevos.
  - **La migración se ensayó con el método corregido** (`raise` dentro del propio archivo) y se comprobó que el ensayo **no** dejaba nada aplicado. El método funciona.
  - **RNF-06 corregido a 20 MB**, por decisión del Product Owner: decía 50 y contradecía a RNF-18.
  - **No verificado:** las pantallas en el navegador con sesión (ver pendiente 9).
- **Sesión 012: Sprint 2, paso 2 — Storage y adjuntos de convocatoria (RF-07, CU-03, RNF-16, RNF-18).**
  - **Dos huecos de especificación resueltos por el Product Owner antes de programar:** los **tres** buckets quedan privados (`docs/04` venía de v5 y dejaba públicos dos, lo que vaciaba RN-33 para los adjuntos) y un adjunto admite **PDF, Word, Excel y ZIP hasta 20 MB**. `docs/03` y `docs/04` corregidos; `docs/05 §9.14` nueva.
  - Migración `storage_y_adjuntos`: los 3 buckets con su límite y su lista de tipos —**ese es el enforcement real**: una subida directa que los incumpla la rechaza Storage—, 12 políticas sobre `storage.objects`, columnas `tipo_mime`, `tamano_bytes` y `actualizado_at`, y un trigger que impide que un `update` cambie el archivo.
  - 4 endpoints bajo `/api/admin/convocatorias/[id]/documentos`: firmar la subida, registrar, renombrar/quitar y enlace de descarga. **El archivo no pasa por el servidor** (una función de Vercel no admite 20 MB): va del navegador al bucket por una URL firmada, con la ruta que decide el servidor. La fila se registra solo si el objeto existe, y con el tamaño y el tipo **reales leídos de Storage**.
  - La sección "Documentos" del editor ya sube, lista, renombra, cambia el tipo, descarga y quita.
  - Verificado con `scripts/prueba-adjuntos-convocatoria.mjs`: **45 comprobaciones, todas pasan**, con subida y descarga de verdad y cuentas temporales ya borradas. `tsc` y `next build` correctos; `lint` sin errores nuevos.
  - **No verificado:** la sección en el navegador con sesión (ver pendiente 8).
- **Pendientes 3 y 8 cerrados:** el Product Owner probó reenviar y cancelar una invitación, y recorrió el catálogo del panel en el navegador. Ambos funcionan.
- **Sesión 011: Sprint 2, paso 1 — administración del catálogo contra Supabase (RF-04, 05, 06, 08, RNF-29).**
  - Endpoints bajo `/api/admin`, que heredan el 404 del panel y el MFA: fuentes, categorías y convocatorias. La lógica vive en `lib/admin/catalogo.ts`. La envoltura `conAdministrador` exige administrador con `aal2`, mismo origen e id uuid. `docs/04` actualizado: antes decía `/api/fuentes`.
  - Migración `guardar_convocatoria` (`security invoker`, docs/05 §9.13): datos, categorías y requisitos en una transacción. No cambia el estado.
  - `/admin/fuentes`, `/admin/categorias`, `/admin/convocatorias` y el editor leen y escriben en Supabase. Nada se borra (RN-07): fuentes y categorías se desactivan. El editor ya no publica ni simula adjuntos (pasos 2 y 3).
  - Verificado con la sección 9 nueva de la prueba de RLS (todo pasa y cada rechazo sale por su regla) y con `scripts/prueba-catalogo-admin.mjs`: 40 comprobaciones con cuentas temporales, ya borradas. `tsc` y `next build` correctos; `lint` sin errores nuevos.
  - **No verificado:** las pantallas en el navegador con sesión de administrador (ver pendiente 8).
- **Pendiente 3, en parte:** el Product Owner revocó al administrador de prueba y confirmó el 404. En la base quedó `admin_revocado` y, 9 s después, `acceso_denegado` de esa sesión en `/admin`.
- **Ya cerrada la sesión, a pedido del Product Owner:** no llegaba el correo de confirmación al crear una cuenta. Causa: registrarse con un correo que ya tiene cuenta devuelve éxito sin enviar nada (Supabase, para no revelar qué correos existen). Se borró la cuenta de administrador revocado `danielangeline322@gmail.com` y el Product Owner se registró con ella como empresa en producción: **RF-01 queda probado por el formulario con correo real**, con confirmación, perfil de empresa y trial de 3 créditos.
- **Sesión 010:** entrada con dos puertas (RF-84) y recuperación de contraseña (RF-03). Cerró el Sprint 1.

Detalle en [`docs/bitacora/2026-09-23-sesion-018.md`](docs/bitacora/2026-09-23-sesion-018.md).

## En curso

Nada a medias. **El Sprint 2 está completo**, con el Hito 2 cumplido (día 9 de 12). Lo siguiente es el Sprint 3.

## Lo siguiente

**Sprint 3 — Proyectos, sugerencias y postulaciones** (`docs/10 §Sprint 3`). El Sprint 2 quedó completo en la sesión 017 (sus siete pasos y el Hito 2).

1. ~~Proyectos con datos de contenido y completitud, filtrados por propietario (RF-14, 45, 46, 47, **81**)~~ — **sesión 018**. RF-47 (generar sobre un proyecto incompleto) se cierra con la generación, en el Sprint 4.
2. Sugerencias con porcentaje y desglose, indexadas, solo vigentes (RF-15, 16, RN-05, RNF-05): `GET /api/proyectos/[id]/sugerencias`, cruce determinístico en el servidor.
3. Postulaciones con checklist copiado de los requisitos (RF-17, 18, RN-04): `POST /api/postulaciones`, que traduce a 409 la clave `convocatoria_no_vigente` (RF-78).
4. Estados según el grafo de transiciones, validados en servidor (**RF-83**).
5. Enlace al portal de la entidad como acción primaria (**RF-73**, RN-19).

**Hito 3 (día 18):** una empresa registra un proyecto, recibe sugerencias ordenadas por compatibilidad, inicia una postulación y avanza su checklist. Todo persistido y aislado por RLS.

**Regla vigente:** toda pantalla o endpoint nuevo se declara en `lib/autorizacion/matriz.ts`; si no, responde 404. Los endpoints del catálogo del panel cuelgan de `/api/admin`, así que ya los cubre la regla del panel.

**Hito 2 (día 12):** un administrador carga una convocatoria real de principio a fin —datos, adjuntos, requisitos, enlace— y aparece en el catálogo de las empresas —no para visitantes ni consultores, RN-33—; una vencida desaparece sola al correr el job. **Cumplido el 23-sep (sesión 017):** la convocatoria se carga entera, se publica, aparece en el catálogo de las empresas y no para visitantes ni consultores, y una vencida se cierra sola al correr el job (ejecución real de `pg_cron`).

**Hito 1 (día 6) — cumplido** (sesión 010). Sigue vigente la condición: cada listado de empresa repite la prueba de aislamiento con dos empresas en pantalla al conectarse (proyectos y postulaciones en el Sprint 3; documentos y encargos en el Sprint 4).

## Infraestructura que ya existe

- **Repositorio oficial (desde el 16-sep): `https://github.com/danielangeline/Convocatorias`**, remoto `origin`. El anterior, `DanielBohorquezP/Convocatorias`, queda como remoto `anterior` y ya no recibe pushes. La cuenta de la máquina (DanielBohorquezP) es colaboradora y ya subió `main`, `auditoria-v6` y `sprint-1`. Vercel ya está reconectado al repositorio nuevo (confirmado por el Product Owner en la sesión 003).
- **Vercel está conectado al repositorio.** Cada push a `main` despliega a producción y cada push a otra rama crea una vista previa. El entregable "CI/CD en Vercel" del Sprint 1 **ya está cubierto**, con las variables de Supabase ya cargadas.
- **Supabase** (`lqrqhehwqyphtdzplxhv`): enlazado con el CLI (`npx supabase`, dependencia de desarrollo). Esquema en `supabase/migrations/`, prueba de RLS en `supabase/tests/rls_aislamiento.sql`, 3 jobs en `pg_cron`.
- **Producción (desde el 16-sep, repositorio nuevo):** `https://convocatorias-neon.vercel.app`. La anterior, `convocatorias-gamma`, ya no es la de referencia. Desde la sesión 006 `main` incluye `sprint-1`: producción ya tiene Auth real y no tiene selector de modo demo. Es la única URL que siempre sirve lo último.
- Las URLs con código (`convocatorias-xxxxxxxx-danielbohorquezps-projects.vercel.app`) apuntan a un despliegue fijo y **están protegidas con el inicio de sesión de Vercel**: no sirven para verificar desde fuera.
- `.gitignore` ya excluye `.env*`, así que las claves locales no se suben al repositorio.

## Bloqueos

**Ninguno propio del Sprint 2.** El cuelgue al guardar convocatorias (sesión 015) quedó **cerrado** en la sesión 016: en el punto de acceso Wi-Fi del iPhone del Product Owner (misma tarjeta MT7902 y mismo filtro de VirtualBox), `diagnostico-red-supabase.mjs` salió `RED LIMPIA` dos veces (180/180; en la red de casa fallaban 6 de 90) y `prueba-publicar-convocatoria.mjs` pasó **tres veces seguidas, 39/39, sin un solo reintento**. La causa es el router o el proveedor de la red de casa: con la misma tarjeta Wi-Fi en otra red, no ocurre. En esa red, guardar puede seguir colgándose ~20 s; las opciones para evitarlo están en el §10 del [reporte](docs/incidentes/2026-09-22-cuelgue-al-guardar-convocatoria.md). **Ante un cuelgue así, correr primero `scripts/diagnostico-red-supabase.mjs`.**

**Para trabajar en local, sincronizar la hora de Windows** (Product Owner): el reloj va 140 s atrasado y el servicio "Hora de Windows" está detenido. Síntoma: durante unos minutos cada hora, el servidor local rechaza sesiones válidas ("Acceso denegado" o vuelta a `/login`) y los códigos TOTP generados en este equipo fallan. Configuración → Hora e idioma → Fecha y hora → activar "Establecer la hora automáticamente" y pulsar "Sincronizar ahora". No afecta a producción.

Para lo demás, nada impide programar.

Pendiente del Product Owner:

1. ~~**URL Configuration de Auth en Supabase**~~ — hecho por el Product Owner (16-sep). Referencia:: *Site URL* = `https://convocatorias-neon.vercel.app`; *Redirect URLs* = `http://localhost:3000/**`, `https://convocatorias-neon.vercel.app/**` y `https://convocatorias-*-danielbohorquezps-projects.vercel.app/**`. Sin esto, el enlace de confirmación de correo no vuelve a `/auth/confirmar`.
2. ~~**Activar la cuenta de Propietario**~~ — hecho (contraseña y MFA, 16-sep). El primer correo no sirvió porque Supabase no admite `localhost` como destino y lo mandó a la portada. Se reenvió hacia `https://convocatorias-neon.vercel.app/auth/definir-contrasena`, válido por 1 hora. Después de definir la contraseña, activar el MFA en `/mfa`.
3. ~~**Probar la gestión de administradores con la cuenta del Propietario**~~ (sesión 009) — **terminado el 17-sep**. Queda solo la nota del final:
   - ~~`/admin/administradores` aparece en el menú~~, ~~invitar a un correo real sin cuenta~~, ~~abrir el enlace, definir la contraseña, activar el MFA; la invitación pasa a "aceptada"~~ — **hecho el 17-sep** con `danielangeline322@gmail.com` (confirmado en la base: invitación `aceptada`, MFA TOTP verificado, eventos `admin_invitado` y `mfa_activado`);
   - ~~revocar al administrador de prueba y comprobar que su sesión abierta pierde el panel~~ — **hecho el 17-sep** (sesión 011): `danielangeline322@gmail.com` revocado. `admin_revocado` quedó a las 13:15:49 y su sesión recibió `acceso_denegado` en `/admin` 9 s después;
   - ~~reenviar y cancelar una segunda invitación~~ — **hecho el 17-sep**, informado por el Product Owner al abrir la sesión 012. **Pendiente 3 cerrado.**
   - en `/admin/seguridad` todavía no se verán los eventos: esa pantalla sigue leyendo el mock.
4. ~~**Probar en el navegador con sesión** la cuenta de empresa de prueba~~ — **hecho el 23-sep** con `empresa.s004@example.com` (contraseña nueva generada por el agente y verificada): entra al portal, barra con iniciales y "Salir", 3 créditos y el trial. **Ojo:** esa contraseña quedó escrita en el chat, y `scripts/prueba-matriz-roles.mjs` la vuelve a cambiar si se corre. `consultor.s004` no se probó. El QR de `/mfa` se prueba con la cuenta del Propietario.
5. **SMTP propio antes de los pilotos** (p. ej. Resend): el correo por defecto de Supabase envía muy pocos mensajes por hora **y solo a direcciones del equipo del proyecto**. El 17-sep llegó bien a `danielangeline322@gmail.com` (registro real por el formulario, RF-01), pero eso no dice nada sobre una empresa piloto cualquiera.
6. **Cambiar la contraseña de la base de datos** (quedó escrita en el chat de la sesión 003).
7. **Docker Desktop no arranca** en esta máquina: no bloquea, pero obliga a ensayar las migraciones contra el remoto. **Ojo con el método** (hallazgo de la sesión 012): `db push` corre cada migración en su propia transacción, así que para ensayar una hay que poner el `raise` que la revierte **dentro de ese mismo archivo**, nunca en uno posterior.
8. ~~**Recorrer el catálogo del panel en el navegador**~~ — **hecho el 17-sep**, informado por el Product Owner al abrir la sesión 012: todo funciona.
9. ~~**Recorrer la sección "Documentos" del editor en el navegador**~~ — **hecho**: el Product Owner la recorrió en la sesión 015 (19/19 pasos) y el agente la repitió en la 016. Uno de sus pasos quedó obsoleto: publicar sin adjuntos ya no se permite (RN-01).

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
| El reloj de esta máquina va ~140 s atrasado frente a Supabase y el servicio "Hora de Windows" está detenido (medido el 23-sep). Además de los TOTP, **rompe las sesiones en local unos minutos cada hora**: el servidor da por vivo un token que Supabase ya rechazó, y después descarta el token renovado por "emitido en el futuro" | máquina local | **media** · sincronizar la hora de Windows (ver "Bloqueos") |
| `proxy.ts` también trata cualquier fallo de `rol_efectivo()` como "sin perfil válido": deniega el acceso y registra un `acceso_denegado` falso, sin guardar la causa. Es el mismo patrón que se corrigió en `obtenerSesion()` en la sesión 016 | `proxy.ts` | baja · registrar el error y distinguir un fallo pasajero de un rol ausente |
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
| Registrarse con un correo que ya tiene cuenta devuelve éxito y no envía correo (Supabase lo hace a propósito, para no revelar qué correos existen), pero la pantalla dice "Te enviamos un enlace…". Comprobado el 17-sep: `signup` responde 200 con `identities: []` y sin correo | `lib/acciones/auth.ts` (`registrarse`) | media · redactar el mensaje sin afirmar el envío, p. ej. "Si ese correo no tenía cuenta, te enviamos un enlace" |
| La cuenta `danielangeline322@gmail.com` (administrador revocado) se borró el 17-sep a pedido del Product Owner, para volver a registrarla como empresa. Sus 4 eventos de seguridad quedaron sin `usuario_id`; `admin_invitado` y `admin_revocado` conservan el correo en el texto | Supabase Auth | baja · queda anotado como contexto de la evidencia del Hito 1 |
| RNF-06 admitía "carga admin hasta 50 MB" y contradecía a RNF-18 (20 MB, que es lo que el bucket hace cumplir) | `docs/03` RNF-06 | **resuelto** en la sesión 013: manda 20 MB, por decisión del Product Owner |
| **Guardar una convocatoria se cuelga ~20 s y muere con `ECONNRESET`** | red de casa (router o proveedor) | **cerrado** en la sesión 016: confirmado en otra red; ver §10 del reporte |
| Editar una convocatoria **publicada** dejaba quitarle ubicación, descripción o categoría | `guardar_convocatoria` | **resuelto** en la sesión 016: comprobación completa restaurada |
| Se podía **quitar el último adjunto** de una convocatoria publicada (se reprodujo en pantalla: quedó con cero) | `documentos_convocatoria` | **resuelto** en la sesión 016: trigger + 409 (CU-03 1b) |
| ~~**Un monto escrito con puntos de miles se guarda mal sin avisar.**~~ **Resuelto en la sesión 016** (formato colombiano, CU-02 2b). El campo es `type="number"`: al teclear `1.000.000` el navegador lo deja en `1.000000` y se guarda **1 peso** con "Cambios guardados."; con `abc` se guarda vacío. Reproducido con el teclado en la sesión 016 y comprobado en la base (`monto_min = 1`). Los montos alimentan los filtros del catálogo (RF-12) | `lib/montos.ts` | **resuelto** en la sesión 016 |
| Otros campos de dinero seguían como `type="number"` o con `Number()`: el monto buscado del proyecto (**resuelto en la sesión 018**) y los precios de los planes en el panel. Hoy viven en el store de Zustand, pero heredarán el mismo fallo al conectarse | `components/ProyectoFormModal.tsx`, `app/admin/planes/page.tsx` | media · usar `lib/montos.ts` al pasarlos a Supabase |
| La segunda barrera rechazó una vez a un administrador con sesión válida (404 "No encontrado." y un `acceso_denegado` sin usuario): `obtenerSesion()` trataba cualquier fallo de `getUser()` como "sin sesión" y no registraba el error | `lib/auth.ts` | **resuelto** en la sesión 016: un fallo pasajero (red o 5xx de Auth) se reintenta una vez y se registra en el log; sin sesión o con token rechazado sigue siendo "sin sesión". Lo mismo se registra si fallan el perfil o el rol efectivo. **La causa de aquel fallo no se conoce**: si vuelve a pasar, el log la dirá |
| Los avisos del editor no se limpiaban: tras adjuntar seguía "falta al menos un documento adjunto", y tras despublicar convivían dos avisos | `components/admin/EditorConvocatoria.tsx`, `DocumentosConvocatoria.tsx` | **resuelto** en la sesión 016: el aviso de documentos lo guarda el editor, y cada acción nueva (guardar, publicar, adjuntar, renombrar, quitar, descargar) empieza sin los avisos anteriores |
| La portada mostraba "Iniciar sesión" y "Crear cuenta" con una sesión abierta | `app/page.tsx` | **resuelto** en la sesión 016 (RF-84): con sesión muestra "Ir a mi portal", que pasa por `/login` y lleva al portal del rol |
| `privado.ficha_publicable` quedó `security definer` (migración `…900005`) por una razón que resultó falsa: su comentario dice que `invoker` colgaba el guardado. Funciona y solo la llaman funciones que comprueban `es_admin()` antes | `supabase/migrations/20260922900005` | baja · valorar volver a `invoker` |
| **Consultar la base remota sin migraciones temporales:** `npx supabase db query --linked "<sql>"` (o `-f archivo.sql`) va por la API de administración, con permisos para ver `pg_stat_activity` y `pg_stat_statements`. Tarda ~5 s por consulta; para muestrear, el bucle va dentro de un `do` con `pg_stat_clear_snapshot()` | herramienta | nota · la sesión 015 creó y retiró dos migraciones para lo mismo |
| Los heredocs de este entorno se comen las barras invertidas: un `
` dentro de una cadena JavaScript se convierte en salto real y rompe el archivo. Pasó dos veces | herramienta | baja · escribir el parche a un archivo aparte |
| No se puede **renombrar una categoría** desde la pantalla, aunque `PATCH /api/admin/categorias/[id]` lo admite desde la sesión 011. Con el botón de borrar el caso queda cubierto a medias (borrar y volver a crear) | `components/admin/GestionCategorias.tsx` | baja · exponer el renombrado |
| Una **fuente** no se puede borrar aunque no tenga convocatorias, que es el mismo argumento aceptado para categorías en la sesión 014. El Product Owner decidió sobre categorías y no se extendió por cuenta propia | `docs/03` RN-07 | baja · preguntarle si quiere lo mismo en fuentes |
| Un servidor `next dev` de una sesión anterior puede seguir vivo y servir código viejo: en la sesión 013 hizo que seis comprobaciones "pasaran" por la razón equivocada (404 porque la ruta aún no existía en ese proceso). `next dev` lo avisa con el PID, pero en su propio log | máquina local | media · antes de creerse un 404, comprobar que responde el servidor de esta sesión |
| Un `next dev` que lleva horas vivo puede corromper su caché y responder **500 en rutas dinámicas** que funcionan perfectamente: al Product Owner le pasó con `PATCH /api/admin/fuentes/[id]` al desactivar una fuente. En `.next/dev/logs/next-development.log`: `Failed to generate static paths` y `Jest worker encountered 2 child process exceptions`. **Se arregla parando el proceso, borrando `.next` y arrancando de nuevo**; reproducido y confirmado con el servidor limpio | máquina local | media · ante un 500 inexplicable, reiniciar con la caché limpia antes de buscar el fallo en el código |
| Ante un 500, la pantalla del panel muestra "No pudimos completar la acción. Intenta de nuevo.", igual que ante un fallo de red. Es correcto de cara al usuario, pero no distingue un servidor caído de un rechazo, y eso alargó el diagnóstico anterior | `lib/admin/peticion.ts` | baja · valorar distinguir el 5xx en el texto |
| **El ensayo de una migración con `raise` en un archivo aparte no ensaya nada**: `supabase db push` corre cada migración en su propia transacción, así que el archivo de ensayo solo se revierte a sí mismo y la migración real anterior ya quedó aplicada | procedimiento de migraciones | **resuelto** en la sesión 012: el paso 6 de `docs/10 §17.3` fija que el `raise` va dentro del propio archivo |
| **En el servidor, el store de Zustand solo tiene su estado inicial (datos de ejemplo).** `useAppStore` responde en el render del servidor con `getInitialState()`, así que cualquier pantalla que lea del store pinta primero datos de ejemplo y el navegador los cambia al hidratar. Se descubrió con el catálogo, que se pasó a props de servidor; siguen así la ficha de generar, postulaciones, sugerencias y el resto del portal | `lib/store.ts`, portal Empresa | media · resolver al pasar cada módulo a Supabase (Sprints 3 y 4) |
| Los nombres con tilde en las descargas firmadas salían doblemente codificados (`T%C3%A9rminos.pdf`): `createSignedUrl({ download })` de storage-js codifica el nombre dos veces | `lib/supabase/descarga.ts` | **resuelto** en la sesión 017, también para el panel; si storage-js lo corrige, se puede volver a su opción |
| "Vigente" se decidía con `current_date` de Postgres, que va en UTC: desde las 7 p. m. hora de Colombia, una convocatoria que cerraba ese día ya contaba como vencida | convocatorias | **resuelto** en la sesión 017: `privado.hoy_colombia()` en el cierre, postular, publicar, indicadores y el catálogo |
| Las suscripciones también usan `current_date` en UTC (`crear_cuenta`, `tiene_suscripcion_vigente`, job 2): un trial o una suscripción vencen 5 horas antes en Colombia | suscripciones | media · aplicar `privado.hoy_colombia()` con el módulo de suscripciones (Sprint 5) |
| ~~**Editar una publicada permite poner una fecha de cierre ya pasada**~~ **Resuelto en la sesión 017** con una advertencia, por decisión del Product Owner (CU-05 3e).: sigue publicada hasta que el job la cierra esa medianoche. Publicar sí rechaza una vencida (RN-03). Puede ser legítimo (la entidad cerró antes), pero hoy no se advierte ni se cierra en el momento. Así quedó la convocatoria de MinCiencias el 23-sep; el Product Owner la corrigió antes de que el job la cerrara | `guardar_convocatoria` | media · decisión del Product Owner: ¿rechazar, advertir o cerrar en el acto? |
| `unstable_cache` (indicadores) está reemplazado por `use cache` en Next 16, pero `use cache` exige activar `cacheComponents` en todo el proyecto | `lib/catalogo.ts` | baja · migrar si se activa `cacheComponents` |
| Las pruebas que crean convocatorias con `service_role` no invalidan la caché de indicadores: si la landing se calcula mientras corren, muestra hasta 1 hora cifras con datos de prueba (pasó el 23-sep). `prueba-catalogo-empresa.mjs` ya mide antes de crear contenido | pruebas | baja · tenerlo en cuenta al leer la landing en local |
| Las suites de JavaScript calculan las fechas de sus convocatorias en UTC (`enDias`); hoy no fallan porque usan márgenes de días enteros, pero una comprobación en el límite exacto de "hoy" fallaría de noche, como le pasó a la prueba RLS | `scripts/prueba-*.mjs` | baja · usar la fecha de Colombia al escribir la próxima que dependa de "hoy" |
| `set role supabase_storage_admin` está negado al rol que corre las migraciones (42501), aunque ese mismo rol sí puede crear políticas sobre `storage.objects` | `supabase/migrations/` | baja · anotado en la migración |
| Si la subida al bucket ocurre y el registro de la fila no, queda un objeto suelto. Es invisible (toda descarga parte de la fila) y la pantalla pide borrarlo, pero nadie barre los que queden de un navegador cerrado a media subida | `lib/admin/documentos.ts` | baja · valorar un job de limpieza antes de los pilotos |
| Borrar una convocatoria arrastra sus filas de `documentos_convocatoria` por `on delete cascade`, pero **no** los objetos del bucket | `supabase/migrations/20260917200000` | baja · mismo job de limpieza |
| `allowed_mime_types` del bucket se compara con el tipo que **declara** el cliente. El servidor lo compensa exigiendo que el tipo que reporta Storage case con la extensión de la ruta, pero nadie inspecciona el contenido del archivo | Storage | baja · valorar antivirus o comprobación de firma antes de los pilotos |
| A un administrador sin MFA, `/api/admin/...` responde 307 a `/mfa`, no 404. Es lo que hace `proxy.ts` desde la sesión 007 y no le entrega datos, pero un `fetch` sigue la redirección y recibe HTML | `proxy.ts` | baja · valorar un 401 JSON para `/api` si molesta al cliente |

---

## Cómo retomar en la próxima sesión

1. Leer este archivo y la última entrada de [`docs/bitacora/`](docs/bitacora/). **Si el incidente de "Bloqueos" sigue abierto, leer también su reporte antes de tocar nada.**
2. Confirmar si alguna decisión abierta se resolvió y si el Product Owner hizo los pendientes 3 y 8.
3. Continuar por "Lo siguiente".
4. **Al cerrar**: actualizar este archivo, `docs/11-avance-por-requerimiento.md`, escribir la entrada de bitácora y hacer commit citando los `RF-xx`/`RNF-xx`.

El ritual completo está en [`docs/10-plan-de-desarrollo.md §17.3`](docs/10-plan-de-desarrollo.md).
