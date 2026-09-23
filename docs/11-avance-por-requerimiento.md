# Avance por requerimiento

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Plan de sprints en [`10-plan-de-desarrollo.md`](10-plan-de-desarrollo.md). Estado vivo en [`ESTADO.md`](../ESTADO.md).

**Se actualiza en cada sesión que cambie el estado de algún requerimiento.** Es la respuesta detallada a "¿qué falta?"; `ESTADO.md` es la respuesta corta.

---

## 21. Cómo leer esta tabla

Cada requerimiento tiene **un** estado:

| Estado | Significa |
|---|---|
| `pendiente` | No existe todavía, ni en el prototipo |
| `prototipo` | Funciona en la interfaz contra datos simulados. **No cuenta como hecho**: la regla vive en el cliente y `lib/store.ts`, no en el servidor |
| `servidor` | Implementado contra Supabase, con la regla aplicada en la capa de aplicación y en RLS donde corresponda |
| `verificado` | Además, su criterio de verificación se ejecutó y pasó, con evidencia en la bitácora |

Solo `verificado` cierra un requerimiento. La distinción entre `prototipo` y `servidor` es la que este proyecto no puede permitirse difuminar: es exactamente el vacío que encontró la auditoría v6 (RNF-20, RN-30).

**Estado inicial · día 0.** La mayoría está en `prototipo`: el modelo v6 está construido en la interfaz, pero no hay backend. Los requerimientos nacidos de la auditoría v6 (RF-76..83, RNF-30..34, RN-30) están `pendiente` salvo los de usabilidad, que ya se implementaron.

---

## 22. Requerimientos funcionales

### 4.1 Gestión de usuarios y acceso

| RF | Estado | Nota |
|---|---|---|
| RF-01 Registro con rol y trial | servidor | Sesión 004: `/registro` con Supabase Auth y confirmación de correo; el trigger `al_registrar_cuenta` crea perfil y trial o perfil de consultor. Probado vía la API de Auth. **Sesión 011 (17-sep, Product Owner):** recorrido completo por el formulario en producción con un correo real, por la puerta de empresa. La cuenta se creó a las 18:15:29, llegó el correo de Supabase, se confirmó 8 s después y entró al portal. En la base: rol `empresa` con nombre de empresa, y trial de 7 días con 3 créditos (RF-37). El mismo correo había sido administrador y revocado: el trigger lo creó como empresa igual (RN-06) |
| RF-02 Restringir funciones administrativas | servidor | Sesión 007: `proxy.ts` aplica la matriz rol × ruta y los layouts la repiten con `exigirRol()`. Empresa y consultor reciben 404 en `/admin`, `/mfa` y `/api/admin`, probado con `scripts/prueba-matriz-roles.mjs` contra el build de producción (sesión 007). La RLS niega privilegios sin rol administrador y `aal2` |
| RF-03 Recuperación de contraseña | servidor | Sesión 006: `/auth/definir-contrasena` recibe el enlace. **Sesión 010:** "¿Olvidaste tu contraseña?" en `/login` → `/auth/recuperar`; la acción `pedirRecuperacion` llama a `resetPasswordForEmail` con el cliente de servicio (flujo implícito, igual que el reenvío de invitaciones) y responde lo mismo exista o no la cuenta. Probado con una cuenta temporal (borrada): enlace de recuperación → contraseña nueva → entra a su portal; la vieja da `invalid_credentials` y la nueva entra. Correo inexistente → mensaje genérico, sin error en el servidor. Enlace inválido → ofrece pedir uno nuevo. **Sin probar:** la llegada del correo real; en local el enlace vuelve a producción (hallazgo de la sesión 006) |
| RF-84 Entrada con dos puertas *(v6, sesión 005)* | servidor | **Sesión 010:** landing, `/registro` y `/login` con "Soy empresa o entidad" / "Soy consultor" (`SelectorPuerta`, `?puerta=`). En el registro la puerta fija el rol (acción + trigger; cualquier otro valor cae en empresa). En el login la acción del servidor lleva siempre al inicio del rol real y agrega `?aviso=puerta` si no coincide; `AvisoPuerta` lo muestra en ambos portales y lo quita de la dirección. El administrador va a `/mfa` sin aviso. Probado en el navegador contra Supabase real con cuentas temporales (borradas): consultor por la puerta de empresa → `/consultor/perfil` con aviso, que no reaparece al recargar; consultor por la suya → sin aviso; empresa por la de consultor → `/convocatorias` con aviso; empresa por la suya → sin aviso; administrador por la de consultor → `/mfa` sin aviso. **Sin probar:** el registro por formulario con un correo real **Sesión 016:** con sesión abierta, la landing muestra "Ir a mi portal" en vez de "Iniciar sesión" y "Crear cuenta"; verificado en el navegador con sesión de administrador (lleva a `/admin`), y sin sesión o con una cookie falsa (sigue "Iniciar sesión") |
| RF-85 Panel administrativo oculto *(v6, sesión 005)* | servidor | Sesión 007: 404 idéntico al de una ruta inventada para anónimo, empresa y consultor; `noindex` en el panel y en `/mfa`; sin enlaces fuera del panel; intento registrado como `acceso_denegado`. Probado con `scripts/prueba-matriz-roles.mjs` contra el build de producción (sesión 007) |

### 4.2 Fuentes y convocatorias (administrador)

| RF | Estado | Nota |
|---|---|---|
| RF-04 Fuentes | servidor | **Sesión 011:** `GET/POST /api/admin/fuentes` y `PATCH /api/admin/fuentes/[id]` (lógica en `lib/admin/catalogo.ts`); `/admin/fuentes` lee y escribe contra Supabase, con notas de parametrización. No se borran: se desactivan (RN-07; la tabla no tiene política de delete, comprobado). URL validada http/https en el servidor. **Sesión 014:** dos fuentes no pueden llamarse igual —la comparación ignora tildes, mayúsculas y espacios sobrantes (docs/05 §9.16); antes la tabla no tenía ninguna restricción de nombre. Probado con `scripts/prueba-catalogo-admin.mjs` contra Supabase real y cuentas temporales (borradas): 40 comprobaciones pasan: anónimo, empresa → 404; administrador sin MFA → 307 a `/mfa`; otro origen → 403. **Sin probar:** la pantalla en el navegador con sesión |
| RF-05 Crear convocatoria con enlace oficial | servidor | **Sesión 011:** `POST /api/admin/convocatorias` crea en `borrador` con `creado_por`, exigiendo fuente activa (CU-02); `PATCH /api/admin/convocatorias/[id]` guarda la ficha con `guardar_convocatoria` (docs/05 §9.13), que no cambia el estado. `/admin/convocatorias` y el editor leen de Supabase. Probado con `scripts/prueba-catalogo-admin.mjs` contra Supabase real y cuentas temporales (borradas): 40 comprobaciones pasan: pedir `estado: publicada` al crear o guardar no publica; fecha o montos inválidos → 400. Sección 9 de la prueba de RLS. **Sin probar:** la pantalla en el navegador con sesión **Sesión 016:** los montos aceptan el formato colombiano (`1.000.000`, `$ 50.000.000`) y rechazan con mensaje lo ambiguo (CU-02 2b, `lib/montos.ts`); antes, `1.000.000` tecleado se guardaba como **1 peso**. Verificado con el teclado en el navegador, en `prueba-catalogo-admin.mjs` (8 comprobaciones nuevas, todo pasa) y con 31 casos del lector |
| RF-06 Categorías | servidor | **Sesión 011:** `GET/POST /api/admin/categorias` y `PATCH .../[id]` (renombrar, activar/desactivar; no se borran). Asignación a convocatorias dentro de `guardar_convocatoria`: solo activas o ya asignadas. Probado: duplicada → 409, tipo inválido → 400, asignar inactiva → 400 (endpoint y RLS). **Sesión 014**, a partir de dos hallazgos del Product Owner probando el panel: los nombres se comparan **sin tildes ni mayúsculas** (`Transformación digital` = `Transformacion digital`), y **una categoría que ninguna convocatoria usa se borra** con `DELETE .../categorias/[id]`, con la RLS como barrera y 409 con el motivo si ya clasifica algo (RN-07, docs/05 §9.16). El listado trae el conteo de uso y el botón solo sale donde borrar es posible. **Pendiente:** el portal Empresa sigue leyendo las categorías del mock (Sprint 2, paso 4) |
| RF-07 Adjuntar documentos | verificado | **Sesión 012:** adjuntos reales en Storage (docs/05 §9.14). `POST .../documentos/subida` valida nombre, tipo, extensión y tamaño y firma la subida con la ruta que decide el servidor; el archivo va del navegador al bucket (una función de Vercel no admite 20 MB); `POST .../documentos` registra la fila solo si el objeto existe y con el tamaño y el tipo **reales leídos de Storage**. `PATCH .../[docId]` renombra o cambia el tipo —un trigger impide que ese update toque el archivo— y `DELETE` quita fila y objeto (CU-03 1a). Probado con `scripts/prueba-adjuntos-convocatoria.mjs` contra Supabase real: 45 comprobaciones pasan, incluida una subida y una descarga de verdad. **Sesión 016:** la pantalla se recorrió en el navegador con la sesión del Product Owner (subir PDF, rechazo de `.txt`, descargar y quitar), y **una publicada ya no pierde su último adjunto** (CU-03 1b): trigger `before delete` en la base y 409 en el endpoint (migración `20260922960000`). Verificado en pantalla y en `supabase/tests/guardar_publicada_completa.sql` (8/8). La suite de adjuntos se volvió a correr sin regresiones **Verificado en la sesión 016:** suite de adjuntos entera y pantalla recorrida con sesión real |
| RF-08 Requisitos | servidor | **Sesión 011:** se guardan con la ficha en `guardar_convocatoria`: actualiza los que traen id, inserta los nuevos, borra los que faltan y el orden es la posición. Probado: reordenar, editar, quitar y agregar en una sola petición conserva el id del editado; id de otra convocatoria → 400; retirar un requisito de una publicada no toca el checklist ya copiado (RN-04, prueba de RLS); una publicada no queda sin requisitos (RN-01) |
| RF-09 Publicar validado | verificado | **Sesión 013:** `POST .../publicar` y `.../despublicar` sobre `publicar_convocatoria` (docs/05 §9.15, `security invoker`). El endpoint enumera de una vez **todo** lo que falta (400); la función SQL es la barrera y rechaza igual si se la llama directamente. Registra `publicada_at` y `publicado_por` (RNF-11). No publica lo ya vencido (RN-03), y una `cerrada` con la fecha corregida vuelve a publicarse. Despublicar conserva el rastro (RN-07). **Sesión 015:** RN-01 se amplió por decisión del Product Owner y publicar exige ahora **ubicación, descripción, ≥1 categoría, ≥1 documento adjunto y ≥2 requisitos**, además del enlace; el rechazo los enumera de una vez. El editor **guarda antes de publicar**, para que no se publique una versión distinta de la que se ve. El recorrido A5-A7 se verificó en el navegador con la sesión del Product Owner (19 pasos). **No verificado del todo:** un cuelgue de ~20 s al guardar deja 4 comprobaciones de la suite en rojo. **Sesión 016:** la causa es la red de la máquina de desarrollo, no el código; falta confirmarlo en otra red (ver `ESTADO.md`). **Hueco cerrado en la 016:** `guardar_convocatoria` vuelve a exigir la ficha completa a una publicada (migración `20260922950000`, verificada con `supabase/tests/guardar_publicada_completa.sql`, 6/6). Y el último adjunto también queda protegido (ver RF-07) **Verificado en la sesión 016:** en el punto de acceso Wi-Fi del iPhone del Product Owner (misma tarjeta MT7902 y mismo filtro de VirtualBox), `diagnostico-red-supabase.mjs` salió `RED LIMPIA` dos veces (180/180; en la red de casa fallaban 6 de 90) y `prueba-publicar-convocatoria.mjs` pasó **tres veces seguidas, 39/39, sin un solo reintento**, y el recorrido en el navegador de esta sesión |
| RF-10 Cierre automático | servidor | Job `cerrar-convocatorias-vencidas` programado en `pg_cron`, diario 05:00 UTC (sesión 003). **Sesión 017:** el job ejecuta `privado.cerrar_convocatorias_vencidas()`, que devuelve cuántas cerró, y "hoy" es el día en Colombia (`privado.hoy_colombia()`) en el cierre, en postular (RF-78), en publicar (RN-03) y en los indicadores. Probado con `supabase/tests/cierre_convocatorias.sql` (7/7: cierra la vencida de ayer, deja abierta la que cierra hoy y no toca borradores ni despublicadas). El historial de `pg_cron` muestra una ejecución exitosa cada día desde el 20-sep, siempre con 0 cierres. **Falta ver una ejecución que cierre algo** |

### 4.3 Búsqueda y descubrimiento

| RF | Estado | Nota |
|---|---|---|
| RF-11 Catálogo, cerradas bajo filtro | verificado | **Sesión 017:** el catálogo lee de Supabase con la sesión de la empresa (`lib/catalogo.ts`, `GET /api/convocatorias`): publicadas y vigentes, sin borradores ni vencidas; visitante redirigido a `/login` y consultor con 403 (RN-33), verificado en `scripts/prueba-catalogo-empresa.mjs` (34 comprobaciones, todas pasan). **Paso 5 (misma sesión):** la RLS deja a la empresa leer las cerradas (migración `20260923200000`) y el filtro explícito las trae detrás de las vigentes, marcadas como cerradas; en su ficha las tres acciones de CU-08 quedan deshabilitadas. Verificado en la suite (47 comprobaciones) y en `supabase/tests/rls_aislamiento.sql`. El Product Owner revisó la casilla en pantalla con su cuenta de empresa (23-sep): funciona |
| RF-12 Filtros combinables | verificado | **Sesión 017:** texto libre sin tildes, tipo de proyecto, sector, entidad, ubicación, monto (formato colombiano) y cierre, en un solo módulo (`lib/catalogo-filtros.ts`) que usan la pantalla y el endpoint. 10 comprobaciones de filtros en `scripts/prueba-catalogo-empresa.mjs` (34 comprobaciones, todas pasan) |
| RF-13 Ficha de detalle | verificado | **Sesión 017:** la ficha se lee en el servidor con la sesión de la empresa (un borrador da 404); requisitos, documentos y enlace oficial reales; **Descargar** pide una URL firmada de 15 min y baja el archivo exacto con su nombre descriptivo, tildes incluidas. Verificado en `scripts/prueba-catalogo-empresa.mjs` (34 comprobaciones, todas pasan) |
| RF-14 Registrar proyectos | prototipo | Sin columna de propietario |
| RF-15 Sugerencias, solo vigentes | prototipo | |
| RF-16 Porcentaje de compatibilidad | prototipo | |
| RF-43 Chips sugeridos | servidor | **Sesión 017:** se derivan del catálogo vigente (categorías y ubicaciones más frecuentes), así que ninguno lleva a un resultado vacío (RF-43 mod. v6) |
| RF-44 Indicadores de la landing | verificado | Cifra correcta en el primer fotograma. Sesión 006: `public.indicadores_catalogo()` ya da los agregados a `anon`. **Sesión 017:** la landing y `GET /api/indicadores` los leen en vivo con caché de 1 hora, que se invalida al publicar, despublicar o editar una convocatoria; si no se pueden calcular, no se muestran. Verificado en `scripts/prueba-catalogo-empresa.mjs` (34 comprobaciones, todas pasan) y en el navegador |

### 4.4 Proyectos enriquecidos

| RF | Estado | Nota |
|---|---|---|
| RF-45 Datos de contenido | prototipo | |
| RF-46 Indicador de completitud accionable | prototipo | |
| RF-47 Generar sobre proyecto incompleto | prototipo | |

### 4.5 Postulación y seguimiento

| RF | Estado | Nota |
|---|---|---|
| RF-17 Iniciar postulación con checklist | prototipo | |
| RF-18 Marcar checklist y avance | prototipo | |
| RF-19 Estados con historial | prototipo | |
| RF-20 Panel de postulaciones | prototipo | |
| RF-21 Impedir sobre cerradas | prototipo | Solo deshabilita el botón; ver RF-78 |

### 4.6 Perfil del consultor

| RF | Estado | Nota |
|---|---|---|
| RF-22 Registro en perfil incompleto | prototipo | |
| RF-23 Perfil completo con CV | prototipo | Sin Storage real |
| RF-24 Envío a revisión | prototipo | |
| RF-25 Motivo de rechazo y reenvío | prototipo | |

### 4.7 Directorio y encargos

| RF | Estado | Nota |
|---|---|---|
| RF-26 Directorio filtrado | prototipo | |
| RF-27 Visibilidad del perfil | prototipo | Ver RF-80 |
| RF-28 Solicitar consultor | prototipo | |
| RF-29 Ciclo de estados del encargo | prototipo | |
| RF-30 Aceptar o rechazar | prototipo | |
| RF-31 Asignación interna | prototipo | |
| RF-32 Avances y finalización | prototipo | |
| RF-33 Calificación única | prototipo | Contador corregido al completar |
| RF-68 Contexto del proyecto en el encargo | prototipo | |
| RF-69 Ayuda para encontrar convocatoria | prototipo | |
| RF-70 Revelar contacto al aceptar | prototipo | |
| RF-71 Autorizar documento al consultor | prototipo | |
| RF-72 Bloquear exportación en servidor | pendiente | Hoy solo se oculta el botón |
| RF-73 Ir al portal como acción primaria | prototipo | |
| RF-74 Solicitud directa desde el perfil | prototipo | |
| RF-75 Buscador de convocatorias en el selector | prototipo | |

### 4.8 Gestión de consultores (administrador)

| RF | Estado | Nota |
|---|---|---|
| RF-34 Aprobar/rechazar perfiles | prototipo | |
| RF-35 Suspender y reactivar | prototipo | |

### 4.9 Suscripciones y créditos

| RF | Estado | Nota |
|---|---|---|
| RF-36 Planes administrables por rol | prototipo | |
| RF-37 Trial de empresa | servidor | Sesión 004: **7 días** (antes 14) con 3 créditos, desde el plan `es_trial` y creado por el trigger de registro; único por cuenta por índice. El consumo de los créditos sigue en `lib/store.ts` |
| RF-38 Activación manual | prototipo | |
| RF-39 Job de vencimientos | servidor | Job `vencer-suscripciones` programado en `pg_cron` (sesión 003). Falta ver una ejecución real |
| RF-40 Verificación en acciones restringidas | prototipo | |
| RF-41 Vista del suscriptor | prototipo | |
| RF-42 Tablero admin de suscripciones | prototipo | |
| RF-48 Un crédito por generación exitosa | prototipo | |
| RF-49 Reinicio mensual del cupo | servidor | Job `reiniciar-creditos-ia` programado en `pg_cron` (sesión 003). Falta ver una ejecución real |
| RF-50 Bloquear sin cupo | prototipo | |
| RF-51 Paquetes adicionales | prototipo | |
| RF-52 Registrar consumo con tokens y costo | pendiente | `EstadisticasIA` no guarda tokens ni costo |

### 4.10 Generación documental con IA

| RF | Estado | Nota |
|---|---|---|
| RF-53 Acción de generar/editar | prototipo | |
| RF-54 Lista de proyectos con completitud y cupo | prototipo | |
| RF-55 Construcción del contexto | pendiente | Hoy se compone con plantillas, sin TDR |
| RF-56 Estructura según requisitos | prototipo | Estructura fija, no derivada |
| RF-57 Marcar pendientes | prototipo | `[COMPLETAR: ...]` funcionando |
| RF-58 Vista previa editable | prototipo | |
| RF-59 Tres ajustes gratis | prototipo | |
| RF-60 Exportar a Word | prototipo | Genera HTML con extensión `.doc`, no `.docx` |
| RF-61 Documento ligado a proyecto-convocatoria | prototipo | |
| RF-62 Progreso y fallo controlado | prototipo | Sin tope de 120 s (RNF-21) |
| RF-63 Plantilla del prompt versionada | prototipo | Falta cargar el prompt real |

### 4.11 Seguridad administrativa

| RF | Estado | Nota |
|---|---|---|
| RF-64 MFA para administradores | servidor | Sesión 004: `/mfa` con TOTP real y RLS sin privilegios sin `aal2`. Sesión 007: el proxy lleva a `/mfa` cualquier ruta del panel sin `aal2` (probado). Se corrigió un defecto: `mfa_habilitado` no se guardaba porque `service_role` no tenía uso del esquema `privado` (migración `20260916150000`); el `update` ya no falla en silencio Sesión 009: `confirmarMfa` marca la invitación `aceptada` (CU-42 paso 3); sin probar por la acción, la prueba lo hace con `service_role`. |
| RF-65 Registrar eventos de seguridad | prototipo | Se escriben en `eventos_seguridad`: `login_fallido`, `mfa_activado` y `mfa_fallido` (sesión 004), y `acceso_denegado` desde el proxy y los layouts (sesión 007, probado; las precargas de enlaces no cuentan). Falta `limite_tasa` (RNF-27); el panel sigue leyendo el mock Sesión 009: los endpoints de gestión de administradores escriben `admin_invitado`, `invitacion_cancelada` y `admin_revocado` con el Propietario como autor (sin probar de punta a punta: requiere la sesión del Propietario). |
| RF-66 Límite de tasa | pendiente | |
| RF-67 Liberar bloqueo | prototipo | |
| RF-86 Solo el Propietario invita y revoca administradores *(v6, sesión 005)* | servidor | Sesión 008: base rediseñada (`aceptar_invitacion_admin`, `correo_tiene_cuenta`). **Sesión 009:** endpoints de listar, invitar, reenviar, cancelar y revocar (`app/api/admin/...`, lógica en `lib/admin/administradores.ts`) y pantalla `/admin/administradores`. Tres barreras: la matriz (`soloPropietario` + `soy_propietario()` en `proxy.ts`), `sesionDePropietario()` en la página y cada endpoint, y las funciones SQL `crear_invitacion_admin`, `cancelar_invitacion_admin` y `revocar_admin`, que comprueban el Propietario. Probado: sección 8 de la prueba de RLS; `scripts/prueba-gestion-administradores.mjs` contra Auth real (22 comprobaciones); a otro administrador con MFA, la página, el GET y los POST responden 404 sin efecto (matriz, 58 comprobaciones). **17-sep, Product Owner con la sesión del Propietario:** invitó a un correo real desde la pantalla; llegó el correo de `inviteUserByEmail`, se definió la contraseña, se activó el MFA y la invitación quedó `aceptada` (`confirmarMfa`, CU-42 paso 3). Comprobado en la base: eventos `admin_invitado` y `mfa_activado`, factor TOTP verificado. **Sesión 011:** el Product Owner revocó desde la sesión del Propietario al administrador de prueba y confirmó el 404; en la base, `admin_revocado` a las 13:15:49 y, 9 s después, `acceso_denegado` de la sesión revocada en `/admin`. **Sin probar:** reenviar y cancelar con la sesión del Propietario |
| RF-87 Revocación inmediata *(v6, sesión 005)* | servidor | Regla única `privado.admin_vigente()` (sesión 008). **Sesión 009:** `revocar_admin()` marca la revocación y borra las sesiones de Auth; el endpoint bloquea la cuenta (`ban_duration`) y registra `admin_revocado`. Probado contra Auth real: la misma cookie recibe 404 en `/admin`, el *refresh token* ya no renueva (400) y el inicio de sesión falla con `user_banned`. Se rechazan revocarse a sí mismo, revocar dos veces y revocar a quien no aceptó su invitación. **Sesión 011:** confirmado en producción por el Product Owner (ver RF-86) |

### 4.12 Autorización y aislamiento *(v6)*

| RF | Estado | Nota |
|---|---|---|
| RF-76 Revocación automática en cascada | pendiente | Sprint 5 |
| RF-77 Validar cupo de la empresa dueña | pendiente | Sprint 4 |
| RF-78 Vigencia verificada en servidor | pendiente | La política de insert de `postulaciones` ya exige convocatoria publicada y vigente (probado, sesión 003). Faltan los endpoints de postular y generar: Sprint 2 |
| RF-79 Traza de lectura | pendiente | Sprint 5 |
| RF-80 Contacto por pareja empresa-consultor | prototipo | El perfil cruza solo los encargos de la empresa de la sesión (sesión 002). **RLS lista (sesión 003):** permisos por columna + `contacto_consultor()`, activa = `pendiente`/`en_curso`; prueba cruzada E1/E2 pasada. El prototipo aún cuenta `completado`/`calificado` como activa. Falta el endpoint |

### 4.13 Usabilidad de los flujos *(v6)*

| RF | Estado | Nota |
|---|---|---|
| RF-81 Completitud accionable | prototipo | Implementado y verificado en navegador |
| RF-82 Comparador con atributos reales | prototipo | Implementado y verificado en navegador |
| RF-83 Grafo de transiciones | prototipo | Validado en store; falta en servidor |

---

## 23. Requerimientos no funcionales

| RNF | Estado | Sprint | Nota |
|---|---|---|---|
| RNF-01 Autenticación y acceso | pendiente | 1 | |
| RNF-02 Cifrado | pendiente | 1 | Lo da Supabase + Vercel |
| RNF-03 Aislamiento de datos | prototipo | 1 | Prueba cruzada empresa-1 / empresa-4 pasada en los 4 listados y por URL directa, **sobre mocks**. **RLS probada en Supabase (sesión 003):** 2 empresas y 2 consultores no se ven entre sí en proyectos, postulaciones, documentos ni encargos. Falta repetirla a través de los endpoints |
| RNF-04 Rendimiento del catálogo | pendiente | 2 | |
| RNF-05 Rendimiento de sugerencias | pendiente | 3 | |
| RNF-06 Documentos | pendiente | 2 | |
| RNF-07 Idioma y simplicidad | prototipo | — | Plurales corregidos |
| RNF-08 Responsivo | prototipo | — | Barra pública corregida |
| RNF-09 Disponibilidad | pendiente | 5 | |
| RNF-10 Respaldos | pendiente | 5 | |
| RNF-11 Trazabilidad | pendiente | 5 | Incluye RF-79 |
| RNF-12 Consistencia | pendiente | 1 | |
| RNF-13 Evolución | — | — | Atributo de diseño, ya satisfecho |
| RNF-14 Catálogos administrables | prototipo | 4 | RF-82 ya lo respeta |
| RNF-15 Portabilidad | — | — | Atributo de diseño |
| RNF-16 Datos personales | servidor | 2 | **Sesión 012:** los 3 buckets existen y **los tres son privados** (se corrigió `docs/04`, que dejaba públicos dos: con RN-33 los adjuntos no pueden servirse a quien adivine la ruta). La descarga es siempre una URL firmada de 15 min, y quién puede pedirla lo decide la RLS sobre la fila, no la ruta. Probado: `exp - iat` del token = 900 s; la ruta sin firmar → denegada; una cuenta de empresa no lista ni escribe en el bucket. **Falta** lo del consultor: la parte de hoja de vida y la prueba cruzada por pareja empresa-consultor (RN-12, RF-80) llegan con su módulo **Sesión 017:** la empresa descarga los adjuntos de las convocatorias que puede ver, con una política de Storage que hereda la visibilidad de la fila (docs/05 §9.14); consultor y borradores, rechazados también firmando directo contra Storage |
| RNF-17 Integridad del rating | prototipo | 5 | RLS y trigger listos (sesión 003): segunda calificación rechazada, edición sin efecto, rating recalculado |
| RNF-18 Archivos de perfil y adjuntos | servidor | 2 | **Sesión 012:** el límite y los tipos se declaran **en el bucket** (20 MB y PDF/Word/Excel/ZIP para adjuntos; 5 MB JPG/PNG para la foto; 10 MB PDF para la hoja de vida), así que una subida directa que los incumpla la rechaza Storage aunque nadie la revise. El servidor lo valida antes de firmar y otra vez al registrar, exigiendo que el tipo real case con la extensión; la pantalla avisa primero. Probado: .exe → 400, 21 MB → 400, un PDF subido como .zip → 400 y el objeto se borra. **Falta:** los archivos del perfil del consultor, que llegan con su módulo |
| RNF-19 Rendimiento del directorio | pendiente | 5 | |
| RNF-20 Enforcement en servidor | pendiente | 1–5 | Transversal |
| RNF-21 Generación con IA hasta 120 s | pendiente | 4 | |
| RNF-22 Independencia del proveedor de IA | pendiente | 4 | |
| RNF-23 Veracidad del contenido | prototipo | 4 | El principio está bien implementado |
| RNF-24 Transparencia del uso de IA | pendiente | 4 | |
| RNF-25 Cobertura de RLS | servidor | 1 | 26 tablas con RLS y política (sesión 003). **Sesión 006: 27 tablas** con `invitaciones_admin`; la prueba cruzada comprueba el número de tablas y que todas tengan RLS, y pasa |
| RNF-26 Credenciales elevadas | pendiente | 1 | |
| RNF-27 Límite de tasa | pendiente | 5 | |
| RNF-28 MFA de administradores | servidor | 1 | Sesión 004: enrolamiento TOTP en Supabase Auth y redirección a `/mfa` en el servidor. Probado por código: admin en `aal1` sin privilegios; tras verificar el TOTP, `aal2` y lectura de todo. Falta probar la pantalla en el navegador |
| RNF-29 Validación del enlace | servidor | 2 | **Sesión 011:** `esUrlHttp` en `lib/admin/catalogo.ts` valida antes de guardar (fuentes y enlace oficial) y la restricción de la tabla lo repite. Probado: `javascript:`, cadena inválida, dominio sin punto y `ftp://` → 400 con mensaje claro, sin guardar nada. Falta al publicar (RF-09) |
| RNF-30 Autorización por rol | servidor | 1 | **Causa raíz de la auditoría.** Sesión 007: la matriz está en `lib/autorizacion/matriz.ts` y la aplica `proxy.ts` a páginas, peticiones RSC, Server Actions y `/api`; es cerrada por defecto (una ruta sin declarar responde 404). Segunda barrera en los layouts (`exigirRol`). Matriz ejecutada con `scripts/prueba-matriz-roles.mjs` contra el build de producción (sesión 007): 44 comprobaciones, todas pasan. **Pendiente:** aún no hay endpoints `/api` propios que probar, y la segunda barrera no se ejercitó por separado Sesión 009: primeros endpoints `/api` propios, con reglas solo del Propietario en la matriz; 58 comprobaciones pasan. |
| RNF-31 Inyección en el TDR | pendiente | 4 | |
| RNF-32 Retención y eliminación | pendiente | 5 | |
| RNF-33 Degradación fail-closed | pendiente | 5 | |
| RNF-34 Lenguaje sin identificadores | prototipo | — | Verificado: 0 en texto renderizado |
| RNF-35 Panel administrativo oculto *(v6, sesión 005)* | verificado | 1 | Sesión 007, criterio ejecutado con `scripts/prueba-matriz-roles.mjs` contra el build de producción (sesión 007): `/admin`, `/admin/*`, `/mfa` y `/api/admin/*` dan la misma respuesta 404 (código y cuerpo) que una ruta inventada para anónimo, empresa y consultor. En 22 archivos JS y sus HTML servidos a no administradores no aparece `/admin` ni `/mfa`; se retiraron tres rutas del panel que venían en los eventos del mock. No hay `sitemap` ni `robots.txt` |

---

## 24. Reglas de negocio con implementación pendiente

Las 30 reglas están documentadas; estas son las que todavía no se hacen cumplir donde deben:

| RN | Estado | Sprint |
|---|---|---|
| RN-01 Publicación con datos mínimos | prototipo (cliente) | 2 |
| RN-02 Cerrada sale de catálogo y sugerencias | servidor | 2 | **Sesión 017:** fuera del catálogo por defecto y solo bajo el filtro explícito, en la consulta del servidor; una publicada vencida se presenta como cerrada aunque el job no haya corrido. Postular a una cerrada lo rechaza la RLS (RF-78), comprobado. **Las sugerencias** siguen en el prototipo (Sprint 3) y ya excluyen lo vencido en el cliente |
| RN-03 No postular ni generar sobre cerradas | prototipo (solo UI) | 2 |
| RN-17 Un crédito por generación exitosa | prototipo | 4 — RLS impide crear documentos y tocar el contador de ajustes o los créditos desde el cliente (sesión 003) |
| RN-18 Reinicio mensual, sin acumular | pendiente | 4 |
| RN-23 Saneamiento del TDR | pendiente | 4 |
| RN-06 Rol admin solo por invitación del Propietario *(mod. v6, sesión 005)* | servidor | 1 — el autorregistro nunca produce administradores (trigger, probado). Sesión 009: la invitación solo nace de `crear_invitacion_admin`, que exige al Propietario vigente, y del endpoint solo del Propietario. Falta probar el envío real del correo |
| RN-31 Propietario único, designado fuera de la app *(v6)* | servidor | 1 — índice único, check que impide revocar al Propietario y columnas protegidas contra el cliente, todo probado. Propietario designado desde la consola en la sesión 006 |
| RN-33 Catálogo solo para empresas *(v6, sesión 006)* | pendiente | 1 — RLS lista y probada (sesión 006). Sesión 007: la ruta `/convocatorias` solo admite empresa (consultor y administrador → 403, anónimo → login; probado). Falta que la app lea el catálogo de Supabase (Sprint 2). Sesión 010: la landing ya no muestra convocatorias individuales (quitadas las tres "destacadas"); solo los indicadores agregados, que aún salen del mock (RF-44) |
| RN-32 Cuenta de administrador dedicada *(v6)* | servidor | 1 — `aceptar_invitacion_admin()` rechaza cuentas anteriores y de otro correo y retira el trial (sesión 008). Sesión 009: `crear_invitacion_admin` rechaza un correo con cuenta (probado con `empresa.s004`); el endpoint de invitar lo usa |
| RN-11 Un trial por cuenta de empresa | servidor | 1 — índice único parcial y trigger de registro; el consultor nace sin suscripción (sesión 004) |
| RN-24 RLS desde el Sprint 0 | servidor | 1 — cada tabla nació con su política en la misma migración (sesión 003) |
| RN-26 Contacto solo en `en_curso` | prototipo | 5 |
| RN-27 Autorización derivada | pendiente | 5 — política derivada (autorización ∧ encargo `en_curso`) lista y probada en RLS (sesión 003); faltan los endpoints de compartir y revocar |
| RN-28 Sin cupo propio del consultor | prototipo | 4 — el crédito se resuelve por el propietario del documento, sin respaldo al consultor |
| RN-29 Suspender cancela encargos | prototipo | 5 |
| **RN-30 Propiedad explícita del dato** | prototipo | **1** — columnas y filtro en `lib/store.ts`/`lib/hooks.ts`; migración y RLS hechas y probadas (sesión 003); falta que la aplicación lea de Supabase |

---
