# Modelo de negocio, precios y análisis competitivo

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.

---

## 10. Modelo de negocio: planes, precios y créditos

### 10.1 Benchmark de referencia (verificado en el análisis competitivo)

| Plataforma | Precio | Qué incluye |
|---|---|---|
| OpenGrants (EE.UU.) | USD $9/mes · $99/año | Solo búsqueda de convocatorias; trial de 7 días |
| FundRobin (R.U.) | £39–£159/mes (~USD $50–200) | Flujo completo; **diferenciado por número de borradores con IA y usuarios** |
| Capital Hub Latam (Col.) | No publica precios | IA de proyectos, análisis de convocatorias con puntaje, academia |
| Innpactia (Col.) | Freemium | Conexión con fondos e inversionistas |

**Lecturas:** el mercado ya cobra por volumen de borradores con IA, exactamente el eje que adoptamos; y hay espacio entre el buscador barato y la suite cara.

### 10.2 Propuesta de planes *(a validar con los pilotos)*

| Plan | Rol | Mensual | Anual | Créditos IA/mes | Incluye |
|---|---|---|---|---|---|
| **Gratis** *(nuevo, sesión 042)* | Empresa | $0, sin vencimiento | — | **0** | Catálogo, filtros, ficha y guardadas; proyectos con el formulario manual |
| **Empresa Esencial** | Empresa | COP $89.000 | COP $890.000 (2 meses gratis) | **350** | Lo de Gratis + proyecto con IA y editar apartado con IA, sugerencias por compatibilidad, documento base con IA y ajustes, postulaciones |
| **Empresa Pro** | Empresa | COP $189.000 | COP $1.890.000 | **800** | Lo de Esencial + directorio de consultores, encargos, calificaciones y compartir documentos con consultor; soporte prioritario y más usuarios |

> **Funciones por plan** *(sesión 042, decisión del Product Owner; RN-41)*. **El Trial de 7 días desaparece**: todo registro de empresa entra al plan **Gratis**, sin vencimiento, y las empresas que tenían Trial pasan a Gratis. Qué abre cada plan:
>
> | Funcionalidad | Gratis | Esencial | Pro |
> |---|---|---|---|
> | Ver catálogo, filtros, ficha, guardar convocatorias | ✅ | ✅ | ✅ |
> | Crear y editar proyectos con el formulario manual | ✅ | ✅ | ✅ |
> | Crear proyecto con IA (texto o audio) y editar apartado con IA | 🔒 | ✅ | ✅ |
> | Sugerencias por compatibilidad | 🔒 | ✅ | ✅ |
> | Generar documento base con IA y ajustes | 🔒 | ✅ | ✅ |
> | Postulaciones (checklist, avance, seguimiento) | 🔒 | ✅ | ✅ |
> | Directorio de consultores, encargos, calificar, compartir documentos con consultor | 🔒 | 🔒 | ✅ |
> | Soporte prioritario y más usuarios | — | — | ✅ |
>
> 🔒 es **bloqueado pero visible**: la opción sigue en el menú y la pantalla explica qué hace y en qué plan está («Disponible en el plan Esencial» o «Pro» → «Mejorar plan»). Las funciones son **datos del plan** (`planes.incluye_*`, docs/05 §9.28) que el administrador cambia desde el panel (RF-36). El bloqueo vive en el servidor y en RLS (RNF-20). **Al vencer un plan de pago la empresa baja a Gratis y no se borra nada** (RN-16): sigue viendo y descargando sus documentos, postulaciones y encargos, y editando sus proyectos a mano; la IA y las demás funciones de pago quedan bloqueadas. El pago sigue por fuera durante el piloto (`CONTRATAR_EN_PILOTO`).
| **Consultor** | Consultor | COP $69.000 | COP $690.000 | — | Perfil en directorio, recepción de encargos, acceso a los documentos que la empresa le autorice (RF-71) |
| **Paquete adicional** | Empresa | COP $39.000 | — | [COMPLETAR: créditos del paquete, p. ej. +150] (no expiran) | Compra puntual |

En dólares, los planes de empresa quedan alrededor de USD $22 y $47 mensuales: por encima del buscador simple y por debajo de la suite británica, coherente con la capacidad de pago local.

> **Por qué el plan de consultor no lleva créditos** *(decidido en v6)*. Ninguna operación puede consumir un cupo propio del consultor: generar exige un proyecto propio, y los proyectos son de la empresa (CU-09, CU-33); los ajustes con IA sobre un documento autorizado los paga siempre la empresa dueña (RN-28). A ello se suma un argumento comercial: mientras el acceso del consultor a la IA dependa de que la empresa lo autorice documento a documento (RF-71), un cupo **mensual y no acumulable** (RN-18) le haría pagar cada mes por una capacidad que no controla. Lo que el plan de consultor vende es generación de demanda —estar en el directorio y recibir encargos—, no volumen de IA. Si más adelante se quiere dar IA al consultor, el instrumento correcto es atarla al encargo (una bolsa de ajustes que viaje con la autorización) o a paquetes de compra puntual que no expiren, no un cupo periódico. **El precio de COP $69.000 queda sin cambio y pendiente de validación con los pilotos**, como el resto de la tabla.

> **Créditos por tarifa** *(sesión 030, decisión del Product Owner)*. Cada uso cuesta su tarifa (RN-17): **documento 100, proyecto con IA 50, ajuste desde el cuarto 10, dictar 0**, y los planes traen **Esencial 350 y Pro 800** al mes (el plan Gratis, desde la sesión 042, no trae créditos ni IA; el Trial de 125 se retiró). **Qué alcanza cada plan**, por ejemplo: **Esencial** 1 proyecto con IA y 3 documentos (o 3 documentos y 5 ajustes de pago); **Pro** 4 proyectos con IA y 6 documentos (o 8 documentos). Los proyectos llenados a mano no cuestan y no tienen límite. Con el costo medido (USD 0,016 por documento, 0,0025 por proyecto), la IA del plan Pro gastado entero cuesta unos USD 0,15. Las tarifas y los créditos de cada plan se cambian desde el panel sin desplegar (RF-36, RF-100).

### 10.3 Sostenibilidad del costo de IA

El costo por generación depende del tamaño del TDR y del documento producido, pero está en el orden de **centavos de dólar**, no de dólares. Contra un plan de COP $89.000 con 10 créditos, el costo de IA representa una fracción menor de la suscripción, dejando margen cómodo. Aun así, el diseño incorpora tres controles: tope de tamaño de contexto por generación (RNF-24), registro de tokens y costo por consumo (RF-52), y el propio sistema de cupos. **Antes de fijar los números definitivos hay que medir el costo real sobre 20 generaciones con TDR colombianos reales**, tarea explícita del Sprint de IA.

---

## 13. Análisis competitivo y diferenciación

| Plataforma | Fortaleza | Qué tomamos | Qué no hacen |
|---|---|---|---|
| **Capital Hub Latam** (Colombia) | IA de proyectos, puntaje de convocatorias 1–100 %, academia. Modelo híbrido plataforma + consultoría | La idea del **puntaje porcentual** de compatibilidad | Directorio abierto de consultores con reputación verificable |
| **Innpactia** (Colombia) | Volumen curado (+19.000 oportunidades, 23 países) y prueba social como argumento central | **Indicadores del catálogo en la landing** | Acompañamiento de la postulación ni generación documental |
| **OpenGrants** (EE.UU.) | Buscador de +8.000 grants, búsqueda en lenguaje natural, precio de entrada bajo, **marketplace de grant writers** | **Chips de búsqueda sugerida**; validación del modelo de consultores y del trial corto | Checklist ni seguimiento de la postulación |
| **FundRobin** (R.U.) | Flujo Find→Know→Draft→Manage; "IA aterrizada" con revisión humana; **precios por volumen de borradores** | **Cobro por volumen de generaciones**; refuerzo del principio de veracidad; reutilización del contenido del proyecto | Mercado colombiano ni red de consultores |

**Diferenciación central:** ninguna de las cuatro integra en un solo producto el catálogo colombiano curado, la generación del documento base adaptado a cada convocatoria con veracidad garantizada, el checklist de preparación y un directorio de consultores aprobados con reputación. El competidor a vigilar es Capital Hub Latam por geografía y modelo.

---

