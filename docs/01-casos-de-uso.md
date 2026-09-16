# Casos de uso (CU-01 a CU-40)

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.

---

## 3. Casos de uso

**38 casos de uso** en 10 módulos. Marcados *(mod. v4)* / *(nuevo v4)* los tocados en esa versión, y *(nuevo v5)* los agregados en la extensión de seguridad.

### Módulo A — Gestión de convocatorias (Administrador)

#### CU-01 · Parametrizar fuente

| Campo | Contenido |
|---|---|
| **Actor** | Administrador de Contenido |
| **Descripción** | Registrar o editar fuentes de convocatorias |
| **Precondiciones** | Sesión con rol administrador |
| **Flujo principal** | 1. Abre el módulo de fuentes. 2. Crea una fuente con nombre, tipo de entidad (pública/cámara/cooperante/fondo), URL y notas de parametrización. 3. El sistema guarda y la lista como activa |
| **Flujos alternos** | 3a. Editar. 3b. Desactivar (no se elimina: conserva convocatorias históricas) |
| **Postcondiciones** | Fuente disponible para asociar convocatorias |

#### CU-02 · Cargar convocatoria *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Actor** | Administrador de Contenido |
| **Precondiciones** | Existe al menos una fuente activa |
| **Flujo principal** | 1. Crea la convocatoria asociada a una fuente. 2. Digita nombre, entidad convocante, descripción/objeto, monto mínimo y máximo, ubicación o cobertura, fecha de apertura y de cierre **y el enlace oficial de postulación (URL del portal de la entidad convocante)**. 3. Asigna categorías: tipo de proyecto, sector, tipo de entidad elegible. 4. Queda en estado **borrador** |
| **Flujos alternos** | 2a. Guardar incompleta y continuar después |
| **Incluye** | CU-03 |

#### CU-03 · Adjuntar documentos

| Campo | Contenido |
|---|---|
| **Actor** | Administrador de Contenido |
| **Descripción** | Adjuntar TDR, términos, anexos y formatos. Quedan disponibles para descarga del usuario **y como contexto de la generación con IA (CU-33)** |
| **Flujo principal** | 1. Adjunta archivos indicando su tipo. 2. Asigna nombre descriptivo. 3. Se almacenan en Supabase Storage vinculados a la convocatoria |
| **Flujos alternos** | 1a. Reemplazar o eliminar antes de publicar |
| **Relación** | Incluido en CU-02 |

#### CU-04 · Definir requisitos de postulación

| Campo | Contenido |
|---|---|
| **Actor** | Administrador de Contenido |
| **Descripción** | Lista de requisitos y documentos exigidos; genera el checklist (CU-11) y orienta la estructura del documento generado (CU-33) |
| **Flujo principal** | 1. Agrega ítems. 2. Define descripción, tipo (documento/condición), obligatoriedad y orden. 3. Guarda la lista |

#### CU-05 · Publicar convocatoria *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Precondiciones** | Datos mínimos **(incluido el enlace oficial de postulación)** + ≥1 documento adjunto + requisitos definidos |
| **Flujo principal** | 1. Revisa la ficha. 2. "Publicar". 3. El sistema valida y cambia a **publicada** registrando quién y cuándo |
| **Flujos alternos** | 3a. Falla la validación → indica qué falta, **incluido un enlace de postulación faltante o inválido**. 3b. Despublicar. 3c. Editar (auditado) |

#### CU-06 · Cerrar convocatoria vencida (automático)

| Campo | Contenido |
|---|---|
| **Actor** | Reloj del sistema (pg_cron) |
| **Flujo principal** | Job diario: las publicadas con `fecha_cierre < hoy` pasan a **cerrada** y salen del catálogo, de las sugerencias y de la generación con IA |

### Módulo B — Búsqueda y descubrimiento (Usuario Empresa)

#### CU-07 · Explorar catálogo con filtros *(mod. v4)*

| Campo | Contenido |
|---|---|
| **Actor** | Usuario Empresa |
| **Descripción** | Camino directo de búsqueda, navegable sin suscripción activa (modo consulta) |
| **Flujo principal** | 1. Abre el catálogo (publicadas y vigentes). 2. Busca por texto libre. 3. Aplica filtros combinables: tipo de proyecto, sector, entidad, rango de monto, ubicación, fecha de cierre. 4. Resultados en < 2 s |
| **Flujos alternos** | 2a. **Chips de búsqueda sugerida** clickeables ("innovación agro Antioquia", "cooperación internacional ambiental") que precargan filtros y enseñan a usar la herramienta *(nuevo v4)*. 4a. Sin resultados → chips alternativos y sugerencia de relajar filtros |

#### CU-08 · Ver detalle y descargar documentos *(mod. v4, mod. v5)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Abre la convocatoria. 2. Ve datos completos, categorías, requisitos y fechas. 3. Descarga documentos (URLs firmadas). 4. Dispone de tres acciones: **"Postular"** (CU-11), **"Generar documento con IA"** (CU-33) y **"Ir al portal de la entidad"** — abre el enlace oficial de postulación en una pestaña nueva *(v5)* |

#### CU-09 · Registrar proyecto *(mod. v4 — enriquecido)*

| Campo | Contenido |
|---|---|
| **Actor** | Usuario Empresa |
| **Descripción** | El proyecto deja de ser solo un conjunto de atributos de filtrado y pasa a ser **el insumo de contenido de la generación con IA**. Se llena una vez y se reutiliza en todas las postulaciones |
| **Flujo principal** | 1. **Datos de clasificación** (los que alimentan filtros y sugerencias): nombre, monto buscado, ubicación, categorías (tipo de proyecto, sector, tipo de entidad). 2. **Datos de contenido** (los que alimentan la IA): problema que resuelve, objetivo general, objetivos específicos, población beneficiaria, actividades principales, resultados esperados, duración en meses, presupuesto estimado y experiencia o trayectoria de la empresa. 3. El sistema calcula y muestra un **indicador de completitud del proyecto**, advirtiendo que a mayor completitud, mejor el documento generado |
| **Flujos alternos** | 1a. Guardar con solo los datos de clasificación: sirve para buscar, pero al generar documento el sistema avisa qué falta. 2a. Editar o eliminar un proyecto propio |
| **Postcondiciones** | Proyecto disponible para sugerencias (CU-10), generación con IA (CU-33) y solicitud de consultor (CU-19). **Los campos que el indicador de completitud señala como faltantes se pueden diligenciar desde la propia ficha, sin volver al listado (RF-81)** *(ampliado en v6)* |

#### CU-10 · Obtener convocatorias sugeridas *(mod. v4 — porcentaje)*

| Campo | Contenido |
|---|---|
| **Precondiciones** | Proyecto registrado + suscripción activa o trial |
| **Flujo principal** | 1. Abre "Sugerencias" desde su proyecto. 2. El sistema cruza categorías proyecto × convocatoria vigente, más monto y ubicación. 3. Presenta cada resultado con un **porcentaje de compatibilidad** (criterios coincidentes sobre criterios evaluados) y el desglose de qué coincide y qué no. 4. Ordena de mayor a menor compatibilidad. 5. Responde en < 3 s |
| **Flujos alternos** | 2a. Sin coincidencias → indica qué atributo restringe más |
| **Nota** | El porcentaje es presentación del mismo cálculo determinístico de coincidencias: **no interviene IA** y así se comunica al usuario (RN-05) |

#### CU-36 · Ver indicadores públicos del catálogo *(nuevo v4)*

| Campo | Contenido |
|---|---|
| **Actor** | Visitante / Usuario Empresa |
| **Descripción** | La landing muestra contadores calculados en vivo desde el catálogo: convocatorias vigentes, monto total disponible en COP, número de entidades convocantes y consultores aprobados |
| **Flujo principal** | 1. El visitante abre la landing. 2. El sistema calcula los indicadores sobre convocatorias publicadas vigentes (con caché de 1 hora). 3. Los muestra como prueba social junto al llamado a registrarse |
| **Postcondiciones** | Ninguna (consulta pública) |

### Módulo C — Postulación y seguimiento (Usuario Empresa)

#### CU-11 · Iniciar postulación

| Campo | Contenido |
|---|---|
| **Precondiciones** | Convocatoria publicada y vigente + suscripción activa o trial |
| **Flujo principal** | 1. "Postular" desde la ficha. 2. Opcionalmente vincula un proyecto. 3. Se crea la postulación **en preparación** y se **copian** los requisitos como checklist |
| **Flujos alternos** | 1a. Cerrada o despublicada → bloqueado. 1b. Sin suscripción → modal de suscripción |
| **Nota** | La postulación es un **expediente de preparación**: la radicación se hace en el portal de la entidad (RN-19) |

#### CU-12 · Gestionar checklist

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Abre la postulación. 2. Marca ítems completados o pendientes. 3. El sistema recalcula el porcentaje de avance |

#### CU-13 · Actualizar estado de postulación *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Cambia el estado siguiendo el grafo declarado (RF-83): en preparación → presentada → en evaluación → aprobada/rechazada → cerrada; **solo se ofrecen los estados alcanzables desde el actual, y las transiciones terminales piden confirmación**. 2. Cada transición queda en el historial con quién y cuándo. **3. El detalle de la postulación ofrece "Generar documento con IA" (CU-33) si aún no existe un documento para ese proyecto-convocatoria, o "Editar documento" (CU-34) si ya existe. 4. Botón "Ir al portal de la entidad", que abre el enlace oficial de postulación en una pestaña nueva — refuerza que la radicación se hace ahí, no en la plataforma (RN-19). 5. Botón "Solicitar consultor" (CU-19), con el proyecto y la convocatoria de la postulación ya preseleccionados (tipo de ayuda fijo en "convocatoria específica") (RF-28)** |
| **Flujos alternos** | 1a. Panel con todas las postulaciones activas, avance y fechas. **3a. Si la postulación no tiene un proyecto vinculado (CU-11, flujo 2), el botón primero pide elegir o vincular uno antes de continuar a la generación. 5a. Igual restricción aplica a "Solicitar consultor": sin proyecto vinculado, primero pide elegir o vincularlo** |

### Módulo D — Cuenta

#### CU-14 · Registrarse / iniciar sesión

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Registro con correo y contraseña eligiendo rol **empresa** o **consultor**. 2. Empresa → acceso inmediato + trial de **7 días** *(mod. v6)* con 3 créditos de IA. Consultor → estado "perfil incompleto". 3. Login y recuperación de contraseña. El rol administrador se asigna manualmente |

### Módulo E — Perfil del consultor (Consultor)

#### CU-15 · Registrarse como consultor

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Se registra con rol consultor. 2. Se crea la cuenta y el perfil vacío. 3. Solo accede a la edición de su perfil hasta ser aprobado |

#### CU-16 · Crear y editar perfil de consultor

| Campo | Contenido |
|---|---|
| **Precondiciones** | Consentimiento de tratamiento de datos aceptado |
| **Flujo principal** | 1. Foto, nombre profesional, descripción. 2. Especialidades del catálogo de categorías. 3. Página web y redes (LinkedIn, Instagram, Facebook, otras). 4. Portafolio: proyectos previos con nombre, entidad, año, descripción y resultado. 5. Hoja de vida en PDF |
| **Flujos alternos** | Cambios de portafolio o redes tras la aprobación no requieren re-aprobación |
| **Nota** *(v5)* | El consultor los carga y el administrador los usa para verificar veracidad en CU-25; **la empresa solo los ve si tiene una solicitud activa con ese consultor** (RN-12, CU-21) |

#### CU-17 · Enviar perfil a revisión

| Campo | Contenido |
|---|---|
| **Precondiciones** | Mínimos: foto, descripción, ≥1 especialidad y hoja de vida |
| **Flujo principal** | 1. "Enviar a revisión". 2. Pasa a `en_revision` y entra a la bandeja de administradores. 3. Ve el estado de su solicitud |
| **Flujos alternos** | 3a. Rechazado → ve el motivo, corrige y reenvía sin límite |

#### CU-18 · Gestionar encargos *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Precondiciones** | Perfil aprobado. Para aceptar nuevos: suscripción activa |
| **Flujo principal** | 1. Ve solicitudes: proyecto (contenido completo, RF-68), convocatoria si aplica, tarea y tipo de ayuda — si es "buscar convocatoria", ve los datos de clasificación del proyecto para orientar la búsqueda (RF-69). 2. **Acepta** (revela el correo de la empresa, RF-70) o **rechaza**. 3. Si el tipo de ayuda es "buscar convocatoria", reporta candidatas mediante notas de avance. 4. Registra notas de avance. 5. Marca finalización → la empresa puede calificar |
| **Flujos alternos** | **2a.** Suscripción vencida → termina los encargos en curso, no acepta nuevos. Igual que en CU-27, pasan a `cancelado` con motivo registrado ("Suscripción del consultor vencida") — mismo efecto en el dato, dos disparadores distintos (RN-10, RN-29). En el MVP este disparador es el job diario de `pg_cron` (CU-32); no tiene un botón equivalente en el prototipo mientras no exista ese job |

### Módulo F — Contratación de consultores (Usuario Empresa)

#### CU-19 · Solicitar consultor para una tarea *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Precondiciones** | Proyecto registrado + suscripción activa o trial |
| **Flujo principal** | 1. "Solicitar consultor" en la ficha del proyecto. **2. Elige el tipo de ayuda: (a) ayuda con una convocatoria específica — busca por nombre y selecciona de su catálogo o postulaciones la convocatoria a la que quiere aplicar (RF-75); o (b) ayuda para encontrar una convocatoria — no selecciona ninguna.** 3. Describe la tarea (título y descripción, complementaria al contexto ya adjunto). **4. El sistema adjunta automáticamente los datos de contenido del proyecto y, si aplica, los de la convocatoria elegida y sus requisitos (RF-68).** 5. Elige camino: directorio (CU-20) o asignación interna (CU-23) |
| **Flujos alternos** | **1a.** También se abre directo desde la tarjeta del proyecto en el listado (`/proyectos`), sin entrar a la ficha completa — mismo modal, mismo resultado (RF-28). **2a.** Si elige "convocatoria específica" y ya existe una postulación en curso de ese proyecto a esa convocatoria, se vincula automáticamente — el consultor verá también el checklist. **2b.** Iniciado desde el detalle de una postulación (CU-13): el proyecto y la convocatoria quedan preseleccionados (tipo de ayuda fijo en "convocatoria específica"); si la postulación no tiene proyecto vinculado, primero pide vincular uno |

#### CU-20 · Explorar directorio de consultores *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Descripción** | Solo consultores aprobados, activos y con suscripción vigente |
| **Flujo principal** | 1. Tarjetas con foto, nombre, rating, especialidades y encargos completados. 2. Filtra por especialidad y rating. 3. Entra al perfil de un consultor (CU-21), desde donde puede solicitarlo directamente sin depender de haber iniciado la solicitud desde CU-19 **(RF-74, nuevo v5)** |
| **Flujos alternos** | 1a. Directorio vacío → ofrece directamente la asignación interna. **1b. Si ya inició una solicitud desde la ficha de un proyecto (CU-19), un aviso lo recuerda y cada tarjeta lleva directo a confirmarla en el perfil elegido** |

#### CU-21 · Ver perfil del consultor *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Rating con reseñas, descripción, portafolio. **2. Sitio web, redes y hoja de vida solo si existe una solicitud activa entre ese consultor y la empresa que está mirando (RN-12, RF-80) — que otra empresa tenga una solicitud abierta con él no habilita a las demás; sin solicitud propia, esos campos aparecen ocultos con una nota de por qué. 3. Botón "Solicitar a este consultor": elige un proyecto propio (y, si aplica, el tipo de ayuda y la convocatoria — con buscador por nombre, RF-75 — igual que CU-19) o una postulación propia ya vinculada a un proyecto — la postulación resuelve proyecto y convocatoria en un solo paso. 4. Describe la tarea y confirma: crea el encargo `pendiente` vía directorio, el mismo resultado que CU-22, sin pasar antes por CU-19/CU-20 (RF-74, nuevo v5)** |
| **Flujos alternos** | **3a.** Si ya trae una solicitud iniciada desde su proyecto (CU-19 → CU-20), el botón pasa a ser "Solicitar para mi tarea" y usa esos datos en vez de abrir el selector. **3b.** Sin proyectos ni postulaciones propias → invita a crear un proyecto primero |
| **Nota** | La restricción de redes protege el sentido de la suscripción del consultor: si fueran públicas desde el perfil, la empresa podría contactarlo por fuera sin pasar nunca por la plataforma |

#### CU-22 · Enviar solicitud a un consultor *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Envía la solicitud: tarea + tipo de ayuda + contexto del proyecto y convocatoria ya adjuntos, sea desde CU-19 o elegidos directamente en el perfil del consultor (CU-21, RF-74). 2. Queda `pendiente`. **3. El consultor ve el contexto completo antes de decidir. 4. Acepta (→ `en_curso`): el sistema revela a ambas partes el correo de contacto de la otra (RF-70), o rechaza** |
| **Flujos alternos** | 4a. Rechazada → puede enviarla a otro o pasar a asignación interna; el correo **no** se revela |
| **Nota** *(v5)* | Tiene dos puntos de entrada equivalentes — desde el proyecto (CU-19 → CU-20 → CU-21) o directo desde el directorio/perfil (CU-20/21, RF-74) — ambos producen el mismo encargo `pendiente` vía `directorio` |

#### CU-23 · Solicitar asignación de consultor interno *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. "Pedir que me asignen un consultor". 2. El encargo queda `esperando_asignacion` y notifica a los administradores, con el contexto ya adjunto (CU-19). 3. El admin asigna un consultor del equipo (CU-26). **4. Al asignarse (→ `en_curso`), el sistema revela a ambas partes el correo de contacto de la otra (RF-70)**. 5. La empresa lo ve como cualquier encargo en curso |

#### CU-24 · Calificar al consultor

| Campo | Contenido |
|---|---|
| **Precondiciones** | Encargo `completado` sin calificación previa |
| **Flujo principal** | 1. El sistema invita a calificar. 2. 1 a 5 estrellas + comentario opcional. 3. Se guarda (inmutable), se recalcula el rating y el encargo pasa a `calificado` |

### Módulo G — Gestión de consultores (Administrador)

#### CU-25 · Revisar solicitudes de ingreso

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Bandeja de perfiles `en_revision`. 2. Revisa información, portafolio y hoja de vida. 3. **Aprueba** (entra al directorio y comienza su suscripción) o **rechaza con motivo obligatorio** |

#### CU-26 · Atender solicitudes de asignación interna *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Bandeja de encargos `esperando_asignacion`. 2. Revisa proyecto (contexto completo), tarea y tipo de ayuda. 3. Asigna un consultor del equipo interno. 4. El encargo pasa a `en_curso` y **el sistema revela el correo de contacto a empresa y consultor (RF-70)** |

#### CU-27 · Administrar consultores activos *(mod. v5)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Lista con estado, rating y encargos. 2. **Suspende** (sale del directorio, conserva historial) o **reactiva**. **3. Al suspender, sus encargos `en_curso` pasan a `cancelado` de inmediato, con un motivo registrado ("Consultor suspendido por el administrador"); el historial y las calificaciones ya emitidas no se alteran (RN-29). 4. La misma acción revoca en cascada las autorizaciones de documento que tuviera sobre esos encargos, de modo que pierde el acceso al instante sin que la empresa tenga que intervenir (RF-76, RN-27)** |
| **Flujos alternos** | **3a.** Reactivar el perfil no revive los encargos cancelados — la empresa debe solicitar de nuevo si quiere retomar el trabajo con ese consultor |

### Módulo H — Suscripciones y créditos

#### CU-28 · Elegir plan y suscribirse *(mod. v4)*

| Campo | Contenido |
|---|---|
| **Descripción** | Planes por rol, modalidad mensual o anual (con descuento), **diferenciados por volumen de créditos de IA** |
| **Precondiciones** | Empresa: cuenta creada. Consultor: perfil aprobado (nunca paga antes) |
| **Flujo principal** | 1. Ve los planes de su rol con precios y créditos incluidos. 2. Elige plan y modalidad. 3. **Piloto:** pago acordado por fuera y activación por el administrador. **Con pasarela:** pago en línea y activación automática |
| **Postcondiciones** | Suscripción `activa` con fechas y cupo de créditos del periodo |

#### CU-29 · Renovar suscripción

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Avisos al acercarse el vencimiento. 2. Vencida → `en_gracia` por 5 días. 3. Renovada → nueva fecha de vencimiento y cupo. 4. No renovada tras la gracia → `vencida` y se restringe el acceso |

#### CU-30 · Consultar estado de suscripción y consumo *(mod. v4)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Ve plan, modalidad, fechas. 2. **Créditos de IA: incluidos, consumidos, disponibles y fecha de reinicio.** 3. Historial de pagos y comprobantes |

#### CU-31 · Gestionar planes y suscripciones (Administrador) *(mod. v4)*

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Crea o edita planes: nombre, rol, precio mensual y anual, **créditos de IA mensuales**, activo — sin despliegue. 2. Activa suscripciones manualmente registrando el pago. 3. **Otorga paquetes de créditos adicionales.** 4. Suspende por falta de pago. 5. Tablero: activas, trial, en gracia, vencidas, suspendidas, y **consumo de IA del periodo** |

#### CU-32 · Restringir acceso por suscripción (Sistema)

| Campo | Contenido |
|---|---|
| **Flujo principal** | 1. Verificación en cada acción restringida, **en servidor y en RLS**. 2. Empresa sin suscripción: no postula, no ve sugerencias, no solicita consultor, no genera documentos (catálogo sí navegable). 3. Consultor sin suscripción: no aparece en directorio ni acepta nuevos encargos. 4. Job diario: `activa → en_gracia → vencida`. **5. Al pasar a `vencida`, los encargos `en_curso` del consultor se cancelan (RN-29) y con ellos se revocan en cascada sus autorizaciones de documento (RF-76) — mismo efecto que CU-27, con el job como disparador en vez del administrador** *(ampliado en v6)* |

#### CU-35 · Gestionar cupo de créditos de IA (Sistema) *(nuevo v4)*

| Campo | Contenido |
|---|---|
| **Actor** | Sistema / Reloj |
| **Descripción** | Contabilidad de créditos que hace viable el modelo de negocio y controla el costo de la API |
| **Flujo principal** | 1. Antes de cada generación verifica cupo disponible (créditos del plan no consumidos + créditos adicionales). 2. Descuenta **un crédito por generación exitosa**. 3. Registra el consumo con tokens y costo estimado para auditoría. 4. Job mensual: reinicia el cupo del periodo según la fecha de la suscripción |
| **Flujos alternos** | 1a. Sin cupo → bloquea con mensaje de mejora de plan o compra de paquete adicional. 2a. **Generación fallida (error o timeout) → no descuenta crédito** |
| **Postcondiciones** | Cupo actualizado y consumo auditado |

### Módulo I — Generación documental con IA *(nuevo v4)*

#### CU-33 · Generar documento base con IA *(mod. v6)*

| Campo | Contenido |
|---|---|
| **Actor** | Usuario Empresa, con apoyo del Servicio de IA. **El consultor no genera documentos**: no tiene proyectos propios (los proyectos son de la empresa, CU-09) y su plan no incluye cupo de créditos (RN-28). Su intervención sobre un documento se limita a CU-34, previa autorización explícita *(precisado en v6 — hasta v5 la línea de actor lo incluía sin darle flujo ni precondición viable)* |
| **Descripción** | Producir el borrador del documento de postulación adaptando un proyecto de la empresa a la convocatoria elegida |
| **Precondiciones** | Convocatoria publicada y vigente —**verificado en el servidor al generar, no solo al pintar el botón (RF-78)**— · al menos un proyecto propio registrado · suscripción activa o trial · **cupo de créditos disponible** (CU-35) |
| **Flujo principal** | 1. Desde la ficha de la convocatoria pulsa **"Generar documento con IA"**. 2. El sistema muestra la lista de sus proyectos con su indicador de completitud y el **cupo de créditos restante**. 3. Selecciona el proyecto con el que quiere aplicar. 4. El sistema arma el contexto: datos de contenido del proyecto + datos estructurados de la convocatoria + requisitos definidos por el admin (CU-04) + texto del TDR adjunto (CU-03). 5. Confirma la generación (se le advierte que consumirá un crédito). 6. El servicio de IA redacta el documento con la estructura derivada de los requisitos de la convocatoria; los datos sin fuente se marcan como pendientes. 7. Se descuenta el crédito, se guarda el documento y se muestra la vista previa (CU-34) |
| **Flujos alternos** | 1a. **Entrada simétrica:** desde la ficha del proyecto → "Generar documento para..." → selecciona convocatoria. 2a. Proyecto con baja completitud → advertencia de que el resultado será pobre y ofrecimiento de completarlo antes. 2b. Sin proyectos → invitación a crear uno. 3a. Sin cupo → bloqueo con opciones de mejora de plan o paquete adicional. 6a. **Falla la generación** (timeout o error del servicio) → mensaje claro, **sin descontar crédito**, con opción de reintentar. 7a. Si ya existe una postulación de ese proyecto a esa convocatoria, el documento queda vinculado a ella |
| **Postcondiciones** | Documento base guardado, asociado al par proyecto-convocatoria, con su lista de pendientes y su consumo registrado |

#### CU-34 · Revisar, ajustar y exportar el documento generado *(mod. v5; ampliado en v6)*

| Campo | Contenido |
|---|---|
| **Actor** | Usuario Empresa (dueña) / **Consultor autorizado, con permisos restringidos** |
| **Precondiciones** | Documento generado (CU-33). Para el consultor: encargo `en_curso` **y** autorización explícita de la empresa para ese documento (RN-22, RF-71). **Ambas condiciones se reevalúan en cada petición: el permiso guardado por sí solo no da acceso (RN-27)** |
| **Flujo principal** | 1. Ve el documento en pantalla por secciones, con los **pendientes resaltados** y su conteo. 2. Edita libremente el texto (sin costo). 3. Puede pedir **ajustes a la IA** en lenguaje natural ("más breve", "enfatiza el componente ambiental"): hasta 3 ajustes por documento sin consumir crédito. 4. Guarda los cambios. 5. **(Solo la empresa) Descarga el documento en Word** para completarlo y radicarlo en el portal de la entidad |
| **Flujos alternos** | 3a. Cuarto ajuste en adelante → cuenta como nueva generación (consume crédito **del cupo de la empresa**, sin importar si quien lo pidió fue la empresa o el consultor autorizado — RN-28). **3b. Si la empresa dueña no tiene cupo, el ajuste se rechaza sin consumir nada y sin tocar el documento; al consultor se le indica que debe avisarle (RF-77) — nunca se recurre al cupo de quien pidió el ajuste.** 5a. Regenerar desde cero → consume un crédito y crea una nueva versión, conservando la anterior (**solo la empresa** puede regenerar). 5b. Acceder después al documento desde el proyecto, la convocatoria o la postulación asociada. **5c. El consultor autorizado ve los pasos 1-4, pero no tiene el botón de descarga/exportar ni de regenerar. Pierde el acceso de inmediato tanto si la empresa revoca la autorización como si el encargo deja de estar `en_curso` — al completarse, cancelarse o rechazarse, al suspenderse su perfil o al vencer su suscripción: la revocación es automática y en cascada, no requiere que la empresa haga nada (RN-27, RF-76)** |
| **Postcondiciones** | Documento editado y exportado; el usuario es responsable de verificar y completar antes de radicar (RN-19, RN-22). Cada edición registra si la hizo la empresa o el consultor, **y cada acceso de lectura del consultor queda registrado, de modo que tras revocar la autorización pueda reconstruirse qué consultó mientras estuvo activa (RF-79, RNF-11)** |

#### CU-37 · Gestionar la plantilla de generación (Administrador) *(nuevo v4)*

| Campo | Contenido |
|---|---|
| **Actor** | Administrador |
| **Descripción** | Administrar la instrucción con la que la IA redacta el documento: es el activo de conocimiento del producto, no código |
| **Flujo principal** | 1. Consulta la plantilla activa con su versión. 2. La edita o crea una nueva versión (la anterior se conserva). 3. Marca cuál queda activa. 4. Cada documento generado registra con qué versión de plantilla se produjo, para poder comparar calidad entre versiones |
| **Flujos alternos** | 2a. Probar una versión en borrador antes de activarla |
| **Postcondiciones** | Plantilla vigente aplicada a las próximas generaciones, sin necesidad de desplegar |

### Módulo J — Seguridad y auditoría (Administrador) *(nuevo v5)*

#### CU-38 · Activar autenticación multifactor (MFA)

| Campo | Contenido |
|---|---|
| **Actor** | Administrador de Contenido |
| **Descripción** | Configura un segundo factor (TOTP) para su propia cuenta; requisito obligatorio para operar con rol administrador |
| **Precondiciones** | Cuenta con rol administrador ya creada |
| **Flujo principal** | 1. Al iniciar sesión sin MFA activo, el sistema bloquea el acceso a las funciones administrativas y ofrece "Activar verificación en dos pasos". 2. Escanea el código QR con una app autenticadora. 3. Confirma con un código de 6 dígitos. 4. El sistema marca `mfa_habilitado = true` en su perfil y permite continuar |
| **Flujos alternos** | 3a. Código incorrecto → reintenta. 4a. Pérdida del segundo factor → recuperación asistida por soporte, fuera de la interfaz |
| **Postcondiciones** | La cuenta no puede volver a operar funciones administrativas sin el segundo factor verificado en cada inicio de sesión (RNF-28) |

#### CU-39 · Consultar eventos de seguridad

| Campo | Contenido |
|---|---|
| **Actor** | Administrador de Contenido |
| **Descripción** | Revisa el registro de eventos de seguridad: logins fallidos, accesos denegados a rutas administrativas, bloqueos por límite de tasa |
| **Precondiciones** | MFA activo (CU-38) |
| **Flujo principal** | 1. Abre el panel de seguridad. 2. Filtra por tipo de evento, usuario o rango de fecha. 3. Ve el detalle de cada evento: tipo, ruta, IP, usuario si aplica, fecha |
| **Postcondiciones** | Ninguna (consulta) |
| **Nota** | Alimentado por `eventos_seguridad` (RNF-11, RNF-25..27) |

#### CU-40 · Gestionar bloqueos por límite de tasa

| Campo | Contenido |
|---|---|
| **Actor** | Administrador de Contenido |
| **Descripción** | Revisa las cuentas o IPs bloqueadas temporalmente por exceder el límite de tasa (RNF-27) y puede liberarlas antes de que expiren, si determina que fue un falso positivo |
| **Precondiciones** | MFA activo (CU-38); existe al menos un bloqueo activo (`eventos_seguridad.bloqueado_hasta` en el futuro) |
| **Flujo principal** | 1. Ve la lista de bloqueos activos con motivo, usuario/IP y expiración. 2. Selecciona uno. 3. "Liberar ahora" (pone `bloqueado_hasta` en el pasado) o lo deja expirar solo |
| **Postcondiciones** | Bloqueo liberado y registrado en el evento correspondiente |

### Relaciones y dependencias

- CU-03 **incluido en** CU-02 · CU-05 **exige** CU-02+03+04 · CU-11 **incluye** el checklist desde CU-04.
- CU-33 usa la plantilla activa definida en CU-37.
- CU-33 **depende de** CU-09 (contenido del proyecto), CU-03 y CU-04 (contexto de la convocatoria) y CU-35 (cupo). CU-34 **extiende** CU-33.
- CU-19 **nace dentro de** CU-09; CU-22 y CU-23 son **caminos alternos**; CU-24 solo sobre encargos completados.
- CU-25 es **precondición** de CU-20. CU-32 y CU-35 son **precondiciones transversales** de CU-10, CU-11, CU-18, CU-19, CU-20 y CU-33.
- **CU-38 (MFA activo) es precondición transversal de todo caso de uso del Administrador** (CU-01..05, CU-25..27, CU-31, CU-37, CU-39, CU-40): sin segundo factor verificado no hay acceso a funciones administrativas (RNF-28).
- **CU-19 adjunta contexto (RF-68/69) que CU-22, CU-23, CU-26 y CU-18 heredan** — ninguno de esos cuatro vuelve a pedir esa información. El correo de contacto (RF-70) se revela en el mismo punto en los tres caminos de aceptación: CU-22 (directorio), CU-26 (asignación interna) — nunca antes de `en_curso` (RN-26).
- **CU-20/CU-21 son también un punto de entrada del flujo de solicitud, no solo un destino de CU-19** *(RF-74, nuevo v5)*: desde el directorio o la ficha del consultor la empresa elige proyecto o postulación en el propio perfil y confirma — el resultado es el mismo encargo `pendiente` vía `directorio` que produce CU-22 al llegar desde CU-19 → CU-20.
- **CU-34 (compartir con el consultor) es independiente de CU-22/CU-23/CU-26**: el encargo `en_curso` es precondición necesaria pero no suficiente — sin la autorización explícita de RF-71, el consultor no ve el documento aunque el encargo esté activo (RN-22, RN-27).
- **CU-33/CU-34 tienen ahora tres puntos de entrada simétricos** (RF-53, *v5*): la ficha de la convocatoria (CU-08), la ficha del proyecto (CU-09) y el detalle de la postulación (CU-13) — los tres resuelven al mismo documento del par proyecto-convocatoria, no crean copias distintas.

### Ciclos de vida

| Objeto | Estados |
|---|---|
| Convocatoria | `borrador → publicada → cerrada / despublicada` |
| Postulación | `en_preparacion → presentada → en_evaluacion → aprobada / rechazada → cerrada` |
| Perfil de consultor | `incompleto → en_revision → aprobado / rechazado → suspendido / reactivado` |
| Encargo | `pendiente → en_curso / rechazado → completado → calificado` · variante `esperando_asignacion` · `cancelado` |
| Suscripción | `trial → activa → en_gracia (5 días) → vencida → suspendida` |
| **Documento generado** | `generando → generado → editado → exportado` · `error` (no consume crédito) |
| **Bloqueo por límite de tasa** *(nuevo v5)* | `activo → liberado (manual)` / `expirado (automático)` |

---

