# Sesión 027 · Documentos generados con el modelo real (para la revisión de RNF-23)

Generados el 19 de octubre de 2026 con `gpt-5.4-mini` y la plantilla v1, sobre una copia temporal de la convocatoria de Minciencias «CTeI para la Atención de Desafíos en Salud Derivados de la Situación de Desastre (Conv. 1)», con su TDR real (37.191 caracteres) y sus 13 requisitos. Los proyectos y la empresa son **datos de prueba inventados por el script** (`scripts/medicion-ia-real.mjs`); las cuentas y documentos ya se borraron.

**Qué revisar (RNF-23):** que ninguna cifra, nombre o antecedente venga de fuera del proyecto o del TDR, y que todo lo que falte esté como `[COMPLETAR: …]`.

## Medición (RNF-21)

| # | Proyecto | HTTP | Tiempo total | Tiempo del modelo | Tokens ent./sal. | Costo USD | Pendientes |
|---|---|---|---|---|---|---|---|
| 2 | completo (100 %) | 201 | 12.9 s | 10.8 s | 11.465 / 1.842 | 0.0169 | 7 |
| 3 | a medias (33 %) | 201 | 9.8 s | 8.1 s | 11.296 / 1.389 | 0.0147 | 30 |
| 4 | casi vacío (0 %) | 201 | 10.2 s | 8.5 s | 11.247 / 1.627 | 0.0158 | 24 |
| 5 | completo (100 %) | 201 | 9.8 s | 8.2 s | 11.465 / 1.727 | 0.0164 | 8 |
| 6 | a medias (33 %) | 201 | 9.9 s | 8.2 s | 11.296 / 1.566 | 0.0155 | 27 |
| 7 | casi vacío (0 %) | 201 | 9.4 s | 8.0 s | 11.247 / 1.623 | 0.0157 | 9 |
| 8 | completo (100 %) | 201 | 9.7 s | 8.1 s | 11.465 / 1.367 | 0.0147 | 6 |
| 9 | a medias (33 %) | 201 | 9.2 s | 7.7 s | 11.296 / 1.417 | 0.0148 | 22 |
| 10 | casi vacío (0 %) | 201 | 11.8 s | 10.3 s | 11.247 / 1.916 | 0.0171 | 36 |
| 11 | completo (100 %) | 201 | 11.5 s | 9.6 s | 11.465 / 1.957 | 0.0174 | 13 |
| 12 | a medias (33 %) | 201 | 8.7 s | 7.2 s | 11.296 / 1.235 | 0.0140 | 26 |
| 13 | casi vacío (0 %) | 201 | 9.4 s | 7.8 s | 11.247 / 1.547 | 0.0154 | 35 |
| 14 | completo (100 %) | 201 | 11.4 s | 9.9 s | 11.465 / 2.023 | 0.0177 | 10 |
| 15 | a medias (33 %) | 201 | 8.8 s | 7.3 s | 11.296 / 1.306 | 0.0143 | 26 |
| 16 | casi vacío (0 %) | 201 | 8.7 s | 7.1 s | 11.247 / 1.276 | 0.0142 | 36 |
| 17 | completo (100 %) | 201 | 10.0 s | 8.5 s | 11.465 / 1.848 | 0.0169 | 8 |
| 18 | a medias (33 %) | 201 | 7.7 s | 6.2 s | 11.296 / 1.020 | 0.0131 | 9 |
| 19 | casi vacío (0 %) | 201 | 9.0 s | 7.5 s | 11.247 / 1.391 | 0.0147 | 13 |
| 20 | completo (100 %) | 201 | 9.2 s | 7.7 s | 11.465 / 1.432 | 0.0150 | 8 |

La generación 1 (no está en la tabla) se hizo antes, con el proyecto completo: 201 en 22,5 s (incluye compilar la ruta en desarrollo), 11.465 / 1.624 tokens, USD 0,0159, 7 pendientes.

---

## Generación 1 · proyecto completo

### Resumen ejecutivo

El proyecto Telemedicina para la atención de salud mental tras inundaciones 0f10c0, presentado por Medición IA 0f10c0, busca implementar una plataforma de teleconsulta psicológica y seguimiento comunitario para municipios afectados por inundaciones en La Mojana. La iniciativa se enfoca en la línea temática de salud mental y rehabilitación, en coherencia con la convocatoria de Minciencias para la atención de desafíos en salud derivados de situaciones de desastre.

El proyecto propone reducir la brecha de atención en salud mental de la población damnificada mediante un modelo de telepsicología con agentes comunitarios. Para ello, contempla un diagnóstico participativo, el desarrollo de una plataforma que funcione con baja conectividad, la formación de 40 agentes comunitarios en primeros auxilios psicológicos, un piloto de 9 meses y una evaluación con escalas validadas para medir el efecto sobre síntomas de ansiedad y depresión.

La propuesta plantea una duración de 18 meses, un presupuesto total estimado de $1.100.000.000 y una financiación solicitada a la convocatoria de $850.000.000. Como resultados esperados, se prevé un modelo validado, un protocolo publicado y la transferencia a la ESE departamental.

### Problema y justificación

Tras las inundaciones de 2024 en La Mojana, la población afectada no tiene acceso a atención en salud mental. Según la información del proyecto, los centros de salud más cercanos están a más de dos horas y no cuentan con psicólogos, lo que limita la atención oportuna de las necesidades emocionales y psicosociales derivadas de la emergencia.

Esta situación se alinea con la línea temática de salud mental y rehabilitación de la convocatoria, que permite proyectos orientados al desarrollo de modelos, tecnologías o estrategias de atención en salud mental y apoyo psicosocial dirigidas a la población afectada por el desastre y sus familias, con énfasis en la continuidad de la atención y en la reducción de barreras de acceso en las zonas afectadas. En ese sentido, el proyecto propone una respuesta territorial basada en telepsicología y apoyo comunitario, pertinente frente a las barreras de acceso descritas.

La justificación técnica del proyecto se basa en la necesidad de ampliar la disponibilidad de soluciones en salud mental para la población damnificada de cuatro municipios de La Mojana sucreña, mediante una alternativa que pueda operar con baja conectividad y articular agentes comunitarios en el seguimiento y la orientación inicial.

### Objetivos

Objetivo general:
Reducir la brecha de atención en salud mental de la población damnificada mediante un modelo de telepsicología con agentes comunitarios.

Objetivos específicos:
1. Formar 40 agentes comunitarios en primeros auxilios psicológicos.
2. Implementar una plataforma de teleconsulta que funcione con baja conectividad.
3. Evaluar el efecto del modelo en síntomas de ansiedad y depresión.

Los objetivos específicos guardan coherencia con el objetivo general, en tanto combinan fortalecimiento de capacidades comunitarias, desarrollo tecnológico y evaluación de resultados en salud mental.

### Población beneficiaria

La población beneficiaria estimada del proyecto es de 3.000 personas damnificadas de cuatro municipios de La Mojana sucreña.

[COMPLETAR: nombres de los cuatro municipios beneficiarios].

La propuesta se orienta a población afectada por inundaciones, en un contexto de barreras de acceso a servicios de salud mental derivadas de la distancia a los centros de salud y la ausencia de psicólogos disponibles.

### Metodología y actividades

La metodología propuesta incluye un diagnóstico participativo, el desarrollo de la plataforma de teleconsulta, la formación de agentes comunitarios, un piloto de 9 meses y una evaluación con escalas validadas.

Actividades principales:
- Diagnóstico participativo con la población y actores del territorio.
- Desarrollo de la plataforma de teleconsulta psicológica con funcionamiento en condiciones de baja conectividad.
- Formación de 40 agentes comunitarios en primeros auxilios psicológicos.
- Implementación de un piloto durante 9 meses.
- Evaluación del efecto del modelo en síntomas de ansiedad y depresión mediante escalas validadas.

[COMPLETAR: detalle de la estrategia de implementación por fases, el equipo responsable y los mecanismos específicos de seguimiento y atención].

La propuesta se ajusta a la convocatoria en la medida en que plantea investigación aplicada, desarrollo tecnológico e innovación en salud mental, sin incluir prestación directa de servicios de salud, obra civil ni actividades excluidas por los términos de referencia.

### Resultados esperados

Los resultados esperados del proyecto son los siguientes:
- Modelo validado de telepsicología con agentes comunitarios para atención de salud mental en contexto de inundaciones.
- Protocolo publicado.
- Transferencia del modelo a la ESE departamental.
- Plataforma de teleconsulta funcional con baja conectividad.
- 40 agentes comunitarios formados en primeros auxilios psicológicos.
- Evidencia sobre el efecto del modelo en síntomas de ansiedad y depresión.

[COMPLETAR: indicadores, metas cuantificables y medios de verificación de cada resultado].

Estos resultados se articulan con el enfoque de la convocatoria en generar evidencias y herramientas tecnológicas que fortalezcan la capacidad del país para responder a futuros desastres, en particular en el componente de salud mental y rehabilitación.

### Presupuesto

Presupuesto total estimado del proyecto: $1.100.000.000.

Monto de financiación solicitado a la convocatoria: $850.000.000.

[COMPLETAR: detalle presupuestal por rubros, fuentes de contrapartida y distribución de los recursos entre actividades].

La convocatoria exige una contrapartida mínima del 10% del presupuesto total. Con base en el presupuesto total informado, el valor mínimo de contrapartida debe acreditarse en los soportes de la postulación. [COMPLETAR: fuente y valor de la contrapartida].

### Cronograma

Duración total del proyecto: 18 meses.

Secuencia general de ejecución informada:
1. Diagnóstico participativo.
2. Desarrollo de la plataforma.
3. Formación de agentes comunitarios.
4. Piloto de 9 meses.
5. Evaluación con escalas validadas.

[COMPLETAR: cronograma detallado por mes o por hitos, con fechas de inicio y fin de cada actividad].

La duración propuesta debe organizarse y presentarse conforme a los requisitos de la convocatoria y a los contenidos del proyecto en la plataforma SIGP.

### Experiencia de la organización

Medición IA 0f10c0 reporta como experiencia previa el desarrollo, en 2022, de una aplicación de citas médicas para dos IPS de Sincelejo.

[COMPLETAR: soportes documentales que acrediten la experiencia, incluyendo nombre de las IPS, alcance del proyecto, valor ejecutado, fechas y documentos exigidos por el Anexo 7].

Con la información disponible, esta trayectoria se presenta como antecedente relevante para el desarrollo de soluciones tecnológicas en salud; sin embargo, para efectos de la convocatoria debe acreditarse formalmente el cumplimiento de la experiencia previa demostrada exigida por los términos de referencia.

---

## Generación 2 · proyecto completo (100 %)

### Resumen ejecutivo

El proyecto Telemedicina para la atención de salud mental tras inundaciones 1cf7f7, presentado por Medición IA 1cf7f7, busca implementar una plataforma de teleconsulta psicológica y seguimiento comunitario para municipios afectados por inundaciones en La Mojana, con foco en el departamento de Sucre. La propuesta se orienta a responder al problema de acceso a atención en salud mental que enfrentan las personas damnificadas tras las inundaciones de 2024, en un contexto donde los centros de salud más cercanos están a más de dos horas y no cuentan con psicólogos.

La iniciativa se alinea con la Línea 1. Salud mental y rehabilitación de la convocatoria, al proponer el desarrollo de un modelo de telepsicología con agentes comunitarios para reducir barreras de acceso y fortalecer la continuidad de la atención. El proyecto contempla un diagnóstico participativo, el desarrollo de una plataforma funcional con baja conectividad, la formación de 40 agentes comunitarios, un piloto de 9 meses y una evaluación del efecto del modelo en síntomas de ansiedad y depresión mediante escalas validadas.

La población beneficiaria estimada es de 3.000 personas damnificadas de cuatro municipios de La Mojana sucreña. El presupuesto total estimado del proyecto es de $1.100.000.000 y el monto de financiación que busca es de $850.000.000. La duración propuesta es de 18 meses. Como resultados esperados se plantean un modelo validado, un protocolo publicado y la transferencia del modelo a la ESE departamental.

### Problema y justificación

Tras las inundaciones de 2024 en La Mojana, la población afectada no tiene acceso a atención en salud mental. De acuerdo con la información del proyecto, los centros de salud más cercanos están a más de dos horas y no tienen psicólogos, lo que genera una barrera territorial de acceso a atención oportuna y continua para las personas damnificadas.

La convocatoria prioriza proyectos de CTeI en salud orientados a atender desafíos derivados de la situación de desastre, y en su Línea 1 contempla el desarrollo de modelos, tecnologías o estrategias de atención en salud mental y apoyo psicosocial dirigidas a la población afectada por el desastre y sus familias, con énfasis en la continuidad de la atención y la reducción de barreras de acceso. En ese marco, el proyecto propone una respuesta tecnológica y comunitaria mediante telepsicología y seguimiento comunitario.

La justificación del proyecto se soporta en la necesidad de reducir la brecha de atención en salud mental en municipios afectados por inundaciones, mediante un modelo que combine teleconsulta psicológica, apoyo de agentes comunitarios y una plataforma adaptada a baja conectividad. Esta propuesta apunta a facilitar la atención en el territorio y a evaluar su efecto en síntomas de ansiedad y depresión en la población beneficiaria.

### Objetivos

Objetivo general:
Reducir la brecha de atención en salud mental de la población damnificada mediante un modelo de telepsicología con agentes comunitarios.

Objetivos específicos:
1. Formar 40 agentes comunitarios en primeros auxilios psicológicos.
2. Implementar una plataforma de teleconsulta que funcione con baja conectividad.
3. Evaluar el efecto del modelo en síntomas de ansiedad y depresión.

### Población beneficiaria

La población beneficiaria del proyecto está conformada por 3.000 personas damnificadas de cuatro municipios de La Mojana sucreña.

La propuesta se enfoca en personas afectadas por las inundaciones de 2024 en La Mojana, quienes presentan barreras de acceso a servicios de salud mental por la distancia a los centros de salud y por la ausencia de psicólogos en dichos servicios. [COMPLETAR: nombres de los cuatro municipios beneficiarios].

Adicionalmente, el proyecto contempla la formación de 40 agentes comunitarios en primeros auxilios psicológicos, quienes harán parte de la estrategia de seguimiento comunitario.

### Metodología y actividades

La metodología propuesta combina diagnóstico participativo, desarrollo tecnológico, formación comunitaria, piloto de implementación y evaluación de resultados. El proyecto se desarrollará en 18 meses.

Actividades principales:
1. Diagnóstico participativo con la población y actores del territorio para caracterizar la necesidad de atención en salud mental tras las inundaciones.
2. Desarrollo de la plataforma de teleconsulta psicológica con capacidad de operación en contextos de baja conectividad.
3. Formación de 40 agentes comunitarios en primeros auxilios psicológicos.
4. Implementación de un piloto de 9 meses del modelo de telepsicología y seguimiento comunitario.
5. Evaluación del efecto del modelo en síntomas de ansiedad y depresión mediante escalas validadas.
6. Sistematización de la experiencia para la elaboración de un protocolo y la transferencia del modelo a la ESE departamental.

La propuesta se enmarca en la Línea 1 de la convocatoria, orientada a salud mental y rehabilitación, y responde al objetivo de generar soluciones innovadoras que atiendan necesidades de salud derivadas de la situación de desastre. [COMPLETAR: entidad ejecutora o aliados que acompañarán la implementación, si aplica].

### Resultados esperados

Se esperan los siguientes resultados:
- Modelo de telepsicología con agentes comunitarios validado en el contexto de La Mojana sucreña.
- Plataforma de teleconsulta psicológica operando con baja conectividad.
- 40 agentes comunitarios formados en primeros auxilios psicológicos.
- Evaluación del efecto del modelo en síntomas de ansiedad y depresión con escalas validadas.
- Protocolo publicado.
- Transferencia del modelo a la ESE departamental.

Estos resultados se alinean con la convocatoria en términos de desarrollo de conocimiento aplicado, innovación en salud mental y generación de herramientas que contribuyan a reducir barreras de acceso en poblaciones afectadas por desastres.

### Presupuesto

El presupuesto total estimado del proyecto es de $1.100.000.000.

El monto de financiación que se busca en la convocatoria es de $850.000.000.

De acuerdo con los términos de referencia, la contrapartida mínima exigida es del 10% del presupuesto total, en dinero, en especie o en una combinación de ambas. Con la información disponible, no se precisa aún el valor ni la naturaleza de la contrapartida.
[COMPLETAR: valor de la contrapartida y fuente/aporte].

El presupuesto detallado por rubros debe ajustarse al Anexo 5 de la convocatoria.
[COMPLETAR: desglose presupuestal por rubros según Anexo 5].

### Cronograma

La duración del proyecto es de 18 meses.

Secuencia general de actividades:
1. Meses iniciales: diagnóstico participativo.
2. Desarrollo de la plataforma de teleconsulta psicológica.
3. Formación de 40 agentes comunitarios en primeros auxilios psicológicos.
4. Piloto de implementación durante 9 meses.
5. Evaluación del efecto del modelo en síntomas de ansiedad y depresión.
6. Sistematización, elaboración de protocolo y transferencia a la ESE departamental.

La información entregada no permite distribuir con precisión las actividades por meses ni establecer hitos intermedios.
[COMPLETAR: cronograma detallado por meses o fases].

### Experiencia de la organización

Medición IA 1cf7f7 reporta como experiencia previa que desarrolló en 2022 una aplicación de citas médicas para dos IPS de Sincelejo.

Esta experiencia se relaciona con el desarrollo de soluciones digitales para el sector salud y puede servir como antecedente para la implementación de la plataforma de teleconsulta propuesta. Sin embargo, para efectos de la convocatoria, se debe acreditar la experiencia conforme al Anexo 7 y a la condición mínima exigida según la modalidad seleccionada.
[COMPLETAR: soportes de experiencia que demuestren cumplimiento del requisito de experiencia previa de la convocatoria].

También debe verificarse el requisito de domicilio de la entidad ejecutora en Colombia y, si la propuesta se presenta como proyecto territorial, el domicilio en el departamento priorizado donde se ejecuta.
[COMPLETAR: domicilio legal de la entidad ejecutora].

---

## Generación 3 · proyecto a medias (33 %)

### Resumen ejecutivo

El proyecto Monitoreo de calidad del agua en zonas inundadas 1cf7f7, presentado por Medición IA 1cf7f7, busca desarrollar sensores de bajo costo para vigilar la calidad del agua de consumo en comunidades rurales tras una emergencia. La propuesta responde al problema de incremento de enfermedades diarreicas por consumo de agua contaminada después de las inundaciones. El objetivo general es detectar a tiempo la contaminación del agua de consumo en veredas afectadas. El proyecto se ejecutaría en Córdoba, en una duración de 12 meses. La postulación se enmarca en la Convocatoria de CTeI para la Atención de Desafíos en Salud Derivados de la Situación de Desastre (Conv. 1) de Minciencias, y se relaciona con la línea temática de salud ambiental frente al manejo de escombros y contaminación, en particular la contaminación de fuentes hídricas. [COMPLETAR: modalidad de postulación elegida]. [COMPLETAR: monto solicitado a Minciencias]. [COMPLETAR: contrapartida mínima del 10%].

### Problema y justificación

Después de las inundaciones aumenta el riesgo de enfermedades diarreicas debido al consumo de agua contaminada, especialmente en comunidades rurales. Este problema tiene impacto directo en la salud de las poblaciones afectadas por la emergencia, y se relaciona con la necesidad de contar con herramientas tecnológicas que permitan detectar de manera oportuna la contaminación del agua de consumo. La convocatoria busca financiar proyectos de CTeI en salud orientados a atender desafíos derivados de desastres, y específicamente contempla proyectos sobre salud ambiental y contaminación de fuentes hídricas. En ese sentido, la propuesta se justifica por su alineación con la necesidad de generar evidencia y soluciones innovadoras para anticipar, prevenir y mitigar riesgos en salud asociados a la emergencia. [COMPLETAR: evidencia local o territorial que sustente la afectación en Córdoba]. [COMPLETAR: definición de la población afectada y magnitud del problema].

### Objetivos

Objetivo general:
- Detectar a tiempo la contaminación del agua de consumo en veredas afectadas.

Objetivos específicos:
- [COMPLETAR: objetivos específicos del proyecto].

La propuesta debe articularse con los objetivos de la convocatoria orientados a promover investigación, desarrollo tecnológico e innovación en salud para mitigar afectaciones derivadas del sismo y fortalecer capacidades de respuesta ante desastres. [COMPLETAR: ajuste de objetivos para explicitar relación con la línea temática y la modalidad seleccionada].

### Población beneficiaria

La información entregada no especifica la población beneficiaria directa ni indirecta del proyecto. Por la naturaleza de la propuesta, se entiende que estaría orientada a comunidades rurales y veredas afectadas por la emergencia en Córdoba, pero esta caracterización debe completarse con precisión para la postulación. [COMPLETAR: población beneficiaria directa]. [COMPLETAR: población beneficiaria indirecta]. [COMPLETAR: número estimado de beneficiarios]. [COMPLETAR: criterios de selección de las veredas o comunidades].

### Metodología y actividades

La descripción del proyecto indica que la solución propuesta consiste en sensores de bajo costo para vigilar la calidad del agua de consumo en comunidades rurales tras una emergencia. Sin embargo, no se aportan actividades, metodología, fases de implementación, estrategia de validación, plan de trabajo ni articulación con aliados. Para completar la postulación, se requiere detallar cómo se desarrollará, implementará y evaluará la solución propuesta, de acuerdo con los contenidos exigidos por la convocatoria y la modalidad seleccionada. [COMPLETAR: metodología de desarrollo tecnológico]. [COMPLETAR: actividades principales]. [COMPLETAR: fases o hitos del proyecto]. [COMPLETAR: plan de validación o piloto]. [COMPLETAR: aliados o entidades de apoyo, si aplica].

### Resultados esperados

No se entregaron resultados esperados, productos, entregables ni indicadores del proyecto. Para efectos de la convocatoria, se debe especificar qué se obtendrá al finalizar la ejecución de 12 meses y cómo esos resultados aportarán a la detección temprana de contaminación del agua de consumo en veredas afectadas. [COMPLETAR: resultados esperados]. [COMPLETAR: productos verificables]. [COMPLETAR: indicadores de logro]. [COMPLETAR: nivel de madurez tecnológica esperado].

### Presupuesto

No se suministró presupuesto estimado total, monto solicitado a la convocatoria ni distribución por rubros. La convocatoria exige presupuesto detallado según los rubros del Anexo 5 y contrapartida mínima del 10% del presupuesto total, en dinero, en especie o en combinación de ambas. [COMPLETAR: presupuesto total del proyecto]. [COMPLETAR: monto solicitado a Minciencias]. [COMPLETAR: valor de la contrapartida]. [COMPLETAR: distribución presupuestal por rubros].

### Cronograma

La duración del proyecto es de 12 meses. No se entregó un cronograma detallado con actividades, hitos o fechas. Para la postulación, el cronograma debe organizarse de forma coherente con la duración propuesta y con los requerimientos de la convocatoria. [COMPLETAR: cronograma mensual o por hitos]. [COMPLETAR: relación entre actividades y resultados]. [COMPLETAR: fechas de inicio y cierre del proyecto].

### Experiencia de la organización

La organización proponente es Medición IA 1cf7f7. No se aportó información sobre su experiencia, trayectoria, proyectos ejecutados, ni soportes de cumplimiento del requisito de experiencia exigido por la convocatoria. La plataforma solicita acreditar experiencia previa demostrada, y para la modalidad aplicable deben presentarse los soportes correspondientes. [COMPLETAR: experiencia de la organización]. [COMPLETAR: proyectos ejecutados en los últimos cinco años]. [COMPLETAR: valor acumulado o porcentaje exigido por la convocatoria]. [COMPLETAR: documentos soporte de experiencia].

---

## Generación 4 · proyecto casi vacío (0 %)

### Resumen ejecutivo

El proyecto de salud rural 1cf7f7, presentado por Medición IA 1cf7f7, se postula a la Convocatoria de CTeI para la Atención de Desafíos en Salud Derivados de la Situación de Desastre (Conv. 1) de Minciencias. La convocatoria busca financiar proyectos de ciencia, tecnología e innovación en salud orientados a mitigar las afectaciones derivadas del sismo del 10 de agosto de 2026, con prioridad en los departamentos de Chocó, Valle del Cauca, Risaralda, Caldas y Quindío.

De la información disponible, se conoce que el proyecto se ejecutará en Bolívar. Sin embargo, no se cuenta con datos sobre el problema específico que aborda, la modalidad de postulación, la línea temática, el objetivo general, la población beneficiaria, las actividades, los resultados esperados, la duración, el presupuesto ni la contrapartida. Por tanto, estos elementos deben completarse antes de la radicación.

### Problema y justificación

La convocatoria de Minciencias se fundamenta en la necesidad de atender desafíos de salud derivados de una situación de desastre ocasionada por el sismo del 10 de agosto de 2026. Según los términos de referencia, este evento generó afectaciones humanas, sociales, económicas y de infraestructura en 16 departamentos y 330 municipios del país, y motivó la priorización de cinco departamentos con mayor afectación directa.

En ese marco, el proyecto debe explicar con claridad cuál es el problema de salud que pretende resolver en Bolívar y cómo se relaciona con las líneas temáticas de la convocatoria. Con la información entregada no es posible precisar la justificación técnica del proyecto, por lo cual se requiere completar: [COMPLETAR: descripción del problema de salud que el proyecto atiende], [COMPLETAR: relación del proyecto con la línea temática seleccionada], [COMPLETAR: evidencia de afectación territorial en Bolívar], y [COMPLETAR: modalidad de financiación seleccionada].

### Objetivos

Objetivo general: [COMPLETAR: objetivo general del proyecto].

Objetivos específicos:
- [COMPLETAR: objetivo específico 1].
- [COMPLETAR: objetivo específico 2].
- [COMPLETAR: objetivo específico 3].

La convocatoria establece como objetivos generales promover la investigación, el desarrollo tecnológico y la innovación en salud para mitigar las afectaciones derivadas del sismo, ampliar la disponibilidad de conocimientos, tecnologías y soluciones, fortalecer capacidades científicas y tecnológicas, y generar evidencias y herramientas para anticipar y mitigar el impacto de futuros desastres. El proyecto deberá alinearse con estos propósitos.

### Población beneficiaria

Población beneficiaria directa: [COMPLETAR: descripción de la población beneficiaria directa].

Población beneficiaria indirecta: [COMPLETAR: descripción de la población beneficiaria indirecta].

La convocatoria orienta sus esfuerzos hacia poblaciones afectadas por la situación de desastre, incluyendo comunidades vulnerables y actores del sistema de salud según la línea temática seleccionada. En consecuencia, el proyecto debe precisar a quiénes atenderá en Bolívar y con qué alcance territorial.

### Metodología y actividades

[COMPLETAR: metodología general del proyecto].

Actividades principales:
- [COMPLETAR: actividad principal 1].
- [COMPLETAR: actividad principal 2].
- [COMPLETAR: actividad principal 3].
- [COMPLETAR: actividad principal 4].

La convocatoria admite proyectos de I+D+i en salud en dos modalidades: macroproyectos departamentales, con impacto directo y verificable en al menos dos departamentos priorizados, y proyectos territoriales, orientados a respuestas locales en uno de los departamentos priorizados. También señala que los proyectos deben enmarcarse en una de cuatro líneas temáticas: salud mental y rehabilitación; enfermedades transmisibles y brotes en contextos de desastre; enfermedades no transmisibles y cáncer frente a situaciones de desastre; y salud ambiental frente al manejo de escombros y contaminación. El proyecto debe indicar con precisión su modalidad, línea temática, nivel de madurez tecnológica y actividades coherentes con ello.

### Resultados esperados

Resultados esperados del proyecto: [COMPLETAR: resultados esperados].

La convocatoria evalúa especialmente la calidad y verificabilidad de productos, el modelo de sostenibilidad, el nivel TRL y la estrategia de réplica, así como el aporte futuro frente a desastres. Por tanto, el proyecto debe precisar productos, entregables o desarrollos verificables que correspondan a su modalidad y línea temática, sin incluir prestación directa de servicios de salud, vigilancia epidemiológica ni obras civiles, dado que la convocatoria no financia esos componentes.

### Presupuesto

Presupuesto total estimado: [COMPLETAR: presupuesto estimado total].

Monto de financiación solicitado a Minciencias: [COMPLETAR: monto de financiación solicitado].

Contrapartida mínima exigida por la convocatoria: 10% del presupuesto total, en dinero, en especie o en una combinación de ambas. En la información entregada no se reporta el valor del presupuesto ni el aporte de contrapartida, por lo que deben completarse estos datos para verificar la elegibilidad. También se debe preparar el presupuesto detallado según los rubros del Anexo 5 de la convocatoria.

### Cronograma

Duración del proyecto: [COMPLETAR: duración en meses].

Cronograma general: [COMPLETAR: cronograma de actividades e hitos].

La convocatoria contempla una duración máxima de 48 meses para la Modalidad 1 y de 24 meses para la Modalidad 2, organizados en hitos anuales. Además, establece como fechas del proceso: apertura el 14 de septiembre de 2026, cierre el 13 de octubre de 2026 a las 5:00 p. m. hora Colombia, revisión de requisitos del 14 al 16 de octubre de 2026, subsanación del 19 al 20 de octubre de 2026, publicación del banco preliminar el 18 de noviembre de 2026 y publicación definitiva el 30 de noviembre de 2026.

### Experiencia de la organización

La organización proponente es Medición IA 1cf7f7. Sin embargo, no se entregó información sobre su trayectoria, experiencia previa, proyectos ejecutados, aliados o reconocimiento como actor del SNCTI.

La convocatoria exige acreditar experiencia previa demostrada, así: para Modalidad 1, al menos un proyecto en los últimos cinco años por un valor igual o superior al 50% del valor solicitado a Minciencias; para Modalidad 2, al menos dos proyectos en los últimos cinco años que acumulen al menos el 40% del valor solicitado. También exige entidad domiciliada en Colombia y, según el caso, documentación de experiencia mediante el Anexo 7. Por tanto, esta sección debe completarse con: [COMPLETAR: experiencia previa demostrada de la organización], [COMPLETAR: soporte documental de los proyectos ejecutados], [COMPLETAR: modalidad de postulación y evidencia correspondiente], y [COMPLETAR: domicilio de la entidad ejecutora en Colombia]

---

## Generación 5 · proyecto completo (100 %)

### 1. Resumen ejecutivo

El proyecto “Telemedicina para la atención de salud mental tras inundaciones 1cf7f7”, presentado por Medición IA 1cf7f7, propone una plataforma de teleconsulta psicológica y seguimiento comunitario para municipios afectados por inundaciones en La Mojana. La iniciativa busca responder a la falta de acceso a atención en salud mental de la población damnificada, dado que los centros de salud más cercanos están a más de dos horas y no cuentan con psicólogos.

La propuesta se orienta a la línea temática de salud mental y rehabilitación de la convocatoria, mediante un modelo de telepsicología con agentes comunitarios. El objetivo general es reducir la brecha de atención en salud mental de la población damnificada. Para ello, se plantea formar 40 agentes comunitarios en primeros auxilios psicológicos, implementar una plataforma de teleconsulta que funcione con baja conectividad y evaluar el efecto del modelo en síntomas de ansiedad y depresión.

El proyecto tendría una duración de 18 meses, beneficiaría a 3.000 personas damnificadas de cuatro municipios de La Mojana sucreña y solicita una financiación de $850.000.000, sobre un presupuesto total estimado de $1.100.000.000. Como resultados esperados, se plantea contar con un modelo validado, un protocolo publicado y la transferencia a la ESE departamental.

### 2. Problema y justificación

Tras las inundaciones de 2024 en La Mojana, la población afectada no tiene acceso a atención en salud mental. Según la información del proyecto, los centros de salud más cercanos están a más de dos horas y no tienen psicólogos, lo que limita la atención oportuna para personas damnificadas que pueden presentar afectaciones emocionales derivadas de la emergencia.

La propuesta se justifica en la necesidad de reducir esa brecha de acceso mediante una solución de telemedicina adaptada a condiciones de baja conectividad, articulada con agentes comunitarios. Esta orientación se alinea con la línea temática de salud mental y rehabilitación de la convocatoria, que contempla el desarrollo de modelos, tecnologías o estrategias de atención en salud mental y apoyo psicosocial dirigidas a la población afectada por el desastre y sus familias, así como la reducción de barreras de acceso en las zonas afectadas.

El proyecto también responde al objetivo de la convocatoria de promover investigación, desarrollo tecnológico e innovación en salud como mecanismo de mitigación de las afectaciones derivadas de la situación de desastre, con soluciones que contribuyan al bienestar de las poblaciones afectadas.

### 3. Objetivos

Objetivo general:
Reducir la brecha de atención en salud mental de la población damnificada mediante un modelo de telepsicología con agentes comunitarios.

Objetivos específicos:
1. Formar 40 agentes comunitarios en primeros auxilios psicológicos.
2. Implementar una plataforma de teleconsulta que funcione con baja conectividad.
3. Evaluar el efecto del modelo en síntomas de ansiedad y depresión.

Estos objetivos son coherentes con el enfoque de la convocatoria en salud mental y rehabilitación, y con la necesidad de generar soluciones innovadoras para la población afectada por desastres.

### 4. Población beneficiaria

La población beneficiaria estimada del proyecto es de 3.000 personas damnificadas de cuatro municipios de La Mojana sucreña.

La propuesta también contempla la participación de 40 agentes comunitarios, quienes serán formados en primeros auxilios psicológicos para apoyar la implementación del modelo de telepsicología. [COMPLETAR: nombres de los cuatro municipios de La Mojana y caracterización adicional de la población beneficiaria].

### 5. Metodología y actividades

La metodología propuesta se desarrolla en torno a un proceso de diagnóstico, diseño, implementación piloto y evaluación del modelo de atención.

Actividades principales:
1. Diagnóstico participativo.
2. Desarrollo de la plataforma.
3. Formación de agentes comunitarios.
4. Piloto de 9 meses.
5. Evaluación con escalas validadas.

La estrategia busca articular tecnología y seguimiento comunitario para operar en contextos de baja conectividad. El proyecto plantea evaluar el efecto del modelo en síntomas de ansiedad y depresión, lo que permite documentar su funcionamiento y su aporte a la atención en salud mental en el territorio.

[COMPLETAR: detalle metodológico de la teleconsulta, criterios de inclusión de participantes, instrumentos específicos de evaluación, ruta de remisión clínica y alianzas requeridas para la ejecución].

### 6. Resultados esperados

Los resultados esperados reportados para el proyecto son:
- Modelo validado.
- Protocolo publicado.
- Transferencia a la ESE departamental.

Adicionalmente, el proyecto espera contar con una plataforma de teleconsulta funcional en condiciones de baja conectividad y con 40 agentes comunitarios formados en primeros auxilios psicológicos. [COMPLETAR: indicadores verificables, metas cuantificables y evidencias asociadas a cada resultado].

Estos resultados se relacionan con la convocatoria en cuanto aportan a la generación de conocimiento aplicado, el desarrollo tecnológico y la innovación en salud mental frente a una situación de desastre.

### 7. Presupuesto

Monto de financiación solicitado a Minciencias: $850.000.000.

Presupuesto total estimado del proyecto: $1.100.000.000.

La convocatoria exige una contrapartida mínima del 10% del presupuesto total, en dinero, en especie o en una combinación de ambas. Con base en la información entregada, el proyecto reporta un valor total superior al monto solicitado, pero no se especifica el origen ni la composición de la contrapartida. [COMPLETAR: valor exacto de la contrapartida, fuente de los aportes y distribución por rubros según el Anexo 5].

### 8. Cronograma

Duración total del proyecto: 18 meses.

La información suministrada indica un piloto de 9 meses, dentro de una ejecución total de 18 meses. [COMPLETAR: cronograma detallado por fases, hitos, productos y meses de ejecución].

De forma general, el proyecto contempla las siguientes etapas:
1. Diagnóstico participativo.
2. Desarrollo de la plataforma.
3. Formación de agentes comunitarios.
4. Piloto de 9 meses.
5. Evaluación con escalas validadas.

[COMPLETAR: fechas de inicio y finalización, responsable de cada actividad y articulación con hitos anuales si aplica].

### 9. Experiencia de la organización

La empresa Medición IA 1cf7f7 desarrolló en 2022 una aplicación de citas médicas para dos IPS de Sincelejo.

Esta experiencia se presenta como antecedente relevante para el desarrollo de soluciones tecnológicas en salud. Sin embargo, la convocatoria exige acreditar experiencia previa demostrada conforme al Anexo 7 y, para la Modalidad 2, al menos dos proyectos en los últimos cinco años que acumulados asciendan a un valor igual o superior al 40% del valor solicitado a Minciencias. Con la información entregada solo se reporta un antecedente. [COMPLETAR: soportes de experiencia que cumplan el requisito de la convocatoria, número adicional de proyectos, valor de cada uno, fechas y entidades contratantes].

También debe verificarse que la entidad ejecutora esté domiciliada en Colombia y, para la Modalidad 2, que esté domiciliada en uno de los departamentos priorizados. La información entregada solo indica que el proyecto se ejecuta en Sucre y no especifica el domicilio de la entidad. [COMPLETAR: certificado o dato de domicilio de la organización].

---

## Generación 6 · proyecto a medias (33 %)

### 1. Resumen ejecutivo

El proyecto Monitoreo de calidad del agua en zonas inundadas 1cf7f7, presentado por Medición IA 1cf7f7, propone el uso de sensores de bajo costo para vigilar la calidad del agua de consumo en comunidades rurales tras una emergencia. La iniciativa responde al problema identificado de aumento de enfermedades diarreicas después de las inundaciones, asociado al consumo de agua contaminada.

La propuesta se alinea con la línea temática 4. SALUD AMBIENTAL FRENTE AL MANEJO DE ESCOMBROS Y CONTAMINACIÓN, en la medida en que aborda la contaminación de fuentes hídricas resultado de la situación de desastre. El objetivo general del proyecto es detectar a tiempo la contaminación del agua de consumo en veredas afectadas.

El proyecto se plantea para ejecutarse en Córdoba, con una duración de 12 meses. [COMPLETAR: modalidad de financiación elegida, valor solicitado a Minciencias, valor total del proyecto y contrapartida].

### 2. Problema y justificación

Después de las inundaciones aumentan las enfermedades diarreicas por consumo de agua contaminada. Este problema afecta de manera directa la salud de comunidades rurales, especialmente en veredas afectadas por la emergencia, donde la calidad del agua de consumo puede alterarse por las condiciones derivadas del desastre.

La convocatoria prioriza proyectos de CTeI en salud orientados a atender desafíos derivados de la situación de desastre y, en particular, permite presentar iniciativas relacionadas con la contaminación de fuentes hídricas y la mitigación de riesgos para la salud humana. En este marco, el proyecto se justifica por su potencial para detectar oportunamente la contaminación del agua de consumo mediante sensores de bajo costo, lo que podría contribuir a una respuesta más rápida frente al riesgo sanitario.

La propuesta se relaciona con una necesidad de salud pública derivada de la emergencia y con el objetivo de ampliar la disponibilidad de conocimientos, tecnologías y soluciones que contribuyan al bienestar de la población afectada. [COMPLETAR: evidencia o diagnóstico local que sustente la magnitud del problema en Córdoba y en las veredas objetivo].

### 3. Objetivos

Objetivo general:
- Detectar a tiempo la contaminación del agua de consumo en veredas afectadas.

Objetivos específicos:
- [COMPLETAR: objetivos específicos del proyecto].

El objetivo general es coherente con la naturaleza del proyecto, que busca desarrollar o adaptar una solución tecnológica de bajo costo para monitorear la calidad del agua en contextos rurales afectados por la emergencia.

### 4. Población beneficiaria

La población beneficiaria corresponde a comunidades rurales y veredas afectadas por inundaciones en el municipio de Córdoba, especialmente aquellas que dependen de agua de consumo potencialmente expuesta a contaminación tras la emergencia.

[COMPLETAR: número de beneficiarios directos].
[COMPLETAR: número de beneficiarios indirectos].
[COMPLETAR: caracterización de la población beneficiaria (edad, género, pertenencia étnica, ubicación exacta, condiciones de vulnerabilidad, entre otros, si aplica)].

### 5. Metodología y actividades

La propuesta se orienta al uso de sensores de bajo costo para vigilar la calidad del agua de consumo en comunidades rurales tras una emergencia. Con la información disponible, la metodología general podría organizarse alrededor de la implementación y seguimiento de esta solución tecnológica en veredas afectadas.

Actividades principales:
- [COMPLETAR: actividades del proyecto].
- [COMPLETAR: fase de diseño, validación, despliegue o prueba de los sensores].
- [COMPLETAR: forma de monitoreo, análisis y reporte de resultados].
- [COMPLETAR: aliados, si existen].

El proyecto deberá precisar su nivel de madurez tecnológica y su correspondencia con la línea temática seleccionada. [COMPLETAR: TRL del proyecto y justificación técnica]. También deberá demostrar el cumplimiento de los requisitos de la convocatoria, incluyendo aval de comité de ética y declaración sobre permisos ambientales, según corresponda.

### 6. Resultados esperados

Con la información disponible, se espera como resultado central una solución tecnológica para detectar a tiempo la contaminación del agua de consumo en veredas afectadas por inundaciones.

Resultados esperados:
- Detección temprana de contaminación del agua de consumo en comunidades rurales afectadas.
- [COMPLETAR: productos esperados del proyecto].
- [COMPLETAR: indicadores de resultado o metas verificables].
- [COMPLETAR: evidencia de validación, pilotaje o implementación de la solución, si aplica].

Dado que la convocatoria valora la calidad y verificabilidad de productos, el modelo de sostenibilidad y la replicabilidad, la propuesta deberá precisar cómo se documentarán y comprobarán estos resultados. [COMPLETAR: descripción de productos y mecanismos de verificación].

### 7. Presupuesto

No se cuenta con información sobre el presupuesto estimado total ni sobre el valor solicitado a la convocatoria.

[COMPLETAR: presupuesto detallado por rubros, conforme al Anexo 5 de la convocatoria].
[COMPLETAR: valor total del proyecto].
[COMPLETAR: valor solicitado a Minciencias].
[COMPLETAR: contrapartida mínima del 10% del presupuesto total, en dinero, especie o combinación de ambas].

La convocatoria exige presupuesto detallado según rubros y acreditación de contrapartida mínima. Asimismo, cada entidad puede presentar una única propuesta en una sola modalidad y recibir financiación para un solo proyecto o macroproyecto.

### 8. Cronograma

La duración propuesta del proyecto es de 12 meses.

Cronograma general:
1. [COMPLETAR: etapa 1 y mes o rango de meses].
2. [COMPLETAR: etapa 2 y mes o rango de meses].
3. [COMPLETAR: etapa 3 y mes o rango de meses].
4. [COMPLETAR: etapa 4 y mes o rango de meses].

La convocatoria establece que los proyectos deben presentarse con cronograma e hitos coherentes con la modalidad seleccionada. [COMPLETAR: distribución de actividades por meses e hitos del proyecto].

### 9. Experiencia de la organización

La información entregada no incluye antecedentes, trayectoria ni experiencia previa demostrada de Medición IA 1cf7f7.

[COMPLETAR: experiencia o trayectoria de la organización].
[COMPLETAR: soportes de experiencia exigidos por el Anexo 7].
[COMPLETAR: proyectos ejecutados en los últimos cinco años que acrediten el cumplimiento del requisito de experiencia según la modalidad elegida].

La convocatoria exige acreditar experiencia previa demostrada y adjuntar la acreditación correspondiente. Sin esta información, no es posible verificar el cumplimiento del requisito habilitante.

---

## Generación 7 · proyecto casi vacío (0 %)

### Resumen ejecutivo

El proyecto de salud rural 1cf7f7 será presentado por Medición IA 1cf7f7 a la convocatoria CTeI para la Atención de Desafíos en Salud Derivados de la Situación de Desastre (Conv. 1) [medición 1cf7f7], del Ministerio de Ciencia, Tecnología e Innovación. La convocatoria financia proyectos de Ciencia, Tecnología e Innovación orientados a la atención de desafíos en salud derivados del sismo del 10 de agosto de 2026 y prioriza los departamentos de Chocó, Valle del Cauca, Risaralda, Caldas y Quindío.

La información disponible del proyecto únicamente permite identificar que su ubicación de ejecución se asocia con Bolívar. [COMPLETAR: modalidad de participación del proyecto (1 o 2), línea temática seleccionada, descripción general, objetivo, población beneficiaria, actividades, resultados esperados, duración, presupuesto y monto de financiación solicitado].

### Problema y justificación

La convocatoria se creó para responder a los desafíos en salud derivados de la situación de desastre causada por el sismo del 10 de agosto de 2026, que generó afectaciones directas en 330 municipios de 16 departamentos, con impactos críticos en el sector salud. Minciencias señala que la convocatoria busca fortalecer capacidades científicas, tecnológicas e industriales en salud y promover soluciones innovadoras frente a necesidades derivadas del desastre.

En la información aportada del proyecto no se describe el problema específico que aborda ni la población afectada en Bolívar. [COMPLETAR: problema concreto que resuelve el proyecto, relación con el desastre, evidencia o contexto territorial específico, y justificación técnica de la intervención].

### Objetivos

Objetivo general de la convocatoria: promover la investigación, el desarrollo tecnológico y la innovación en salud como mecanismo de mitigación de las afectaciones derivadas del sismo, en los departamentos priorizados, y ampliar la disponibilidad de conocimientos, tecnologías y soluciones que contribuyan al bienestar de las poblaciones afectadas por la situación de desastre.

Objetivos específicos de la convocatoria:
- Fortalecer capacidades científicas y tecnológicas para la prevención, mitigación, respuesta y recuperación ante la emergencia.
- Promover generación de conocimiento aplicado y soluciones innovadoras para necesidades de atención en salud.
- Contribuir a la sostenibilidad y proyección de capacidades de investigación en salud generadas en los departamentos priorizados.
- Generar evidencias y herramientas tecnológicas para anticipar, prevenir y mitigar el impacto en salud de futuros desastres.

[COMPLETAR: objetivo general del proyecto, objetivos específicos del proyecto y su alineación con una línea temática de la convocatoria].

### Población beneficiaria

La convocatoria está orientada a poblaciones afectadas por la situación de desastre y a actores del territorio que fortalezcan capacidades de CTeI en salud. También contempla beneficios para personal de salud de primera respuesta, grupos en situación de vulnerabilidad emocional, comunidades en condición de vulnerabilidad y otros grupos impactados por el desastre, según la línea temática seleccionada.

En la información del proyecto no se indica quiénes serán los beneficiarios directos o indirectos. [COMPLETAR: población beneficiaria, número estimado de beneficiarios, criterios de selección y territorio específico de intervención].

### Metodología y actividades

La convocatoria financia macroproyectos y proyectos de CTeI en salud y exige que se enmarquen en una de las siguientes líneas temáticas: salud mental y rehabilitación; enfermedades transmisibles y brotes en contextos de desastre y albergues temporales; enfermedades no transmisibles y cáncer frente a situaciones de desastre; o salud ambiental frente al manejo de escombros y contaminación.

Además, la convocatoria admite dos modalidades: Modalidad 1, para macroproyectos departamentales con impacto en mínimo dos departamentos priorizados y duración máxima de 48 meses; y Modalidad 2, para proyectos territoriales con ejecución en un departamento priorizado y duración máxima de 24 meses. También establece que no se financia la prestación directa de servicios de salud, la vigilancia epidemiológica ni obras civiles, construcción, reforzamiento o mantenimiento de infraestructura.

No se aportó una metodología del proyecto ni actividades previstas. [COMPLETAR: enfoque metodológico, fases, actividades principales, entregables, articulación con aliados, modalidad elegida, línea temática y nivel de madurez tecnológica (TRL)].

### Resultados esperados

La convocatoria evalúa los resultados, productos y la replicabilidad del proyecto, incluyendo la calidad y verificabilidad de los productos, el modelo de sostenibilidad, el nivel TRL, la estrategia de réplica y el aporte futuro frente a desastres. También valora la cobertura territorial y las alianzas locales o la capacidad instalada.

En la información del proyecto no se describen resultados esperados. [COMPLETAR: productos concretos, resultados verificables, indicadores, nivel TRL de partida y de cierre, y alcance de replicabilidad o sostenibilidad].

### Presupuesto

La convocatoria dispone de un presupuesto total de $109.000.000.000 para financiar proyectos en las dos modalidades. El techo máximo por proyecto es de hasta $10.000.000.000 en la Modalidad 1 y hasta $5.900.000.000 en la Modalidad 2. La propuesta debe incluir una contrapartida mínima equivalente al 10% del valor total del proyecto, en dinero, en especie o en una combinación de ambas, salvo los centros autónomos reconocidos por el Ministerio, que están exceptuados de esta contrapartida.

No se informó el presupuesto estimado del proyecto ni el monto solicitado a Minciencias. [COMPLETAR: presupuesto total del proyecto, monto de financiación solicitado, contrapartida y desglose por rubros conforme al Anexo 5].

### Cronograma

La convocatoria abrió el 14 de septiembre de 2026 y cierra el 13 de octubre de 2026 a las 5:00 p. m. hora Colombia. La revisión de requisitos se realiza del 14 al 16 de octubre de 2026, la subsanación del 19 al 20 de octubre de 2026 hasta las 5:00 p. m., la publicación del banco preliminar de elegibles el 18 de noviembre de 2026 y la publicación del banco definitivo de elegibles y financiables el 30 de noviembre de 2026.

El proyecto no tiene duración informada. [COMPLETAR: cronograma interno del proyecto, duración en meses, hitos, fechas de inicio y cierre, y relación de actividades por periodo].

### Experiencia de la organización

La entidad proponente es Medición IA 1cf7f7. La convocatoria exige que la entidad ejecutora esté domiciliada en Colombia y que acredite experiencia previa demostrada según la modalidad: al menos un proyecto en los últimos cinco años por un valor igual o superior al 50% del valor solicitado, para la Modalidad 1; o al menos dos proyectos acumulados en los últimos cinco años por un valor igual o superior al 40% del valor solicitado, para la Modalidad 2.

En la información aportada no se incluye experiencia o trayectoria de la organización. [COMPLETAR: descripción de la trayectoria institucional, proyectos ejecutados, años de experiencia, evidencias de experiencia previa y soporte para el Anexo 7].

---

## Generación 8 · proyecto completo (100 %)

### Resumen ejecutivo

El proyecto Telemedicina para la atención de salud mental tras inundaciones 1cf7f7, presentado por Medición IA 1cf7f7, busca reducir la brecha de atención en salud mental de la población damnificada por las inundaciones de 2024 en La Mojana mediante un modelo de telepsicología con agentes comunitarios. La propuesta se enmarca en la línea temática de Salud mental y rehabilitación de la convocatoria y plantea el desarrollo e implementación de una plataforma de teleconsulta psicológica y seguimiento comunitario para municipios afectados por inundaciones en Sucre. El proyecto tiene una duración estimada de 18 meses, atiende a 3.000 personas damnificadas de cuatro municipios de La Mojana sucreña y solicita financiación por $850.000.000, con un presupuesto total estimado de $1.100.000.000. La propuesta incluye diagnóstico participativo, desarrollo de la plataforma, formación de 40 agentes comunitarios, un piloto de 9 meses y evaluación mediante escalas validadas. Como resultados esperados se plantea un modelo validado, un protocolo publicado y la transferencia a la ESE departamental.

### Problema y justificación

Tras las inundaciones de 2024 en La Mojana, la población afectada no tiene acceso a atención en salud mental. Según la información del proyecto, los centros de salud más cercanos están a más de dos horas y no cuentan con psicólogos, lo que limita de forma crítica la atención oportuna y continua para las personas damnificadas. Esta situación se relaciona de manera directa con la línea temática de Salud mental y rehabilitación de la convocatoria, la cual contempla proyectos orientados al desarrollo de modelos, tecnologías o estrategias de atención en salud mental y apoyo psicosocial para la población afectada por desastres y sus familias, con énfasis en la continuidad de la atención y la reducción de barreras de acceso en las zonas afectadas. La propuesta responde a esa necesidad mediante una plataforma de teleconsulta psicológica con funcionamiento en baja conectividad y el acompañamiento de agentes comunitarios, lo que permite ampliar la cobertura de atención en un contexto territorial con barreras de acceso y con afectaciones derivadas de una situación de desastre.

### Objetivos

Objetivo general: Reducir la brecha de atención en salud mental de la población damnificada mediante un modelo de telepsicología con agentes comunitarios.

Objetivos específicos:
- Formar 40 agentes comunitarios en primeros auxilios psicológicos.
- Implementar una plataforma de teleconsulta que funcione con baja conectividad.
- Evaluar el efecto del modelo en síntomas de ansiedad y depresión.

### Población beneficiaria

La población beneficiaria estimada corresponde a 3.000 personas damnificadas de cuatro municipios de La Mojana sucreña. La propuesta se focaliza en personas afectadas por las inundaciones de 2024 en el territorio de Sucre. [COMPLETAR: nombres de los cuatro municipios beneficiarios].

### Metodología y actividades

La metodología del proyecto contempla un enfoque aplicado, territorial y orientado a la implementación de una solución tecnológica para atención en salud mental. Las actividades principales reportadas son las siguientes:
- Diagnóstico participativo para identificar necesidades, barreras de acceso y condiciones territoriales de implementación.
- Desarrollo de la plataforma de teleconsulta, con capacidad de funcionamiento en baja conectividad.
- Formación de 40 agentes comunitarios en primeros auxilios psicológicos.
- Ejecución de un piloto durante 9 meses.
- Evaluación del efecto del modelo mediante escalas validadas para síntomas de ansiedad y depresión.

La propuesta se articula con el objetivo de generar una solución innovadora para atención en salud mental en contexto de desastre. [COMPLETAR: detalle metodológico de la plataforma, ruta de atención, criterios de selección de participantes, equipo responsable y aliados institucionales, si aplica].

### Resultados esperados

Los resultados esperados informados por la propuesta son: un modelo validado, un protocolo publicado y la transferencia a la ESE departamental. Adicionalmente, la ejecución del proyecto debería permitir contar con una plataforma de teleconsulta funcional en baja conectividad, 40 agentes comunitarios formados en primeros auxilios psicológicos y evidencia sobre el efecto del modelo en síntomas de ansiedad y depresión. [COMPLETAR: indicadores o metas verificables asociadas a cada resultado].

### Presupuesto

El proyecto solicita una financiación de $850.000.000 y reporta un presupuesto total estimado de $1.100.000.000. De acuerdo con la convocatoria, la contrapartida mínima exigida corresponde al 10% del presupuesto total, en dinero, en especie o en combinación de ambas; con la información suministrada no es posible discriminar cómo se compone dicha contrapartida. [COMPLETAR: detalle presupuestal por rubros, fuente y forma de contrapartida, y coherencia con el Anexo 5 de la convocatoria].

### Cronograma

La duración estimada del proyecto es de 18 meses. Las actividades reportadas incluyen un diagnóstico participativo, el desarrollo de la plataforma, la formación de agentes comunitarios, un piloto de 9 meses y una evaluación con escalas validadas. La convocatoria tiene como fecha de cierre el 13 de octubre de 2026 a las 5:00 p. m., hora Colombia. [COMPLETAR: cronograma mensual o por hitos del proyecto, con fechas y responsables].

### Experiencia de la organización

Medición IA 1cf7f7 reporta como antecedente que desarrolló en 2022 una aplicación de citas médicas para dos IPS de Sincelejo. La convocatoria exige acreditar experiencia previa demostrada conforme al Anexo 7 y, para la modalidad aplicable, soportar al menos los proyectos y valores requeridos por los términos de referencia. Con la información entregada no es posible verificar si este antecedente cumple los criterios exigidos para habilitación. [COMPLETAR: soportes de experiencia, valor del proyecto de 2022 y evidencia de cumplimiento de experiencia mínima exigida por la convocatoria].

---

## Generación 9 · proyecto a medias (33 %)

### Resumen ejecutivo

El proyecto Monitoreo de calidad del agua en zonas inundadas 1cf7f7, presentado por Medición IA 1cf7f7, busca desarrollar sensores de bajo costo para vigilar la calidad del agua de consumo en comunidades rurales tras una emergencia. La propuesta se orienta a responder al problema de incremento de enfermedades diarreicas después de las inundaciones por consumo de agua contaminada. El objetivo general es detectar a tiempo la contaminación del agua de consumo en veredas afectadas. La duración estimada del proyecto es de 12 meses.

La iniciativa se enmarca en la Convocatoria de CTeI para la Atención de Desafíos en Salud Derivados de la Situación de Desastre, de Minciencias, específicamente en la línea temática 4. Salud ambiental frente al manejo de escombros y contaminación, por su relación con la contaminación de fuentes hídricas derivada de la situación de desastre. La postulación deberá estructurarse y completarse conforme a los requisitos de la convocatoria y a los anexos aplicables.

### Problema y justificación

Después de las inundaciones aumentan las enfermedades diarreicas por consumo de agua contaminada. Este problema afecta la salud de comunidades rurales y requiere soluciones tecnológicas que permitan identificar oportunamente riesgos en el agua destinada al consumo.

La convocatoria busca promover investigación, desarrollo tecnológico e innovación en salud para mitigar afectaciones derivadas de una situación de desastre. En ese marco, el proyecto se justifica por su enfoque en la vigilancia de la calidad del agua de consumo en veredas afectadas, lo cual se relaciona con la línea temática de salud ambiental frente al manejo de escombros y contaminación, en particular por la contaminación de fuentes hídricas. La propuesta plantea una respuesta tecnológica de bajo costo para apoyar la detección temprana de contaminación, lo que puede contribuir a la prevención de enfermedades asociadas al consumo de agua no segura.

[COMPLETAR: descripción del contexto territorial específico en Córdoba y evidencia del impacto en las veredas afectadas].

### Objetivos

Objetivo general:
- Detectar a tiempo la contaminación del agua de consumo en veredas afectadas.

Objetivos específicos:
- [COMPLETAR: objetivos específicos del proyecto].

El objetivo general es coherente con la necesidad de anticipar riesgos en salud asociados al consumo de agua contaminada en escenarios posteriores a inundaciones.

### Población beneficiaria

La población beneficiaria corresponde a comunidades rurales y veredas afectadas por inundaciones en Córdoba, especialmente aquellas expuestas al consumo de agua potencialmente contaminada.

[COMPLETAR: número de beneficiarios directos].
[COMPLETAR: número de beneficiarios indirectos].
[COMPLETAR: caracterización de la población beneficiaria y veredas o municipios específicos de intervención].

### Metodología y actividades

La propuesta consiste en el desarrollo de sensores de bajo costo para vigilar la calidad del agua de consumo en comunidades rurales tras una emergencia. Con la información disponible no es posible detallar una metodología completa; por tanto, se deja constancia de los componentes que deberán completarse para la versión final del proyecto.

Actividades principales:
- [COMPLETAR: actividades de diseño, desarrollo y validación de los sensores].
- [COMPLETAR: actividades de instalación, pruebas o despliegue en territorio].
- [COMPLETAR: actividades de recolección, análisis e interpretación de datos].
- [COMPLETAR: actividades de articulación con actores locales o aliados, si aplica].
- [COMPLETAR: actividades de capacitación, transferencia o apropiación social del conocimiento].

[COMPLETAR: metodología detallada, incluyendo fases, responsables, instrumentos y criterios de validación].

### Resultados esperados

Con la información entregada no se especifican resultados esperados; por tanto, deben completarse para la postulación final.

[COMPLETAR: resultados esperados del proyecto].
[COMPLETAR: productos verificables esperados].
[COMPLETAR: indicadores de resultado y medios de verificación].

El proyecto debe dejar claramente identificado cómo los sensores de bajo costo contribuirán a la detección temprana de la contaminación del agua de consumo en las veredas afectadas.

### Presupuesto

Monto de financiación que busca: [COMPLETAR: monto de financiación solicitado].
Presupuesto estimado total: [COMPLETAR: presupuesto total del proyecto].

La convocatoria exige un presupuesto detallado según los rubros del Anexo 5 y una contrapartida mínima del 10% del valor total del proyecto, en dinero, especie o combinación de ambas. Con la información disponible no se puede verificar el cumplimiento de este requisito.

[COMPLETAR: desglose presupuestal por rubros, fuente de recursos y contrapartida].

### Cronograma

Duración del proyecto: 12 meses.

La convocatoria permite, para proyectos territoriales, una duración máxima de hasta 24 meses; por tanto, la duración propuesta de 12 meses se encuentra dentro del rango permitido. Sin embargo, el cronograma detallado no fue aportado.

[COMPLETAR: cronograma mensual o por hitos, con actividades, responsables y productos asociados].

### Experiencia de la organización

Empresa u organización: Medición IA 1cf7f7.

La convocatoria exige acreditar experiencia previa demostrada mediante soportes conforme al Anexo 7. También exige que la entidad ejecutora esté domiciliada en Colombia y, para la Modalidad 2, que esté domiciliada en un departamento priorizado donde se ubique la entidad ejecutora. Con la información entregada solo se conoce que el municipio o detalle de ubicación es Córdoba, pero no se aporta el departamento, ni la trayectoria de la organización, ni los soportes de experiencia requeridos.

[COMPLETAR: departamento de domicilio de la entidad ejecutora].
[COMPLETAR: experiencia previa demostrada conforme al Anexo 7].
[COMPLETAR: trayectoria institucional, proyectos ejecutados, fechas, valores y resultados].
[COMPLETAR: evidencia de cumplimiento de los requisitos habilitantes relacionados con experiencia, aval institucional, comité de ética y permisos ambientales].

---

## Generación 10 · proyecto casi vacío (0 %)

### Resumen ejecutivo

El proyecto de salud rural 1cf7f7, presentado por Medición IA 1cf7f7, se postula a la convocatoria CTeI para la Atención de Desafíos en Salud Derivados de la Situación de Desastre (Conv. 1) de Minciencias. La propuesta se ubica en Bolívar y se enmarca en la convocatoria orientada a financiar proyectos de Ciencia, Tecnología e Innovación en salud para atender desafíos derivados del sismo del 10 de agosto de 2026. Dado que no se cuenta con información sobre la descripción técnica del proyecto, la línea temática, la modalidad, el alcance territorial, el objetivo, la población o los componentes metodológicos, estos aspectos quedan pendientes de completar para consolidar la versión final de postulación.

[COMPLETAR: descripción del proyecto y su enfoque técnico]. [COMPLETAR: modalidad de postulación]. [COMPLETAR: línea temática].

### Problema y justificación

La convocatoria de Minciencias fue creada para responder a afectaciones en salud derivadas de la situación de desastre ocasionada por el sismo del 10 de agosto de 2026, que impactó 16 departamentos y prioriza Chocó, Valle del Cauca, Risaralda, Caldas y Quindío. La justificación general de la convocatoria se orienta a fortalecer capacidades científicas, tecnológicas y de innovación en salud, así como a generar conocimiento, tecnologías y soluciones que contribuyan al bienestar de la población afectada.

Para el proyecto de salud rural 1cf7f7 no se aportó el problema específico que busca resolver, ni evidencia sobre la afectación particular en Bolívar o en el territorio donde se ejecutará. Por tanto, la formulación del problema debe incorporarse antes de la radicación para demostrar pertinencia frente a la convocatoria y coherencia con la línea temática seleccionada.

[COMPLETAR: problema específico que resuelve el proyecto]. [COMPLETAR: justificación territorial y evidencia de afectación en Bolívar]. [COMPLETAR: alineación con la línea temática de la convocatoria].

### Objetivos

El objetivo general de la convocatoria es promover la investigación, el desarrollo tecnológico y la innovación en salud como mecanismo de mitigación de las afectaciones derivadas del sismo, en los departamentos priorizados, y ampliar la disponibilidad de conocimientos, tecnologías y soluciones que contribuyan al bienestar de las poblaciones afectadas por la situación de desastre.

No se recibió información sobre el objetivo general ni los objetivos específicos del proyecto de salud rural 1cf7f7. En consecuencia, se deja constancia de que estos deben formularse de manera clara, medible y coherente con la modalidad y la línea temática escogidas.

[COMPLETAR: objetivo general del proyecto].
1. [COMPLETAR: objetivo específico 1].
2. [COMPLETAR: objetivo específico 2].
3. [COMPLETAR: objetivo específico 3].

### Población beneficiaria

La información entregada no identifica la población beneficiaria del proyecto. La convocatoria está dirigida a atender desafíos en salud derivados de la situación de desastre y prioriza poblaciones afectadas en los territorios definidos por Minciencias. Sin embargo, para esta postulación se requiere precisar cuál será la población objetivo concreta del proyecto, su ubicación y sus características.

[COMPLETAR: población beneficiaria directa]. [COMPLETAR: población beneficiaria indirecta, si aplica]. [COMPLETAR: número de beneficiarios]. [COMPLETAR: características de la población y criterios de focalización].

### Metodología y actividades

La convocatoria acepta proyectos de CTeI en salud y exige coherencia entre objetivos, cronograma, resultados, enfoque territorial y productos esperados. También indica que no se financia la prestación directa de servicios de salud, vigilancia epidemiológica, ni obras civiles, construcción, reforzamiento o mantenimiento de infraestructura.

No se aportó información sobre la metodología del proyecto de salud rural 1cf7f7, las actividades principales, los hitos ni el equipo de trabajo. Para completar esta sección, se debe describir cómo se desarrollará el proyecto, qué actividades se ejecutarán, con qué secuencia y cómo se articularán con la modalidad seleccionada.

[COMPLETAR: metodología general del proyecto].
1. [COMPLETAR: actividad principal 1].
2. [COMPLETAR: actividad principal 2].
3. [COMPLETAR: actividad principal 3].
4. [COMPLETAR: hitos o fases de ejecución].

### Resultados esperados

La convocatoria evalúa los resultados, productos y replicabilidad, incluyendo la calidad y verificabilidad de los productos, el modelo de sostenibilidad, el nivel TRL y la estrategia de réplica, así como el aporte futuro frente a desastres. No obstante, no se recibió información sobre los resultados esperados del proyecto.

[COMPLETAR: resultados esperados del proyecto]. [COMPLETAR: productos o entregables verificables]. [COMPLETAR: nivel TRL del proyecto]. [COMPLETAR: estrategia de sostenibilidad y replicabilidad].

### Presupuesto

La convocatoria dispone de recursos hasta por $109.000.000.000 y define topes máximos por modalidad: hasta $10.000.000.000 para la Modalidad 1 y hasta $5.900.000.000 para la Modalidad 2. Además, exige contrapartida mínima del 10% del presupuesto total, en dinero, en especie o en combinación de ambas, y un presupuesto detallado según los rubros del Anexo 5.

No se entregó el monto solicitado por el proyecto, el presupuesto estimado total ni la distribución por rubros. Por tanto, esta sección debe completarse con la información financiera correspondiente antes de la postulación.

[COMPLETAR: monto de financiación solicitado]. [COMPLETAR: presupuesto estimado total]. [COMPLETAR: distribución presupuestal por rubros del Anexo 5]. [COMPLETAR: fuente y valor de la contrapartida mínima del 10%].

### Cronograma

La convocatoria establece que el cierre es el 13 de octubre de 2026 a las 5:00 p. m. hora Colombia, con revisión de requisitos entre el 14 y el 16 de octubre de 2026, subsanación entre el 19 y el 20 de octubre de 2026, publicación del banco preliminar el 18 de noviembre de 2026 y publicación del banco definitivo de elegibles y financiables el 30 de noviembre de 2026. La duración máxima permitida por modalidad es de 48 meses para la Modalidad 1 y 24 meses para la Modalidad 2.

El proyecto de salud rural 1cf7f7 no tiene duración definida en la información aportada ni un cronograma de actividades. En consecuencia, se requiere estructurar el plan de trabajo en coherencia con la duración máxima aplicable según la modalidad seleccionada.

[COMPLETAR: duración total del proyecto en meses].
1. [COMPLETAR: actividad o fase 1 con fecha de inicio y fin].
2. [COMPLETAR: actividad o fase 2 con fecha de inicio y fin].
3. [COMPLETAR: actividad o fase 3 con fecha de inicio y fin].
4. [COMPLETAR: hitos de seguimiento y entrega de productos].

### Experiencia de la organización

La organización proponente es Medición IA 1cf7f7. La convocatoria exige acreditar experiencia previa demostrada y adjuntar la acreditación correspondiente mediante el Anexo 7. Para la Modalidad 1 se requiere al menos un proyecto ejecutado en los últimos cinco años por un valor igual o superior al 50% del valor solicitado a Minciencias; para la Modalidad 2, al menos dos proyectos en los últimos cinco años que acumulados asciendan a por lo menos el 40% del valor solicitado.

No se recibió información sobre la trayectoria, proyectos previos, reconocimientos o capacidad instalada de la organización. En consecuencia, esta sección debe completarse con soportes verificables que permitan acreditar el requisito de experiencia según la modalidad escogida.

[COMPLETAR: experiencia o trayectoria de Medición IA 1cf7f7]. [COMPLETAR: proyectos previos que acreditan la experiencia requerida]. [COMPLETAR: valor de los proyectos previos y correspondencia con el requisito de experiencia]. [COMPLETAR: evidencia de domicilio en Colombia y, si aplica, en departamento priorizado].

