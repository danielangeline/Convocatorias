# Requerimientos no funcionales y reglas de negocio

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.

---

## 5. Requerimientos no funcionales

**34 RNF.** Críticos para el piloto: RNF-01..04, 07, 08, 11, 12, 16, 17, 20, 21, 24, 25, 26, 27, 28, 29 y **30..34** *(ampliado en las auditorías de implementación e interfaz v6)*.

### 5.1 Seguridad

| ID | Atributo | Requerimiento | Verificación |
|---|---|---|---|
| RNF-01 | Autenticación y acceso | Contraseñas con hash seguro; funciones administrativas inaccesibles para otros roles incluso vía API | Empresa/consultor a endpoints admin → 403 |
| RNF-02 | Cifrado | HTTPS/TLS en tránsito; archivos cifrados en reposo | Escaneo TLS y de buckets |
| RNF-03 | Aislamiento de datos | Cada empresa ve solo sus proyectos, postulaciones, encargos **y documentos generados**; cada consultor solo sus encargos. Perfiles aprobados visibles salvo la hoja de vida. **Ningún endpoint de listado devuelve registros de otro propietario, ni siquiera parcialmente (RN-30)** *(criterio precisado en v6)* | Prueba cruzada entre 2 empresas y 2 consultores, **ejecutada listado por listado** (`/proyectos`, `/postulaciones`, `/documentos`, `/encargos`): cada cuenta ve exclusivamente lo propio |
| RNF-25 | **Cobertura de RLS** | Row Level Security habilitado y con política explícita en las 27 tablas sin excepción; ninguna tabla nueva se despliega sin su política escrita y probada *(nuevo v5)* | Revisión de esquema: cada tabla tiene ≥1 política activa; lectura cruzada por tabla entre 2 cuentas → denegada |
| RNF-26 | **Gobierno de credenciales elevadas** | La `service_role key` de Supabase solo se referencia en código de servidor (API routes, jobs de `pg_cron`); nunca en el bundle del cliente ni en variables `NEXT_PUBLIC_*` *(nuevo v5)* | Búsqueda de la key en el bundle compilado del cliente → 0 resultados |
| RNF-27 | **Límite de tasa** | Los endpoints de la capa de aplicación —en especial la generación con IA— aplican límite de tasa por usuario e IP, independiente del cupo de créditos. **Si el almacén que lo sostiene no responde, rige RNF-33: se rechaza, no se permite** *(ampliado en v6)* | Ráfaga de requests por encima del límite → 429 antes de agotar el cupo real |
| RNF-28 | **Autenticación reforzada de administradores** | Toda cuenta con rol administrador exige verificación en dos pasos (MFA/TOTP) para iniciar sesión; no se completa el login admin sin un segundo factor activo *(nuevo v5)* | Login admin sin MFA configurado → flujo obligatorio de activación antes de continuar |
| RNF-29 | **Validación del enlace oficial de postulación** | El enlace debe ser una URL `http`/`https` bien formada, verificada en el servidor antes de guardar (no solo en el cliente); se rechaza cualquier otro esquema *(nuevo v5)* | Guardar `javascript:`, una cadena inválida o un dominio malformado → rechazado con mensaje claro |
| RNF-30 | **Autorización por rol en rutas y endpoints** | Cada ruta de portal y cada endpoint declara explícitamente los roles admitidos. El acceso con un rol distinto se rechaza con 403 —**con 404 en el panel administrativo, RNF-35** *(mod. v6)*— y se registra como `acceso_denegado` en `eventos_seguridad`. **Ningún control de rol vive solo en la interfaz**: ocultar un enlace o deshabilitar un botón no constituye autorización. Generaliza RNF-01, que hasta ahora solo cubría las funciones administrativas *(nuevo v6)* | Matriz rol × ruta ejecutada completa. En particular: consultor → `/convocatorias/[id]/generar` y `/documentos` → 403; empresa → cualquier ruta `/admin` → 403; y el evento correspondiente presente en la bitácora |
| RNF-31 | **Defensa ante instrucciones incrustadas en documentos de terceros** | El texto extraído del TDR y demás adjuntos se sanea antes de entrar al prompt (RN-23): se neutralizan las instrucciones dirigidas al modelo y se aplica el tope de tamaño de contexto. La técnica empleada queda documentada, no implícita *(nuevo v6)* | Corpus de al menos 10 TDR con instrucciones incrustadas conocidas (ignorar reglas previas, revelar el prompt, alterar la estructura) → ninguna ejecutada por el modelo; el documento generado conserva la estructura derivada de los requisitos |
| RNF-32 | **Retención y eliminación de contenido** | Se declara el plazo de conservación de los documentos generados, los registros de consumo de IA y el contenido enviado al proveedor externo, más el procedimiento de eliminación a petición del titular. Complementa RNF-16 (que cubre el perfil del consultor) y RNF-24 (que informa del tratamiento pero no del plazo), conforme a la Ley 1581 de 2012 *(nuevo v6)* | Política de retención publicada en los términos; solicitud de eliminación ejecutada extremo a extremo sobre una cuenta de prueba, incluidos documentos generados y bitácora de consumos |
| RNF-33 | **Degradación segura de los controles** | Cuando un control de seguridad depende de un servicio externo y este no responde, la operación protegida se **rechaza** (fail-closed), nunca se permite por omisión. Aplica en particular al almacén del límite de tasa de RNF-27, que vive fuera de Postgres *(nuevo v6)* | Simulacro con el almacén de límite de tasa caído → la generación con IA responde 503/429, no 200; el incidente queda registrado |
| RNF-34 | **Lenguaje de cara al usuario** | La interfaz **no muestra identificadores internos de la especificación** (`CU-xx`, `RF-xx`, `RNF-xx`, `RN-xx`) ni nomenclatura técnica del esquema: las reglas se explican con palabras que el usuario reconoce. Los identificadores son trazabilidad del equipo y viven en la documentación y en los comentarios del código, nunca en el texto renderizado *(nuevo v6)* | Búsqueda de los patrones `CU-`, `RF-`, `RNF-` y `RN-` sobre el texto visible de las tres portales → 0 resultados |
| RNF-35 | **Panel administrativo oculto** | Para quien no es administrador, `/admin/*`, `/mfa` y `/api/admin/*` son indistinguibles de una ruta que no existe, y ningún recurso servido a visitantes, empresas o consultores revela la ruta del panel. Las páginas del panel no se indexan *(nuevo v6)* | Para cada ruta y endpoint administrativo, comparar la respuesta a anónimo, empresa y consultor con la de una ruta inventada: mismo código 404 y misma página. Buscar `/admin` en el HTML y el JavaScript servidos a esas sesiones: 0 coincidencias. El panel no figura en el `sitemap` ni en `robots.txt` |

### 5.2 Rendimiento

| ID | Atributo | Requerimiento | Verificación |
|---|---|---|---|
| RNF-04 | Catálogo | Búsqueda y filtros < 2 s con hasta 1.000 convocatorias | Prueba de carga |
| RNF-05 | Sugerencias | Cruce de atributos y cálculo de compatibilidad < 3 s | SQL indexado; prueba de carga |
| RNF-06 | Documentos | Descarga de 20 MB inicia < 3 s; carga admin hasta 50 MB | Archivos límite |
| RNF-21 | **Generación con IA** | La generación puede tardar hasta 120 s; queda excluida de los umbrales anteriores. Debe mostrar progreso y no bloquear la navegación; si excede el tope, falla de forma controlada sin consumir crédito *(nuevo v4)* | Medición sobre 20 generaciones con TDR reales |

### 5.3 Usabilidad

| ID | Atributo | Requerimiento | Verificación |
|---|---|---|---|
| RNF-07 | Idioma y simplicidad | Interfaz en español; flujos completables sin capacitación. **El texto respeta la gramática del español en todos los estados: concordancia de número en contadores y plazos ("cierra en 1 día" / "en 3 días"), género y puntuación** *(ampliado en v6)* | Prueba con 3 usuarios piloto; **revisión de los textos con valor 0, 1 y n en cada contador, plazo y listado** |
| RNF-08 | Responsivo | Usable en escritorio y móvil; panel admin puede ser solo escritorio. **Ninguna barra de navegación —incluida la pública, previa al ingreso— desborda el ancho de la pantalla; cuando una barra se desplaza en horizontal, lo indica visualmente para que no se pierdan sus últimas opciones** *(ampliado en v6)* | Revisión en 3 tamaños, **incluida la landing sin sesión a 375 px: ningún elemento sobresale del viewport ni obliga a desplazamiento horizontal de la página** |

### 5.4 Disponibilidad y respaldo

| ID | Atributo | Requerimiento | Verificación |
|---|---|---|---|
| RNF-09 | Disponibilidad | 99 % en horario hábil colombiano durante el piloto | Monitoreo de uptime |
| RNF-10 | Respaldos | Copia diaria de BD y archivos; restauración probada | Simulacro de restauración |

### 5.5 Integridad y trazabilidad

| ID | Atributo | Requerimiento | Verificación |
|---|---|---|---|
| RNF-11 | Trazabilidad | Auditoría de creación y publicación de convocatorias, aprobación de consultores, historial de postulaciones y encargos, **consumos de IA** y **accesos de lectura de un consultor a un documento autorizado (RF-79)** *(ampliado en v6)* | Revisión de campos de auditoría; tras revocar una autorización debe poder reconstruirse qué consultó el consultor mientras estuvo activa |
| RNF-12 | Consistencia | Integridad referencial sin registros huérfanos | Restricciones del esquema |
| RNF-17 | Integridad del rating | Una calificación por encargo, inmutable, promedio no editable | Segunda calificación → rechazada |

### 5.6 Escalabilidad y mantenibilidad

| ID | Atributo | Requerimiento | Requerimiento |
|---|---|---|---|
| RNF-13 | Evolución | El esquema soporta scraping y matching semántico futuros sin migración; suscripciones preparadas para pasarela | Revisión de diseño |
| RNF-14 | Catálogos administrables | Categorías, planes y cupos de créditos son datos, no código | Cambio desde el panel admin sin despliegue |
| RNF-15 | Portabilidad | Lógica portable; PostgreSQL estándar exportable; Next.js desplegable en otros entornos | Export de BD + despliegue alterno |
| RNF-22 | **Independencia del proveedor de IA** | La construcción del contexto y el parseo del resultado se aíslan tras una interfaz propia, de modo que cambiar de proveedor o de modelo no exija reescribir el módulo *(nuevo v4)* | Revisión de diseño del servicio de generación |

### 5.7 Datos personales y contenido generado

| ID | Atributo | Requerimiento | Verificación |
|---|---|---|---|
| RNF-16 | Protección de datos personales | Datos del consultor bajo consentimiento explícito (Ley 1581 de 2012). Hoja de vida solo por URLs firmadas con expiración **máxima de 15 minutos** *(precisado en v5)*. Derecho a eliminación del perfil. **La visibilidad de hoja de vida, sitio web y redes es por pareja empresa-consultor, nunca global (RN-12, RF-80)** *(precisado en v6)* | Acceso directo a la URL del CV sin autorización → denegado; URL reutilizada pasados 15 min → denegada. **Prueba cruzada: dos empresas sobre el mismo consultor, una con solicitud activa y otra sin ella → solo la primera ve contacto, CV y redes** |
| RNF-18 | Archivos de perfil | Foto ≤5 MB (JPG/PNG); hoja de vida ≤10 MB (PDF); validación en cliente y servidor | Archivos límite y tipos inválidos |
| RNF-19 | Rendimiento del directorio | Listado con filtros < 2 s con hasta 500 consultores | Prueba de carga |
| RNF-20 | Enforcement en servidor | Suscripción y cupo verificados en la capa de aplicación y en RLS, nunca solo en UI; cambios de estado auditados | API directa sin cupo → 403; bitácora |
| RNF-23 | **Veracidad del contenido generado** | El documento no incluye datos, cifras ni antecedentes que no provengan del proyecto del usuario o de la convocatoria; los vacíos se marcan como pendientes y nunca se completan por inferencia. La interfaz declara que el documento es una base sujeta a revisión humana *(nuevo v4)* | Revisión experta de 10 documentos generados con proyectos deliberadamente incompletos: cero datos inventados |
| RNF-24 | **Transparencia y control del uso de IA** | Los términos informan que el contenido del proyecto y de la convocatoria se procesa con un proveedor externo de IA. Cada generación registra tokens y costo estimado; existe un tope de tamaño de contexto por generación *(nuevo v4)* | Revisión de términos y de la bitácora de consumos |

---

## 6. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Una convocatoria es visible solo cuando el admin completa datos mínimos —**incluido el enlace oficial de postulación**—, adjunta ≥1 documento, define requisitos y publica *(ampliado en v5)* |
| RN-02 | Convocatoria vencida pasa automáticamente a "cerrada". Queda **excluida de las sugerencias y de la generación con IA sin excepción**, y **fuera del listado del catálogo por defecto**; solo reaparece en el catálogo si el usuario activa el filtro explícito de convocatorias cerradas, donde se muestra marcada como tal y con sus acciones deshabilitadas (RF-11, RN-03) *(precisado en v6)* |
| RN-03 | No se puede postular ni generar documentos sobre convocatorias cerradas o despublicadas |
| RN-04 | El checklist se genera copiando los requisitos vigentes al postular; ediciones posteriores no alteran postulaciones en curso |
| RN-05 | El porcentaje de compatibilidad es un cálculo determinístico de coincidencias, no una predicción de éxito ni un resultado de IA, y así se comunica; la decisión de postular es del usuario |
| RN-06 | El rol administrador **solo lo otorga el Propietario de la plataforma, por invitación** (CU-41). Todo registro de autoservicio nace como empresa o consultor, y ningún dato enviado por el usuario al registrarse puede producir un administrador *(mod. v6)* |
| RN-07 | Fuentes y convocatorias no se eliminan físicamente: se desactivan o despublican |
| RN-08 | Un consultor aparece en el directorio solo si: perfil aprobado + no suspendido + suscripción activa |
| RN-09 | Una calificación por encargo completado, emitida solo por la empresa de ese encargo, inmutable |
| RN-10 | Consultor con suscripción vencida termina sus encargos en curso pero no recibe nuevos |
| RN-11 | Trial de **7 días** *(mod. v6)* con 3 créditos, único por cuenta de empresa; el consultor paga desde su aprobación; los administradores no pagan |
| RN-12 | La hoja de vida, **el sitio web y las redes sociales** solo son visibles para administradores y para **la empresa que tiene la solicitud activa con ese consultor** — la visibilidad es por pareja empresa-consultor, nunca global: que otra empresa tenga una solicitud abierta no habilita a las demás. Sin solicitud propia, la empresa solo ve descripción, especialidades, portafolio (sin links de contacto) y rating *(ampliado en v5; precisado en v6)* |
| RN-13 | Todo rechazo de perfil lleva motivo obligatorio; reenvíos sin límite |
| RN-14 | El pago del servicio de consultoría se acuerda entre empresa y consultor fuera de la plataforma; los ingresos vienen de las suscripciones |
| RN-15 | La suspensión de un consultor no borra su historial |
| RN-16 | Suscripción vencida: 5 días de gracia con avisos antes de restringir |
| RN-17 | **Un crédito por generación exitosa.** Las ediciones manuales no cuestan; los ajustes pedidos a la IA son gratuitos hasta 3 por documento; del cuarto en adelante consumen crédito. Una generación fallida nunca consume crédito |
| RN-18 | **Los créditos se reinician cada mes** según la fecha de la suscripción, también en planes anuales, y **no se acumulan** de un periodo al siguiente. Los créditos de paquetes adicionales sí permanecen hasta agotarse |
| RN-19 | **La plataforma no radica postulaciones.** La presentación se hace en el portal de la entidad convocante; el documento generado es un insumo de preparación y así se comunica |
| RN-20 | **El documento generado es responsabilidad final del usuario**, quien debe verificarlo y completar los pendientes antes de usarlo |
| RN-21 | Un proyecto incompleto puede usarse para generar, pero el sistema advierte previamente que el resultado será limitado |
| RN-22 | Los documentos generados pertenecen a la empresa que los generó y solo son visibles para ella. **El consultor con encargo `en_curso` sobre ese proyecto puede leer, editar el contenido y solicitar ajustes con IA únicamente si la empresa lo autoriza explícitamente para ese documento — la aceptación del encargo, por sí sola, nunca da acceso. El consultor autorizado nunca puede exportar/descargar el documento; esa acción es exclusiva de la empresa dueña** *(precisado en v5)* |
| RN-23 | El contenido extraído de documentos adjuntos (TDR) que alimenta la generación con IA se sanitiza antes de incluirse en el prompt, removiendo instrucciones incrustadas dirigidas al modelo *(nuevo v5)* |
| RN-24 | Ninguna tabla del esquema se despliega sin RLS habilitado y su política definida: es un requisito de diseño desde el Sprint 0, no una revisión posterior *(nuevo v5)* |
| RN-25 | Un consultor con un encargo `pendiente`, `en_curso` o `esperando_asignación` sobre un proyecto puede ver el contenido de **ese** proyecto (y la convocatoria asociada, si el tipo de ayuda es "convocatoria específica") — limitado a ese encargo, no al resto de proyectos de la empresa *(nuevo v5)* |
| RN-26 | El correo de contacto entre empresa y consultor solo se revela cuando el encargo pasa a `en_curso` (por aceptación en directorio o por asignación interna del administrador); nunca mientras está `pendiente` o `esperando_asignación`, ni tras un rechazo o cancelación *(nuevo v5)* |
| RN-27 | La autorización de un documento generado a un consultor solo puede otorgarse mientras el encargo esté `en_curso`; la empresa puede revocarla en cualquier momento, lo que oculta el documento al consultor sin eliminarlo ni afectar el encargo. **La autorización es derivada, no almacenada: el acceso se evalúa en cada petición como (autorización explícita ∧ encargo `en_curso`), de modo que al perderse cualquiera de las dos condiciones el acceso cesa por sí solo, sin intervención manual de la empresa.** Un permiso guardado nunca basta por sí mismo *(nuevo v5; precisado en v6)* |
| RN-28 | **El consultor no tiene cupo propio de créditos de IA**: su plan no incluye ninguno, porque no existe operación que pueda consumirlo (generar exige proyecto propio, que el consultor no tiene). Por eso, cuando el ajuste con IA sobre un documento lo solicita un consultor autorizado, el consumo —si aplica, a partir del cuarto ajuste (RN-17)— se descuenta **siempre** del cupo de la **empresa** dueña del documento. **Queda prohibido cualquier caso de respaldo que cargue el consumo a quien dispara la acción:** si no hay encargo `en_curso` tampoco hay acceso al documento (RN-27), luego no existe situación en la que haga falta un cupo alternativo *(nuevo v5; ampliado en v6)* |
| RN-29 | Suspender un consultor (CU-27) cancela de inmediato sus encargos `en_curso` — pasan a `cancelado` con un motivo registrado — sin alterar el historial ni las calificaciones ya emitidas; reactivar el perfil no los revive. El vencimiento de la suscripción del consultor (RN-10, CU-18) produce el mismo efecto sobre el dato, con un disparador distinto (el job diario, CU-32, en vez de una acción del administrador). **Ambos disparadores arrastran también la revocación de las autorizaciones de documento (RF-76)** *(nuevo v5; ampliado en v6)* |
| RN-30 | **Toda entidad de datos de usuario —proyecto, postulación, documento generado, encargo— declara su propietario como columna del esquema, y ningún endpoint de listado se sirve sin filtrar por el propietario de la sesión.** El filtrado en la capa de aplicación no sustituye a la política RLS ni al revés: se exigen los dos. Es requisito de diseño desde el Sprint 0, igual que RN-24, no una revisión posterior *(nuevo v6)* |
| RN-31 | Existe **un único Propietario de la plataforma**. Se designa y se cambia **solo fuera de la aplicación** —consola de la base de datos con credenciales de servicio—, nunca desde una pantalla ni un endpoint. Es administrador con MFA, no puede revocarse a sí mismo y es la única cuenta que otorga o retira el rol administrador *(nuevo v6)* |
| RN-32 | **Cuenta de administrador dedicada:** un correo que ya tiene cuenta de empresa o de consultor no puede recibir una invitación de administrador, y una cuenta de administrador no tiene portal de empresa ni de consultor, ni suscripción. Un rol por cuenta *(nuevo v6)* |

---

