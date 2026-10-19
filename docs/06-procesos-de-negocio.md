# Procesos core y no core

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.

---

## 7. Procesos core y no core del negocio

### 7.1 Procesos CORE

| # | Proceso | Descripción | Tipo | Trazabilidad |
|---|---|---|---|---|
| 1 | Curaduría y carga de convocatorias | Fuentes, datos completos y documentos. Un catálogo desactualizado mata el producto | Core operativo | CU-01..03 |
| 2 | Categorización | Taxonomía consistente; de ella dependen filtros, compatibilidad y especialidades | Core operativo | CU-02 |
| 3 | Definición de requisitos | El know-how de "saber postular", que además **estructura el documento generado** | Core operativo | CU-04, CU-33 |
| 4 | Búsqueda y compatibilidad | Catálogo con filtros y porcentaje de compatibilidad | Core de producto | CU-07..10 |
| 5 | Acompañamiento de la postulación | Checklist y estados | Core de producto | CU-11..13 |
| 6 | Ciclo de vida de la convocatoria | Publicación validada, vigencia, cierre | Core de producto | CU-05, 06 |
| 7 | Curaduría de la red de consultores | Aprobación con revisión humana, suspensión | Core operativo | CU-25, 27 |
| 8 | Intermediación de encargos | Solicitud → aceptación/asignación → ejecución → calificación | Core de producto | CU-18..24, 26 |
| 9 | Reputación | Rating por encargo; activo acumulativo no copiable | Core de producto | CU-24 |
| 10 | **Generación documental asistida** | Construcción del contexto, redacción con veracidad garantizada y control de calidad del resultado. **Es la funcionalidad de mayor valor percibido y la que sostiene la diferenciación por precio** | Core de producto | CU-33, 34 |
| 11 | Gestión de planes, créditos y acceso | Estrategia de precios y cupos + enforcement | Core de producto/negocio | CU-31, 32, 35 |

### 7.2 Procesos NO CORE

| # | Proceso | Cómo se resuelve |
|---|---|---|
| 12 | Autenticación y cuentas | Supabase Auth |
| 13 | Almacenamiento de archivos | Supabase Storage (3 buckets) |
| 14 | Infraestructura y despliegue | Vercel + Supabase |
| 15 | Respaldos | Supabase Pro |
| 16 | **Provisión del modelo de IA** | API de OpenAI *(sesión 026; antes Claude API)* — se consume como servicio; la lógica propia está en la construcción del contexto y las reglas de veracidad, no en el modelo |
| 17 | Cobro de suscripciones | Manual en piloto → pasarela Wompi/PayU |
| 18 | Soporte | Correo / WhatsApp en el piloto |
| 19 | Mercadeo y adquisición | Redes, gremios, cámaras de comercio |

---

