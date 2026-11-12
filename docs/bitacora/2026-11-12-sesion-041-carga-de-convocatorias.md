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
- **Segunda tanda Horizon (60 temas, mismo método):** se leyeron las condiciones de cada tema en la API SEDIA y se excluyeron los que limitan la participación a entidades de la UE o países asociados. Un primer reintento de la carga falló en 40 filas por un error transitorio de guardado; se reintentó y quedaron todas.
- **Corrección propia:** 9 temas de la primera tanda tenían esa restricción (ciberseguridad ECCC, SPACE, INFRA-DEV, GOVERNANCE-03) y se habían publicado por error; se **despublicaron**.
- **Publicación:** por `POST /api/admin/convocatorias/{id}/publicar`. Resultado final: 159 cargadas, 149 publicadas, **101 sirven a Colombia** (todos los países o `CO`).

- **Beneficios tributarios (tipo `beneficio_tributario`, RF-102):** 6 cargadas (las 4 siguientes más la tarifa preferencial ZOMAC y el descuento en renta con certificación ANLA del art. 255 ET, estas dos con fecha de cierre referencial 2027-12-31 y 2026-12-31 y, la ZOMAC, con un documento de un tercero como TDR) y publicadas por pedido expreso del Product Owner: régimen excepcional por el sismo (Decreto Legislativo 1413 de 2026), alivios tributarios del Decreto 1419, Obras por Impuestos para la Reconstrucción (Decreto Legislativo 1389) y certificados UPME de la Ley 1715 (Res. UPME 400/2026). Su «fecha de cierre» es la vigencia que declara la norma o, en la UPME, una fecha referencial (fin de 2026) porque la ventana es continua. Los TDR son el texto oficial cuando existe (UPME, manual de OxI) y un análisis de Cuatrecasas para los decretos del sismo, porque el texto oficial no se halló.

## Cómo se verificó

Todo pasó por el importador real (vista previa y confirmación), con administrador temporal con MFA, ya borrado. Consulta final a la base: 159 cargadas, 149 publicadas, 101 con alcance a Colombia.

## Decisiones tomadas

- No se saltó la regla de TDR (CU-50 4e): lo que no tenía documento oficial descargable no se cargó.
- Para cumplir RN-01 (dos requisitos) se añadió a los borradores un requisito genérico: «Presentar la postulación según las instrucciones del documento oficial (TDR adjunto)».
- Los países de EU-LAC, RIE y ANII se tomaron de sus documentos oficiales (UE+LAC, hispanoamérica, LAC).

## Qué quedó abierto

- **Araucária CP 20/2026** (borrador) y 9 temas Horizon restringidos a la UE (despublicados): sin publicar; sus enlaces dan 404 al servidor. Subir el PDF a mano.
- **Beneficios tributarios para Colombia:** no se halló ninguno con fecha de cierre verificable y TDR (Minciencias 853, exención de IVA, es de ventanilla abierta sin fecha; la 970 de CTeI no está confirmada).
- Las convocatorias solo EE. UU. quedan publicadas, pero no se sugieren a empresas colombianas (RN-39).

## Hallazgos no planificados

- La API de la UE ignora los filtros de estado y fecha; hay que filtrar en el cliente.
- Varios fondos latinoamericanos y colombianos que parecían abiertos ya habían cerrado (TriNova, FSTP3a, Fondo Emprender 2026).
