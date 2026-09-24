# Matriz de trazabilidad CU ↔ RF ↔ RNF/RN

> Parte de la especificación del MVP **v6** · Plataforma de Gestión de Convocatorias.
> Índice general en `docs/README.md`. Contexto rápido en `CLAUDE.md`.

---

## 15. Matriz de trazabilidad

| Caso de uso | RF | RNF / RN |
|---|---|---|
| CU-01 Parametrizar fuente | RF-04 | RN-07 |
| CU-02 Cargar convocatoria *(v5: enlace oficial; v6 sesión 019: cobertura por departamentos)* | RF-05, 06 | RNF-11, 14, 29, **RN-34** |
| CU-03 Adjuntar documentos | RF-07 | RNF-02, 06, **RNF-16, RNF-18**, **RN-01** *(v6, sesion 016: una publicada no pierde su ultimo adjunto)*, *(v6, sesion 012: los adjuntos viven en un bucket privado y se entregan por URL firmada de 15 min; tipos y tamano validados en cliente, en servidor y en el propio bucket)* |
| CU-04 Definir requisitos | RF-08 | RN-04 |
| CU-05 Publicar *(v5: exige enlace válido; v6 sesión 019: exige cobertura)* | RF-09 | RN-01, RNF-11, 29, **RN-34** |
| CU-06 Cierre automático | RF-10 | RN-02, RNF-12 |
| CU-07 Catálogo y chips *(v6: cerradas fuera del listado por defecto; solo empresas; sesión 016: chips derivados del catálogo vigente; sesión 019: filtro por departamento)* | RF-11, 12, 43 | RNF-04, **RN-02, RN-33, RN-34** |
| CU-08 Detalle y descargas *(v5: enlace al portal; v6: solo empresas; sesión 016: descarga por URL firmada heredando la visibilidad de la fila)* | RF-13, **73** | RNF-06, **RNF-16**, **RN-33** |
| CU-09 Proyecto enriquecido *(v6: completitud accionable; sesión 019: departamento)* | RF-14, 45, 46, 47, **81** | RN-21, RNF-03, **RNF-07**, **RN-34** |
| CU-10 Sugerencias con % *(v6: solo vigentes; sesión 019: cálculo en servidor, ubicación por departamento, 2a y 2b)* | RF-15, 16, **81** | RN-05, RNF-05, **RN-02**, **RNF-20**, **RN-34** |
| CU-11 Iniciar postulación *(v6: vigencia verificada en servidor; sesión 020: una en curso por par)* | RF-17, 21, **78** | RN-03, 04, 19, **RNF-20**, **RN-35** |
| CU-12 Checklist *(sesión 020: solo lectura si está cerrada)* | RF-18, 20 | **RN-35** |
| CU-13 Estados *(v5: generar/editar documento, enlace al portal, solicitar consultor; v6: grafo de transiciones y jerarquía del portal)* | RF-19, 20, 28, 53, 73, **83** | RNF-11, 12, **RN-19**, **RN-35** |
| CU-14 Cuenta *(v6: dos puertas, panel oculto; sesión 021: consentimiento)* | RF-01, 02, 03, **84, 85, 88** | RNF-01, **30, 35**, RN-06, **32** |
| CU-15..17 Perfil consultor *(sesión 021: consentimiento, mínimos en el servidor)* | RF-22..25, **88** | RN-13, RNF-16, 18 |
| CU-18 Encargos (consultor) *(v5: contexto, contacto)* | RF-30, 32, **68, 69, 70** | RN-10, **29**, RN-25, RN-26, RF-40 |
| CU-19..23 Contratación *(v5: contexto, tipo de ayuda, contacto, solicitud directa, buscador; v6: visibilidad por pareja empresa-consultor; sesión 022: contacto solo tras aceptar, sin equipo interno en el directorio)* | RF-26, **27**, 28..31, 68, 69, 70, 74, 75, **80** | RN-08, 12, 25, 26, RNF-19, **RNF-16, 30** |
| CU-24 Calificar *(v6: contador al completar)* | RF-33 | RN-09, RNF-17 |
| CU-25..27 Gestión consultores *(CU-26 v5: contacto; CU-27 v5: cancela encargos en curso; v6: revoca autorizaciones en cascada; sesión 022: motivo de suspensión y cancelación de las solicitudes pendientes)* | RF-34, 35, 70, **76**, **80** | RN-08, 13, 15, 26, 29, RNF-11, **16**, **RN-27** |
| CU-28..30 Suscripción *(v6: comparador con atributos reales)* | RF-37, 38, 41, **82** | RN-11, 16, **RNF-14** |
| CU-31 Planes y suscripciones | RF-36, 42, 51 | RNF-14, 20 |
| CU-32 Enforcement *(v6: revocación en cascada al vencer)* | RF-40, 39, **76** | RNF-20, RN-08, 10, **RN-27, 29** |
| **CU-33 Generar documento** *(v6: actor solo empresa; vigencia verificada en servidor)* | RF-53..57, 62, 48, **78** | RN-17, 19, 20, 21, RNF-21, 23, 24, **RN-28, RNF-30** |
| **CU-34 Revisar y exportar** *(v5: acceso del consultor; v6: autorización derivada, cupo y traza)* | RF-58..61, 71, 72, **76, 77, 79** | RN-20, 22, 27, 28, RNF-23, **RNF-11, 20** |
| **CU-35 Cupo de créditos** | **RF-48, 49, 50, 52** | **RN-17, 18, RNF-20, 24** |
| **CU-36 Indicadores landing** *(v6: cifra legible en reposo; solo agregados)* | **RF-44** | RNF-04, **RNF-07, RN-33** |
| **CU-37 Plantilla de generación** *(v4 — ausente de la matriz hasta v6)* | **RF-63** | **RNF-14, 22, 23** |
| **CU-38 Activar MFA** *(v5; v6: la cuenta nace de CU-41/42)* | **RF-64** | **RNF-28**, RN-06 |
| **CU-39 Eventos de seguridad** *(v5)* | **RF-65** | **RNF-11, 25, 26, 27** |
| **CU-40 Bloqueos por límite de tasa** *(v5)* | **RF-66, 67** | **RNF-27, 33** |
| **CU-41 Gestionar administradores** *(nuevo v6)* | **RF-65, 85, 86, 87** | **RN-06, 31, 32, RNF-28, 30, 35** |
| **CU-42 Activar cuenta de administrador invitada** *(nuevo v6)* | **RF-03, 64, 86** | **RN-32, RNF-28** |
| **Transversal — autorización y aislamiento** *(nuevo v6)* | **RF-76..80** | **RNF-03, 11, 16, 20, 30..33, RN-12, 27, 28, 30** |
| **Transversal — usabilidad de los flujos** *(nuevo v6)* | **RF-81, 82, 83** | **RNF-07, 08, 14, 34** |

---

*Especificación del MVP v6 · Plataforma de Gestión de Convocatorias · Septiembre 2026. Diagramas complementarios: `Arquitectura_Empresarial_MVP_v4.png` y `Modelo_de_Datos_IA_Creditos.png`, más los de la v2 y v3 para la base y el módulo de consultores.*

