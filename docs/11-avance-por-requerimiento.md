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
| RF-01 Registro con rol y trial | servidor | Sesión 004: `/registro` con Supabase Auth y confirmación de correo; el trigger `al_registrar_cuenta` crea perfil y trial o perfil de consultor. Probado vía la API de Auth; falta el recorrido completo por el formulario con un correo real |
| RF-02 Restringir funciones administrativas | pendiente | Sesión 004: autenticación real; todo portal exige sesión en el servidor y la RLS niega privilegios al no administrador. Sesión 005: la especificación exige además que el panel **no exista** para los demás (404, RF-85). Hoy `/admin` redirige a `/login` sin sesión y se abre con otro rol autenticado |
| RF-03 Recuperación de contraseña | pendiente | Sesión 006: existe `/auth/definir-contrasena`, que recibe el enlace de recuperación o de invitación; falta la pantalla para pedir el correo de recuperación |
| RF-84 Entrada con dos puertas *(v6, sesión 005)* | pendiente | El registro ya ofrece empresa/consultor (sesión 004); faltan la landing y el login con las dos puertas y el aviso de portal equivocado. Cambiar la etiqueta a "empresa o entidad" |
| RF-85 Panel administrativo oculto *(v6, sesión 005)* | pendiente | Sprint 1, junto a `requireRole()`: 404 en `/admin`, `/mfa` y `/api/admin` para no administradores, `noindex` |

### 4.2 Fuentes y convocatorias (administrador)

| RF | Estado | Nota |
|---|---|---|
| RF-04 Fuentes | prototipo | |
| RF-05 Crear convocatoria con enlace oficial | prototipo | |
| RF-06 Categorías | prototipo | |
| RF-07 Adjuntar documentos | prototipo | Sin Storage real |
| RF-08 Requisitos | prototipo | |
| RF-09 Publicar validado | prototipo | Validación solo en cliente; RNF-29 exige servidor |
| RF-10 Cierre automático | servidor | Job `cerrar-convocatorias-vencidas` programado en `pg_cron`, diario 05:00 UTC (sesión 003). Falta ver una ejecución real |

### 4.3 Búsqueda y descubrimiento

| RF | Estado | Nota |
|---|---|---|
| RF-11 Catálogo, cerradas bajo filtro | prototipo | Filtro explícito ya implementado |
| RF-12 Filtros combinables | prototipo | |
| RF-13 Ficha de detalle | prototipo | |
| RF-14 Registrar proyectos | prototipo | Sin columna de propietario |
| RF-15 Sugerencias, solo vigentes | prototipo | |
| RF-16 Porcentaje de compatibilidad | prototipo | |
| RF-43 Chips sugeridos | prototipo | |
| RF-44 Indicadores de la landing | prototipo | Cifra correcta en el primer fotograma. Sesión 006: `public.indicadores_catalogo()` ya da los agregados a `anon` (probado); la landing aún lee el mock |

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
| RF-64 MFA para administradores | servidor | Sesión 004: `/mfa` con TOTP real (enrolar o verificar); el layout de `/admin` redirige toda sesión de administrador sin `aal2`, y RLS no da privilegios sin `aal2`. `GuardaMFA` eliminado |
| RF-65 Registrar eventos de seguridad | prototipo | Sesión 004: `login_fallido`, `mfa_activado` y `mfa_fallido` ya se escriben en `eventos_seguridad` con `service_role`. Faltan `acceso_denegado` (RNF-30) y `limite_tasa` (RNF-27), y el panel sigue leyendo el mock |
| RF-66 Límite de tasa | pendiente | |
| RF-67 Liberar bloqueo | prototipo | |
| RF-86 Solo el Propietario invita y revoca administradores *(v6, sesión 005)* | pendiente | Sesión 006: base lista y probada. Se aplicaron `es_propietario` único, la tabla `invitaciones_admin` con lectura solo del Propietario y el trigger que reconoce la invitación por `app_metadata`; el intento por metadatos del usuario, con otro correo o con una invitación vencida produce empresa. Faltan los endpoints y `/admin/administradores` |
| RF-87 Revocación inmediata *(v6, sesión 005)* | pendiente | Sesión 006: `privado.es_admin()` exige `admin_revocado_at is null`; probado que el admin revocado pierde privilegios con el mismo JWT. Falta el endpoint que cierra sesiones y bloquea la cuenta |

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
| RNF-16 Datos personales | pendiente | 2 | URLs firmadas de 15 min. Storage pasó al Sprint 2 (sesión 006) |
| RNF-17 Integridad del rating | prototipo | 5 | RLS y trigger listos (sesión 003): segunda calificación rechazada, edición sin efecto, rating recalculado |
| RNF-18 Archivos de perfil | pendiente | 2 | Storage pasó al Sprint 2 (sesión 006) |
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
| RNF-29 Validación del enlace | prototipo | 2 | Solo en cliente |
| RNF-30 Autorización por rol | pendiente | 1 | **Causa raíz de la auditoría** |
| RNF-31 Inyección en el TDR | pendiente | 4 | |
| RNF-32 Retención y eliminación | pendiente | 5 | |
| RNF-33 Degradación fail-closed | pendiente | 5 | |
| RNF-34 Lenguaje sin identificadores | prototipo | — | Verificado: 0 en texto renderizado |
| RNF-35 Panel administrativo oculto *(v6, sesión 005)* | pendiente | 1 | Criterio: misma respuesta 404 que una ruta inventada y 0 menciones de `/admin` en lo servido a no administradores |

---

## 24. Reglas de negocio con implementación pendiente

Las 30 reglas están documentadas; estas son las que todavía no se hacen cumplir donde deben:

| RN | Estado | Sprint |
|---|---|---|
| RN-01 Publicación con datos mínimos | prototipo (cliente) | 2 |
| RN-02 Cerrada sale de catálogo y sugerencias | prototipo | 2 |
| RN-03 No postular ni generar sobre cerradas | prototipo (solo UI) | 2 |
| RN-17 Un crédito por generación exitosa | prototipo | 4 — RLS impide crear documentos y tocar el contador de ajustes o los créditos desde el cliente (sesión 003) |
| RN-18 Reinicio mensual, sin acumular | pendiente | 4 |
| RN-23 Saneamiento del TDR | pendiente | 4 |
| RN-06 Rol admin solo por invitación del Propietario *(mod. v6, sesión 005)* | pendiente | 1 — base lista y probada (sesión 006): el registro público no produce administradores y la invitación vigente sí. Falta la pantalla del Propietario para invitar |
| RN-31 Propietario único, designado fuera de la app *(v6)* | servidor | 1 — índice único, check que impide revocar al Propietario y columnas protegidas contra el cliente, todo probado. Propietario designado desde la consola en la sesión 006 |
| RN-33 Catálogo solo para empresas *(v6, sesión 006)* | pendiente | 1 — RLS lista y probada: anónimo y consultor sin encargo ven 0 convocatorias, la empresa ve las vigentes y el público solo recibe los indicadores. Falta que la app lea el catálogo de Supabase (Sprint 2) y la guarda de ruta (RNF-30) |
| RN-32 Cuenta de administrador dedicada *(v6)* | pendiente | 1 — la cuenta invitada nace sin trial ni perfil de consultor (probado); falta que el endpoint de invitación rechace correos que ya tienen cuenta |
| RN-11 Un trial por cuenta de empresa | servidor | 1 — índice único parcial y trigger de registro; el consultor nace sin suscripción (sesión 004) |
| RN-24 RLS desde el Sprint 0 | servidor | 1 — cada tabla nació con su política en la misma migración (sesión 003) |
| RN-26 Contacto solo en `en_curso` | prototipo | 5 |
| RN-27 Autorización derivada | pendiente | 5 — política derivada (autorización ∧ encargo `en_curso`) lista y probada en RLS (sesión 003); faltan los endpoints de compartir y revocar |
| RN-28 Sin cupo propio del consultor | prototipo | 4 — el crédito se resuelve por el propietario del documento, sin respaldo al consultor |
| RN-29 Suspender cancela encargos | prototipo | 5 |
| **RN-30 Propiedad explícita del dato** | prototipo | **1** — columnas y filtro en `lib/store.ts`/`lib/hooks.ts`; migración y RLS hechas y probadas (sesión 003); falta que la aplicación lea de Supabase |

---
