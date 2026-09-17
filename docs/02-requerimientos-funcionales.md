# Requerimientos funcionales (RF-01 a RF-87)

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.

---

## 4. Requerimientos funcionales

**83 requerimientos** (68 Must, 15 Should).

### 4.1 Gestión de usuarios y acceso

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-01 | Registro con elección entre **empresa o entidad** y **consultor**; la elección fija el rol de la cuenta. Ninguna pantalla pública ofrece el rol administrador, que solo se obtiene por invitación del Propietario (RF-86). El registro de empresa inicia el trial de **7 días** con 3 créditos *(mod. v6)* | CU-14 | Must |
| RF-02 | Autenticar y restringir las funciones administrativas al rol administrador; **para cualquier otro usuario, autenticado o no, el panel no existe** (RF-85) *(mod. v6)* | CU-14 | Must |
| RF-03 | Recuperación de contraseña por correo | CU-14 | Should |
| RF-84 | La entrada —landing, registro e inicio de sesión— presenta **dos puertas: "Soy empresa o entidad" y "Soy consultor"**. En el registro la puerta fija el rol. En el inicio de sesión solo orienta: la cuenta entra siempre al portal de su rol y, si la puerta no coincide, se le informa y se le lleva al correcto. Una cuenta de administrador no recibe ese aviso y pasa directo a la verificación en dos pasos *(nuevo v6)* | CU-14 | Must |
| RF-85 | El panel administrativo es **invisible para quien no es administrador**: toda ruta `/admin/*`, la verificación `/mfa` y todo endpoint `/api/admin/*` responden **404, indistinguible de una ruta inexistente**, a visitantes, empresas y consultores. Ningún portal, correo ni página pública enlaza al panel, y sus páginas llevan `noindex`. El intento se registra igualmente como `acceso_denegado` (RF-65) *(nuevo v6)* | CU-14, 41 | Must |

### 4.2 Fuentes y convocatorias (administrador)

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-04 | Crear, editar y desactivar fuentes con nombre, tipo de entidad, URL y notas | CU-01 | Must |
| RF-05 | Crear convocatoria con nombre, entidad, descripción, monto, ubicación, fechas **y el enlace oficial de postulación (URL del portal de la entidad)** *(mod. v5)* | CU-02 | Must |
| RF-06 | Clasificar en categorías: tipo de proyecto, sector y tipo de entidad elegible | CU-02 | Must |
| RF-07 | Adjuntar documentos (TDR, términos, anexos, formatos) con nombre descriptivo | CU-03 | Must |
| RF-08 | Registrar la lista de requisitos exigidos como ítems individuales | CU-04 | Must |
| RF-09 | Publicar solo con datos mínimos **(incluido un enlace de postulación válido)** y ≥1 documento; permitir despublicar y editar *(mod. v5)* | CU-05 | Must |
| RF-10 | Cerrar automáticamente las convocatorias vencidas | CU-06 | Must |

### 4.3 Búsqueda y descubrimiento

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-11 | Catálogo **exclusivo de cuentas de empresa o entidad autenticadas** (RN-33) de publicadas vigentes con búsqueda por texto libre. **Las cerradas quedan fuera del listado por defecto (RN-02); pueden consultarse activando el filtro explícito "incluir convocatorias cerradas", que las marca como tales y mantiene deshabilitadas sus acciones** *(mod. v6)* | CU-07 | Must |
| RF-12 | Filtros combinables: tipo de proyecto, sector, entidad, monto, ubicación, cierre | CU-07 | Must |
| RF-13 | Ficha de detalle con datos, requisitos y descarga de documentos | CU-08 | Must |
| RF-14 | Registrar proyectos con sus datos de clasificación | CU-09 | Must |
| RF-15 | Sugerencias desde un proyecto ordenadas por coincidencias. Requiere suscripción. **Solo se incluyen convocatorias publicadas y vigentes a la fecha: una convocatoria cuya fecha de cierre ya pasó queda excluida aunque el job diario de cierre (CU-06) todavía no la haya marcado** *(mod. v6)* | CU-10 | Must |
| RF-16 | Mostrar cada sugerencia con **porcentaje de compatibilidad** y desglose de criterios que coinciden y que no *(mod. v4)* | CU-10 | Must |
| RF-43 | **Chips de búsqueda sugerida** clickeables en el buscador y en el estado sin resultados, que precargan combinaciones de filtros *(nuevo v4)* | CU-07 | Should |
| RF-44 | **Indicadores públicos del catálogo** en la landing (convocatorias vigentes, monto total disponible en COP, entidades convocantes, consultores aprobados), calculados en vivo con caché de 1 hora. **La cifra real debe ser legible desde el primer fotograma: si se anima el conteo, la animación no puede dejar a la vista un valor distinto del real más allá de una transición imperceptible, porque esa primera lectura es la que capturan las vistas previas y los usuarios que solo echan un vistazo** *(nuevo v4; precisado en v6)* **Son agregados calculados en el servidor que no exponen ninguna convocatoria individual (RN-33)** *(mod. v6)* | CU-36 | Should |

### 4.4 Proyectos enriquecidos *(nuevo v4)*

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-45 | El proyecto debe capturar, además de sus datos de clasificación, **datos de contenido**: problema que resuelve, objetivo general, objetivos específicos, población beneficiaria, actividades principales, resultados esperados, duración en meses, presupuesto estimado y experiencia de la empresa | CU-09 | Must |
| RF-46 | Mostrar un **indicador de completitud del proyecto** con los campos faltantes y su efecto sobre la calidad del documento generado. **El indicador es accionable: desde él se llega a la edición del campo que falta (RF-81)** *(mod. v6)* | CU-09 | Must |
| RF-47 | Permitir generar documentos sobre un proyecto incompleto, advirtiendo previamente del resultado limitado | CU-09, CU-33 | Should |

### 4.5 Postulación y seguimiento

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-17 | Iniciar postulación generando el checklist automáticamente. Requiere suscripción | CU-11 | Must |
| RF-18 | Marcar ítems del checklist y mostrar porcentaje de avance | CU-12 | Must |
| RF-19 | Estados de la postulación con historial fechado, **según el grafo de transiciones declarado en RF-83** *(mod. v6)* | CU-13 | Must |
| RF-20 | Panel del usuario con postulaciones activas, avance y fechas de cierre | CU-12, 13 | Should |
| RF-21 | Impedir postulaciones sobre convocatorias cerradas o despublicadas | CU-06, 11 | Must |

### 4.6 Perfil del consultor

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-22 | Registro con rol consultor en estado "perfil incompleto" con acceso restringido | CU-15 | Must |
| RF-23 | Perfil con foto, nombre profesional, descripción, especialidades, sitio web, redes, portafolio y hoja de vida en PDF | CU-16 | Must |
| RF-24 | Envío a revisión solo con los mínimos completos | CU-17 | Must |
| RF-25 | Mostrar el motivo de rechazo y permitir corregir y reenviar | CU-17 | Must |

### 4.7 Directorio y encargos

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-26 | Directorio solo con consultores aprobados, activos y con suscripción vigente, con filtros por especialidad y rating | CU-20 | Must |
| RF-27 | Perfil completo visible; **hoja de vida, sitio web y redes sociales solo para admins y para la empresa que tenga la solicitud activa con ese consultor** — el alcance exacto del filtro lo fija RF-80 *(mod. v5; precisado en v6)* | CU-21 | Should |
| RF-28 | Acción "Solicitar consultor": **exige elegir tipo de ayuda (convocatoria específica, con selector, o búsqueda de convocatoria) antes de confirmar**; la descripción de la tarea es complementaria. Disponible en la ficha del proyecto, **en la tarjeta del proyecto en el listado (`/proyectos`, mismo modal) y, de forma simétrica, en el detalle de una postulación (CU-13) — ahí el proyecto y la convocatoria quedan preseleccionados (tipo de ayuda fijo en "convocatoria específica"); si la postulación no tiene proyecto vinculado, primero pide vincular uno** *(mod. v5 — antes solo desde la ficha del proyecto)* | CU-19, **13** | Must |
| RF-29 | Solicitud de encargo con su ciclo de estados | CU-22 | Must |
| RF-30 | El consultor acepta o rechaza cada solicitud | CU-18, 22 | Must |
| RF-31 | Asignación interna con bandeja para administradores | CU-23, 26 | Must |
| RF-32 | Registro de avances y marcación de finalización | CU-18 | Must |
| RF-33 | Calificación única por encargo con recálculo del rating. **El contador de encargos completados del consultor avanza al completarse el encargo (CU-18), no al calificarlo: la calificación es potestad de la empresa y puede no llegar nunca, sin que eso deba restarle trayectoria al consultor** *(mod. v6)* | CU-24 | Must |
| **RF-68** | El sistema adjunta automáticamente al encargo los datos de contenido del proyecto (problema, objetivo, población, presupuesto, etc.) y, si se eligió convocatoria específica, sus datos y requisitos — visibles para el consultor desde que recibe la solicitud, antes de aceptar o rechazar *(nuevo v5)* | CU-19, 22 | Must |
| **RF-69** | Cuando el tipo de ayuda es "buscar convocatoria", mostrar al consultor los datos de clasificación del proyecto (categorías, monto buscado, ubicación); el consultor reporta convocatorias candidatas mediante los avances del encargo *(nuevo v5)* | CU-19, 18 | Should |
| **RF-70** | Al aceptar una solicitud de encargo — por directorio o por asignación interna — revelar a empresa y consultor el correo de contacto de la contraparte; no visible mientras el encargo esté `pendiente` o `esperando_asignación` *(nuevo v5)* | CU-18, 22, 23, 26 | Must |
| **RF-71** | Permitir a la empresa autorizar o revocar, para un consultor con encargo `en_curso`, acceso de **lectura, edición manual y solicitud de ajustes con IA** a un documento generado específico — **nunca descarga**; sin autorización explícita el consultor no lo ve, aunque el encargo esté activo *(nuevo v5)* | CU-34, 18 | Must |
| **RF-72** | Bloquear en el servidor el endpoint de exportación del documento (`.../exportar`) para cualquier usuario distinto al dueño (la empresa), incluido un consultor autorizado a editarlo — refuerza RNF-20: la restricción no depende de ocultar el botón en la interfaz *(nuevo v5)* | CU-34 | Must |
| **RF-73** | Mostrar un botón "Ir al portal de la entidad" en la ficha de la convocatoria y en el detalle de la postulación, que abre el enlace oficial de postulación en una pestaña nueva sin salir de la sesión actual. **En el detalle de la postulación es la acción primaria de la pantalla y se presenta con mayor prominencia visual que cualquier otra —incluida "Solicitar consultor"—: si el producto sostiene que la radicación ocurre en el portal de la entidad (RN-19), la interfaz no puede contradecirlo con su jerarquía** *(nuevo v5; precisado en v6)* | CU-08, 13 | Must |
| **RF-74** | Permitir a la empresa solicitar un consultor directamente desde el directorio o su ficha de perfil, eligiendo en el mismo flujo **(a)** un proyecto propio (y opcionalmente el tipo de ayuda: convocatoria específica o buscar convocatoria) **o (b)** una postulación propia ya vinculada a un proyecto — fija automáticamente proyecto y convocatoria — sin depender de haber iniciado la solicitud antes desde la ficha del proyecto (CU-19) *(nuevo v5)* | CU-20, 21, 22 | Must |
| **RF-75** | El selector de "convocatoria específica" dentro de los flujos de solicitud de consultor (RF-28, RF-74) incluye un campo de búsqueda por texto que filtra las convocatorias vigentes por nombre mientras el usuario escribe, en vez de un menú desplegable con toda la lista — relevante a medida que crece el catálogo (RNF-04) *(nuevo v5)* | CU-19, 21 | Should |

### 4.8 Gestión de consultores (administrador)

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-34 | Bandeja de revisión con aprobar o rechazar con motivo obligatorio | CU-25 | Must |
| RF-35 | Suspender y reactivar conservando historial. **Al suspender, cancela de inmediato los encargos `en_curso` del consultor y registra el motivo; reactivar no los revive** *(mod. v5)* | CU-27 | Should |

### 4.9 Suscripciones y créditos

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-36 | Planes administrables por rol con precio mensual, anual **y créditos de IA mensuales**, sin despliegue *(mod. v4)* | CU-31 | Must |
| RF-37 | Trial automático de **7 días** con 3 créditos al registrarse una empresa, único por cuenta; consultores sin trial *(mod. v6)* | CU-28 | Must |
| RF-38 | Activación, renovación y suspensión manual por el administrador, con el modelo preparado para pasarela sin cambios de esquema | CU-28, 31 | Must |
| RF-39 | Job diario de vencimientos con periodo de gracia de 5 días | CU-29, 32 | Must |
| RF-40 | Verificación de suscripción en cada acción restringida, incluida la generación con IA | CU-32 | Must |
| RF-41 | Vista del suscriptor con plan, fechas e historial de pagos; el **cupo de créditos** se muestra únicamente en los planes que lo incluyen — el plan de consultor no lo lleva (RN-28) *(mod. v4; precisado en v6)* | CU-30 | Should |
| RF-42 | Tablero admin de suscripciones por estado **y consumo de IA del periodo** *(mod. v4)* | CU-31 | Should |
| RF-48 | Descontar **un crédito por generación exitosa**; las generaciones fallidas no consumen crédito *(nuevo v4)* | CU-35 | Must |
| RF-49 | Reiniciar el cupo mensualmente según la fecha de la suscripción, también en planes anuales; los créditos no consumidos **no se acumulan** *(nuevo v4)* | CU-35 | Must |
| RF-50 | Bloquear la generación sin cupo mostrando opciones de mejora de plan o compra de paquete adicional *(nuevo v4)* | CU-35 | Must |
| RF-51 | Permitir al administrador otorgar paquetes de créditos adicionales a una suscripción *(nuevo v4)* | CU-31 | Should |
| RF-52 | Registrar cada consumo de IA (tipo, tokens, costo estimado, éxito o fallo) para auditoría y control de costo *(nuevo v4)* | CU-35 | Must |

### 4.10 Generación documental con IA *(nuevo v4)*

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-53 | Ofrecer la acción "Generar documento con IA" (o "Editar documento" si ya existe uno para ese par proyecto-convocatoria) en la ficha de la convocatoria, en la ficha del proyecto y, de forma simétrica, **en el detalle de la postulación** *(mod. v5 — antes solo cubría convocatoria y proyecto)* | CU-33, 34, 13 | Must |
| RF-54 | Presentar la lista de proyectos del usuario con su completitud y el cupo de créditos restante antes de generar | CU-33 | Must |
| RF-55 | Construir el contexto de generación con: datos de contenido del proyecto, datos estructurados de la convocatoria, requisitos definidos por el administrador y texto del TDR adjunto | CU-33 | Must |
| RF-56 | Generar el documento estructurado según los requisitos de la convocatoria; ante ausencia de requisitos, usar una estructura estándar (resumen, problema y justificación, objetivos, población, metodología y actividades, resultados, presupuesto, cronograma, experiencia) | CU-33 | Must |
| RF-57 | Marcar en el documento todo dato sin fuente como pendiente de completar y listar los pendientes al usuario | CU-33, 34 | Must |
| RF-58 | Mostrar el documento en vista previa editable, permitir edición libre sin costo y guardar los cambios | CU-34 | Must |
| RF-59 | Permitir hasta 3 ajustes solicitados a la IA en lenguaje natural por documento sin consumir crédito; a partir del cuarto se consume | CU-34 | Should |
| RF-60 | Exportar el documento a Word (.docx) | CU-34 | Must |
| RF-61 | Guardar cada documento asociado al par proyecto-convocatoria y, si existe, a la postulación correspondiente; conservar las versiones de regeneración | CU-33, 34 | Must |
| RF-62 | Mostrar estado de progreso durante la generación e informar con claridad cualquier fallo, con opción de reintentar | CU-33 | Must |
| RF-63 | La **plantilla de instrucción (prompt)** del generador debe estar almacenada como configuración editable y versionada por el administrador —nunca incrustada en el código—, permitiendo ajustarla, probar variantes y saber con qué versión se generó cada documento | CU-37 | Must |

### 4.11 Seguridad administrativa *(nuevo v5)*

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-64 | Exigir verificación en dos pasos (MFA/TOTP) antes de permitir que una sesión con rol administrador opere cualquier función administrativa | CU-38 | Must |
| RF-65 | Registrar cada evento de seguridad (login fallido, acceso denegado, bloqueo por límite de tasa, activación/fallo de MFA, **invitación, cancelación y revocación de administradores** *(mod. v6)*) con tipo, usuario si aplica, IP, ruta y fecha | CU-39 | Must |
| RF-66 | Aplicar límite de tasa por usuario e IP en los endpoints de la capa de aplicación, en especial en la generación con IA, de forma independiente al cupo de créditos | CU-40 | Must |
| RF-67 | Permitir al administrador liberar manualmente un bloqueo por límite de tasa antes de su expiración | CU-40 | Should |
| RF-86 | Solo el **Propietario de la plataforma** invita administradores, reenvía o cancela invitaciones y revoca accesos. La invitación va a un correo **sin cuenta previa**, vence a las 72 horas y es de un solo uso. Para cualquier otro usuario, incluido un administrador que no es Propietario, la sección y sus endpoints responden 404 (RN-06, RN-31, RN-32) *(nuevo v6)* | CU-41, 42 | Must |
| RF-87 | Revocar un administrador surte efecto **en la siguiente petición**, sin esperar a que caduque su sesión: pierde todo privilegio en el servidor y en RLS, se cierran sus sesiones y la cuenta queda bloqueada. Su perfil se conserva para la auditoría *(nuevo v6)* | CU-41 | Must |

### 4.12 Autorización y aislamiento *(nuevo v6)*

Requerimientos derivados de la auditoría de implementación. Traducen a comportamiento exigible las reglas RN-12, RN-27, RN-28 y RN-30, que hasta ahora declaraban el *qué* sin fijar el *cómo se hace cumplir*.

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-76 | **Revocar automáticamente en cascada** las autorizaciones de documento de un consultor cuando el encargo que las sustenta sale de `en_curso` (completado, cancelado o rechazado), cuando el administrador suspende su perfil o cuando vence su suscripción. La revocación no depende de una acción manual de la empresa (RN-27, RN-29) | CU-27, 32, 34 | Must |
| RF-77 | Validar el cupo de la **empresa dueña** del documento antes de aplicar cualquier ajuste con IA solicitado por un consultor autorizado; sin cupo disponible se rechaza sin consumir crédito y sin modificar el documento, con un mensaje dirigido al consultor que le indique que debe avisar a la empresa (RN-28, RNF-20) | CU-34 | Must |
| RF-78 | Verificar **en el servidor** que la convocatoria esté `publicada` y vigente antes de generar un documento o crear una postulación sobre ella; la restricción no puede depender de deshabilitar el botón en la interfaz, del mismo modo que RF-72 protege la exportación (RN-03, RNF-20) | CU-11, 33 | Must |
| RF-79 | Registrar cada **acceso de lectura** de un consultor a un documento autorizado, no solo las ediciones, de modo que tras revocar la autorización pueda reconstruirse qué consultó mientras estuvo activa (RNF-11) | CU-34 | Should |
| RF-80 | Revelar sitio web, redes sociales y hoja de vida de un consultor únicamente cuando exista una solicitud activa **entre ese consultor y la empresa autenticada**; la existencia de solicitudes de otras empresas no habilita la visibilidad. **Una solicitud es activa mientras su encargo está `pendiente` o `en_curso`**; al completarse, calificarse, rechazarse o cancelarse, los datos vuelven a ocultarse (RN-12, RNF-16) *(precisado en v6, sesión 003)* | CU-21 | Must |

### 4.13 Usabilidad de los flujos *(nuevo v6)*

Requerimientos derivados de la auditoría de interfaz. Cada uno corrige un punto donde la aplicación informa correctamente pero no deja actuar, o donde la presentación contradice lo que el producto afirma.

| ID | Requerimiento | CU | Prioridad |
|---|---|---|---|
| RF-81 | Permitir **completar y editar los datos de contenido del proyecto desde la propia ficha del proyecto**, en el mismo lugar donde el indicador de completitud enumera los campos que faltan. Todo enlace o aviso que invite a "completar el proyecto" —incluido el de la pantalla de generación cuando la completitud es baja (RF-47)— debe conducir a un punto donde la edición sea posible, nunca a una pantalla que solo describa la carencia | CU-09, 33 | Must |
| RF-82 | El comparador de planes muestra, para cada plan, **los atributos que efectivamente lo diferencian —en particular el cupo de créditos de IA mensual—** leídos del dato del plan y no de una lista de beneficios fija en el código (RNF-14). Dos planes de distinto precio nunca presentan el mismo conjunto de beneficios: si el usuario no puede ver en qué se diferencian, no puede elegir | CU-28, 31 | Must |
| RF-83 | Las transiciones de estado de la postulación siguen un **grafo declarado**: la interfaz ofrece únicamente los estados alcanzables desde el actual, el servidor rechaza cualquier otro, y las transiciones terminales o difíciles de revertir piden confirmación explícita antes de aplicarse | CU-13 | Must |

---

