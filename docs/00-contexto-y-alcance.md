# Contexto, alcance y actores

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.

---

## 1. Objetivo y alcance del MVP

El MVP valida tres hipótesis: (1) que una empresa encuentra la convocatoria correcta para su proyecto en una fracción del tiempo actual; (2) que la IA le ahorra el trabajo más pesado de la postulación —redactar el documento base adaptado a esa convocatoria—; y (3) que quien no tiene tiempo de gestionarla contrata un consultor a través de la plataforma. Los tres lados pagan suscripción.

### 1.1 Decisiones de alcance

| Decisión | Detalle |
|---|---|
| **Mercado** | Solo Colombia: Minciencias, cámaras de comercio, cooperación internacional, fondos regionales |
| **Ingesta** | Carga **manual** por un administrador: datos estructurados digitados + documentos adjuntos (TDR, términos, anexos). Sin scraping |
| **IA acotada** | La IA **no** estructura el catálogo ni hace matching semántico. Su único uso en el MVP es **generar el documento base de postulación** a partir del proyecto del usuario y del contexto de la convocatoria (datos estructurados + requisitos + TDR adjunto) |
| **Búsqueda sin IA** | Catálogo con filtros por categorías + sugerencias por cruce de atributos, presentadas como **porcentaje de compatibilidad** con desglose por criterio |
| **La plataforma no presenta la postulación** | La radicación se hace en el portal de la entidad convocante. La plataforma acompaña la **preparación**: encontrar, evaluar compatibilidad, generar el documento base, organizar el checklist y hacer seguimiento |
| **Red de consultores** | Tercer rol: perfil con portafolio, hoja de vida y redes; ingreso aprobado por administradores; encargos por tarea desde el proyecto o directo desde el directorio/perfil (RF-74), con directorio o asignación interna; rating por encargo completado |
| **Modelo de ingresos** | Suscripción mensual o anual para empresas y consultores. Los planes de **empresa** se diferencian entre sí **por volumen de créditos de IA**; el plan de **consultor** no lleva cupo —no existe operación que pueda consumirlo (RN-28)— y se vende por presencia en el directorio y recepción de encargos *(precisado en v6)*. Trial de 7 días con 3 créditos, solo empresas *(mod. v6: antes 14)*. Piloto: activación manual; pasarela (Wompi) como primera evolución. La plataforma **no** intermedia el pago de los encargos (RN-14) |
| **Fuera del MVP** | Alertas por correo, extracción de TDR para poblar el esquema, matching semántico, scraping, pasarela en línea, comisión por encargo, marketplace de aliados, LATAM/Brasil, bóveda de documentos de la empresa (backlog — ver 14) |

### 1.2 Principio rector: veracidad del contenido generado

Heredado de la sección 6 del alcance inicial y ahora **operativo**: el documento generado por la IA **no completa datos, cifras ni antecedentes que el usuario no haya proporcionado**. Todo campo sin información de origen queda marcado en el documento como pendiente de completar, nunca inventado. El documento es una **base editable**, no una postulación lista: el usuario la revisa, la completa y la radica por su cuenta en el portal de la entidad.

---

## 2. Actores

| Actor | Descripción | Casos de uso |
|---|---|---|
| **Usuario Empresa o entidad** *(v6: entra por la puerta "Soy empresa o entidad")* | Suscriptor. Explora el catálogo, registra proyectos, genera documentos con IA, postula, hace seguimiento y contrata consultores | CU-07..14, CU-19..24, CU-28..30, CU-33..34 |
| **Consultor** | Suscriptor. Perfil aprobado por administrador; recibe y ejecuta encargos. **No genera documentos ni dispone de cupo propio de créditos de IA**: solo interviene sobre documentos que la empresa le autorice explícitamente (CU-34, RF-71), y esos ajustes los paga la empresa dueña (RN-28) *(precisado en v6)* | CU-14..18, CU-28..30, CU-34 |
| **Administrador de Contenido** | **Solo existe por invitación del Propietario (CU-41, CU-42) y con cuenta dedicada; el panel es invisible para cualquier otro usuario** *(v6)*. Fuentes y convocatorias; revisión y aprobación de consultores; asignaciones internas; planes, precios y suscripciones; **seguridad y auditoría** *(v5)* | CU-01..05, CU-25..27, CU-31, CU-37, **CU-38..40** |
| **Propietario de la plataforma** *(nuevo v6)* | Un único administrador designado fuera de la aplicación (RN-31). Además de todo lo del Administrador, es el único que invita administradores y revoca su acceso | CU-41, más los del Administrador |
| **Reloj del sistema** | pg_cron: cierre de convocatorias, vencimiento de suscripciones, reinicio mensual de créditos | CU-06, CU-32, CU-35 |
| **Servicio de IA (Claude API)** | Actor externo. Recibe el contexto de generación y devuelve el documento base | CU-33 |
| **Pasarela de pagos** | Actor externo, fase de evolución | CU-28, CU-29 |

---

## 12. Métricas de éxito del MVP

| Métrica | Meta |
|---|---|
| Convocatorias vigentes publicadas | ≥ 50 |
| Empresas piloto con al menos una postulación con checklist | ≥ 3 |
| **Documentos generados con IA durante el piloto** | ≥ 20 |
| **Documentos generados que el usuario exporta y usa** (señal de utilidad real) | ≥ 60 % de los generados |
| **Datos inventados detectados en la auditoría de veracidad** | 0 |
| **Costo promedio de IA por documento** | Dentro del margen previsto del plan |
| Consultores aprobados en el directorio | ≥ 5 |
| Encargos completados y calificados | ≥ 2 |
| Conversión de trial a suscripción paga | ≥ 30 % |
| Reducción del tiempo de preparación frente al proceso manual | ≥ 50 % |

---

