# Metodología, cronograma y evolución posterior

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.

---

## 11. Metodología y cronograma

### 11.1 Scrum

Sprints de 2 semanas. Planning, Daily, Review con demostración sobre datos reales, Retrospectiva. Definición de terminado: probado, desplegado en preview de Vercel y validado por el Product Owner.

### 11.2 Roles

Product Owner (fundador/socio) · Scrum Master (líder técnico) · 2 desarrolladores full-stack · **1 ingeniero de IA a medio tiempo desde el Sprint 6** (diseño de prompts, evaluación de calidad y control de costo) · Diseñador UX medio tiempo · Administrador de contenido.

### 11.3 Cronograma v4 (18 semanas, 9 sprints)

> **El plan en ejecución es otro:** [`10-plan-de-desarrollo.md`](10-plan-de-desarrollo.md), 30 días y cinco sprints, con una persona y un agente de IA. Es viable porque el prototipo ya cubre la interfaz y las reglas de lo que aquí ocupan los sprints 1 a 7. Este cronograma se conserva como referencia de cómo se construiría con el equipo completo de §11.2.

| Sprint | Semanas | Contenido | Hito |
|---|---|---|---|
| 0 | 1–2 | Setup Vercel + Supabase, esquema completo (26 tablas), RLS, auth con 3 roles, CI/CD | H0: entorno y modelo desplegados |
| 1 | 3–4 | Panel admin de convocatorias: fuentes, carga, categorías, documentos, requisitos, publicación validada | H1: 20 convocatorias reales publicadas |
| 2 | 5–6 | Catálogo público: búsqueda, filtros, chips sugeridos, ficha de detalle, indicadores de la landing | H2: catálogo navegable con prueba social |
| 3 | 7–8 | Proyectos enriquecidos con completitud + sugerencias con % de compatibilidad | H3: los dos caminos de búsqueda operando |
| 4 | 9–10 | Postulaciones: checklist, avance, estados con historial; job de cierre | H4: ciclo de preparación completo |
| 5 | 11–12 | Suscripciones: planes con créditos, trial, activación manual, enforcement, jobs de vencimiento y reinicio | H5: acceso restringido y cupos operando |
| 6 | 13–14 | **Generación documental con IA**: construcción de contexto, prompts con reglas de veracidad, vista previa editable, ajustes, exportación a Word, medición de costo real | **H6: primer documento generado, editado y exportado, con costo por generación medido** |
| 7 | 15–16 | Módulo consultor completo: perfil, revisión y aprobación, directorio, encargos de punta a punta y calificaciones | H7: primer encargo completado y calificado |
| 8 | 17–18 | Estabilización, pruebas RNF (carga, seguridad, RLS cruzado, veracidad sobre 10 documentos, restauración), piloto y producción | H8: MVP v4 en producción con usuarios piloto |

---

## 14. Evolución posterior al MVP

| Fase | Contenido | Base ya preparada |
|---|---|---|
| E1 | **Pasarela Wompi**: cobro en línea, renovación automática y venta directa de paquetes de créditos | Campo `medio` en pagos; estados y cupos |
| E2 | Alertas por correo: convocatorias compatibles, plazos, encargos, renovaciones y cupo por agotarse | Proyectos, categorías y eventos registrados |
| E3 | **Perfil documental de la empresa**: registro de documentos recurrentes (RUT, cámara de comercio, estados financieros) con **control de vigencia**, que marca automáticamente los ítems del checklist y avisa de vencimientos. *Backlog validado en el análisis competitivo; se pospone porque no prueba las hipótesis del MVP* | Checklist y requisitos ya modelados |
| E4 | Extracción de TDR con IA para **poblar el esquema**: el admin pasa de digitar a validar | El TDR ya se procesa como contexto en E-MVP |
| E5 | Matching semántico y "consultores sugeridos para tu proyecto" | pgvector nativo + especialidades sobre el mismo catálogo |
| E6 | Puntaje predictivo de probabilidad de éxito (estilo Capital Hub), con histórico propio de postulaciones | Estados e historial de postulaciones |
| E7 | Scraping de fuentes (Radar) | Fuentes parametrizadas |
| E8 | Comisión por encargo / pagos protegidos | Historial de encargos y calificaciones |
| E9 | Informes de avance y cierre de proyectos aprobados | Esquema de convocatoria ganadora |
| E10 | Expansión LATAM hispanohablante → Brasil | Arquitectura multi-fuente |

---

