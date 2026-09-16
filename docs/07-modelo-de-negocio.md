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
| **Trial** | Empresa | Gratis 7 días *(mod. v6)* | — | 3 | Todo el producto |
| **Empresa Esencial** | Empresa | COP $89.000 | COP $890.000 (2 meses gratis) | 10 | Catálogo, sugerencias, postulaciones, encargos |
| **Empresa Pro** | Empresa | COP $189.000 | COP $1.890.000 | 30 | Lo anterior + soporte prioritario y más usuarios |
| **Consultor** | Consultor | COP $69.000 | COP $690.000 | — | Perfil en directorio, recepción de encargos, acceso a los documentos que la empresa le autorice (RF-71) |
| **Paquete adicional** | Empresa | COP $39.000 | — | +10 (no expiran) | Compra puntual |

En dólares, los planes de empresa quedan alrededor de USD $22 y $47 mensuales: por encima del buscador simple y por debajo de la suite británica, coherente con la capacidad de pago local.

> **Por qué el plan de consultor no lleva créditos** *(decidido en v6)*. Ninguna operación puede consumir un cupo propio del consultor: generar exige un proyecto propio, y los proyectos son de la empresa (CU-09, CU-33); los ajustes con IA sobre un documento autorizado los paga siempre la empresa dueña (RN-28). A ello se suma un argumento comercial: mientras el acceso del consultor a la IA dependa de que la empresa lo autorice documento a documento (RF-71), un cupo **mensual y no acumulable** (RN-18) le haría pagar cada mes por una capacidad que no controla. Lo que el plan de consultor vende es generación de demanda —estar en el directorio y recibir encargos—, no volumen de IA. Si más adelante se quiere dar IA al consultor, el instrumento correcto es atarla al encargo (una bolsa de ajustes que viaje con la autorización) o a paquetes de compra puntual que no expiren, no un cupo periódico. **El precio de COP $69.000 queda sin cambio y pendiente de validación con los pilotos**, como el resto de la tabla.

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

