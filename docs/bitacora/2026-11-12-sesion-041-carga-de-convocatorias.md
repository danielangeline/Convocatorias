# Sesión 041 · 2026-11-12 (carga de datos, sin código)

**Sprint:** 5 · carga de catálogo pedida por el Product Owner
**Commits:** solo este cierre (no se tocó código ni migraciones)

## Objetivo de la sesión

Subir al catálogo las 207 fuentes de `CARGA_FINANCIADORES.csv`, las convocatorias de `plantilla-carga-masiva-convocatorias-FINAL.xlsx` y más convocatorias —de cualquier país, pero que sirvan para Colombia— con su TDR, y publicarlas (CU-50, RF-118, RF-09, RN-01, RN-39).

## Qué se hizo

- **Fuentes (RF-04):** 204 creadas, 3 ya existían, 0 fallos.
- **Plantilla:** de 29 filas con fecha, 29 cargadas con TDR salvo las que no lo tenían o traían errores (departamento «14», fechas vencidas). Se agregaron los TDR hallados en las webs oficiales (Sercotec, RIE, ANII, EU-LAC).
- **Grants.gov (API pública, `search2` y `fetchOpportunity`):** 59 convocatorias con su NOFO como TDR; las que el texto oficial abre a entidades extranjeras llevan «todos los países».
- **Horizon Europe (API SEDIA):** 29 temas con el programa de trabajo oficial como TDR; Colombia es elegible para financiación automática (lista de países participantes v3.7).
- **IKI Medium Grants** (solo sede en Alemania/UE; Colombia entra como socia local) y **CSCI 2027** (solo EE. UU.), del listado del Product Owner.
- **Publicación:** 98 de 99 publicadas por `POST /api/admin/convocatorias/{id}/publicar`; **50 sirven a Colombia** (todos los países o `CO`).

## Cómo se verificó

Todo pasó por el importador real (vista previa y confirmación), con administrador temporal con MFA, ya borrado. Consulta final a la base: 99 cargadas, 98 publicadas, 50 con alcance a Colombia.

## Decisiones tomadas

- No se saltó la regla de TDR (CU-50 4e): lo que no tenía documento oficial descargable no se cargó.
- Para cumplir RN-01 (dos requisitos) se añadió a los borradores un requisito genérico: «Presentar la postulación según las instrucciones del documento oficial (TDR adjunto)».
- Los países de EU-LAC, RIE y ANII se tomaron de sus documentos oficiales (UE+LAC, hispanoamérica, LAC).

## Qué quedó abierto

- **Araucária CP 20/2026**: sin publicar; sus enlaces dan 404 al servidor. Subir el PDF a mano.
- **Beneficios tributarios para Colombia:** no se halló ninguno con fecha de cierre verificable y TDR (Minciencias 853, exención de IVA, es de ventanilla abierta sin fecha; la 970 de CTeI no está confirmada).
- Las convocatorias solo EE. UU. quedan publicadas, pero no se sugieren a empresas colombianas (RN-39).

## Hallazgos no planificados

- La API de la UE ignora los filtros de estado y fecha; hay que filtrar en el cliente.
- Varios fondos latinoamericanos y colombianos que parecían abiertos ya habían cerrado (TriNova, FSTP3a, Fondo Emprender 2026).
