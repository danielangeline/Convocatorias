# Handoff: Rediseño FundRadar (toda la aplicación)

## Resumen
Rediseño completo de la app **Convocatorias**, que pasa a llamarse **FundRadar**, en el repo `danielangeline/Convocatorias` (Next.js App Router + Tailwind v4 + lucide-react + Supabase). Cubre los 4 frentes:
- **Identidad**: `app/(identidad)/*` (login, registro, recuperar, MFA)
- **Portal empresa**: `app/(portal)/*`
- **Portal consultor**: `app/consultor/*`
- **Panel admin**: `app/admin/*`

Objetivos: lenguaje visual editorial (FundScout), navegación más corta, una acción clara por pantalla, **móvil de primera clase** y modo oscuro.

## Sobre los archivos de diseño
Los `.dc.html` de esta carpeta son **referencias de diseño hechas en HTML**: prototipos que muestran el aspecto y el comportamiento esperados. **No son código de producción para copiar.** La tarea es recrearlos en el código existente (Next.js, Tailwind, componentes de `components/ui`, `components/shell`, `components/viz`), con sus patrones y sus datos reales (Supabase, `lib/*`). Ábrelos en el navegador para ver el comportamiento; los datos que muestran son de ejemplo.

## Fidelidad
**Alta fidelidad.** Los colores, la tipografía, los radios, los espaciados y los textos son definitivos. La lógica de negocio, los RF/RN y los datos **no cambian**: solo la presentación, la navegación y la jerarquía.

---

## Tokens de diseño (reemplazan los de `app/globals.css`)

### Colores, modo claro (`:root`)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F4F1EA` | Fondo de página (hueso) |
| `--surface` | `#FFFFFF` | Tarjetas, sidebar, inputs |
| `--surface-2` | `#F8F6F1` | Cabeceras de tabla, cajas secundarias |
| `--line` | `#DAD6CC` | Bordes de tarjeta |
| `--line-2` | `#E9E6DF` | Separadores internos, fondo de barras de progreso |
| `--line-strong` | `#8A949A` | Borde de inputs y botones secundarios |
| `--ink` | `#0A1A22` | Texto principal |
| `--ink-2` | `#2B3A42` | Texto secundario |
| `--ink-3` | `#5A666C` | Etiquetas, metadatos |
| `--pri` | `#0F4C5C` | Teal petróleo: marca y acciones |
| `--pri-hover` | `#0A3A47` | Hover del primario |
| `--pri-soft` | `#E3EEF0` | Ítem activo, chips, bandas suaves |
| `--pri-text` | `#0F4C5C` | Enlaces y texto tonal |
| `--on-pri` | `#FFFFFF` | Texto sobre primario |
| `--amber` | `#F2A93B` | **Solo el "ping"**: punto de nuevo, badge NUEVO, contadores del menú |
| `--amber-soft` | `#FBEBD0` | Fondo de cierre en 10 a 14 días |
| `--rose` | `#A63D2A` | Urgente (cierre en menos de 10 días), errores |
| `--rose-soft` | `#F6E3DE` | Fondo urgente |
| `--topbar` | `rgba(244,241,234,.88)` + `backdrop-filter: blur(10px)` | Barra superior |
| `--overlay` | `rgba(10,26,34,.45)` | Fondo de modales y drawers |
| `--shadow` | `0 20px 50px rgba(10,26,34,.12)` | Solo en modales, drawers y popovers |

### Colores, modo oscuro (`.dark`)
`--bg #0A1519` · `--surface #10212A` · `--surface-2 #142931` · `--line #20363F` · `--line-2 #1A2E36` · `--line-strong #4A6069` · `--ink #EEF1EE` · `--ink-2 #BFCBCF` · `--ink-3 #8A9AA0` · `--pri #5DB0C2` · `--pri-hover #7CC3D2` · `--pri-soft #123843` · `--pri-text #8FD3E0` · `--on-pri #06161B` · `--amber-soft #3A2C14` · `--rose #F09A86` · `--rose-soft #3A1E19` · `--topbar rgba(10,21,25,.88)` · `--overlay rgba(0,0,0,.6)` · `--shadow 0 20px 50px rgba(0,0,0,.5)`.

Se eliminan `--violet` y `--sky` como acentos de UI. La IA y el consultor ya no tienen color propio: usan el teal. Así queda **un solo acento**.

### Reglas de color
- El ámbar **nunca** se usa como texto sobre fondo claro. Sobre ámbar el texto siempre es `#0A1A22`, también en modo oscuro.
- Plazos (`DeadlineTile`, `DeadlineChip`): menos de 10 días → `rose-soft`/`rose`; 10 a 14 → `amber-soft`/`ink`; 15 o más → `surface-2`/`ink-2`.
- Anillo de compatibilidad: 80 o más → `--pri`; menos de 80 → `#F2A93B`; pista → `--line-2`.
- Profundidad por **bordes y bandas**, no por sombras. Las tarjetas no llevan sombra.

### Tipografía (next/font/google)
- **Source Serif 4** (500, 600): `h1`, `h2`, títulos de tarjeta y nombres de convocatoria, proyecto o consultor. Clase `font-display`.
- **Inter** (400, 500, 600, 700): todo el texto de interfaz. Clase `font-sans`. Sustituye a Plus Jakarta.
- **IBM Plex Mono** (500): montos, fechas, contadores, porcentajes, créditos. Clase `font-tabular`, que ya existe.

| Rol | Fuente | Tamaño / peso / interlineado |
|---|---|---|
| H1 de página | Serif | 32px / 600 / 1.1, tracking -0.01em (30px en admin y detalle) |
| H2 de tarjeta | Serif | 20px / 600 |
| Nombre en lista | Serif | 18px / 600 / 1.3 (kanban 15.5px, filas móviles 17px) |
| Eyebrow | Inter | 12px / 600, uppercase, tracking .08em, color `--pri-text` |
| Cuerpo | Inter | 15px / 1.55, `--ink-2`, `text-wrap: pretty` |
| UI base | Inter | 14px |
| Metadatos | Inter | 12.5px, `--ink-3` |
| Cifra KPI | Mono | 28px / 500 |
| Grupo del menú | Inter | 11px / 600, uppercase, tracking .08em, `--ink-3` |

### Radios, alturas y espaciado
- Radio: **4px** para botones, inputs, filas y badges (3px en badges pequeños). **6px** para tarjetas grandes y paneles. **999px** solo para chips de filtro. **12px** arriba en bottom sheets.
- Alturas mínimas: botón **44px** (CTA principal de formulario 48px) · input 46 a 48px · ítem del sidebar 40px · fila de checklist 52px · tab inferior 58px.
- Padding de tarjeta 20 a 22px. Gap entre tarjetas 14 a 16px. Gap vertical de página 24px.
- Contenido: `max-width: 1200px` (consultor 1120, admin 1240). Padding `28px 28px 56px` en escritorio y `20px 16px 32px` en móvil.

### Botones (`components/ui/Button.tsx`)
- `primary`: `bg-pri text-on-pri hover:bg-pri-hover`, radio 4, 14px/600.
- `secondary`: `bg-surface border border-line-strong text-ink hover:bg-surface-2`.
- `outline`, nueva variante: `bg-surface border border-pri text-pri-text hover:bg-pri-soft`. Se usa en "Ver detalle", "Abrir", "Ver sugeridas".
- `ghost`: igual que hoy. `danger`: texto `rose` sin fondo.
- Variantes `ai` y `consultor`: se **eliminan**. Sus usos pasan a `outline` o `primary`.
- Todos llevan `whitespace-nowrap` y `min-h-11`.

### Marca
Logo: SVG de 34×34 con dos anillos concéntricos en `--pri` (r=15 y r=9 con opacidad 0.5, trazo de 2) y un punto central `#F2A93B` (r=4). Al lado, "Fund" en `--ink` y "Radar" en `--pri-text`, en Source Serif 4 600 de 22px. Debajo, el nombre del portal en 12px `--ink-3`. Hay que actualizar `components/shell/Logo.tsx`.

"Ping": punto ámbar con un anillo que se expande (`@keyframes ping { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(3);opacity:0} }`, 2.2s ease-out infinito). Se desactiva con `prefers-reduced-motion`. Marca lo nuevo: campana, "Tu próximo paso" y "3 nuevas esta semana".

---

## Shell (`components/shell/*`)

### Escritorio (≥ 1024px)
- **Sidebar** de 252px, `bg-surface`, `border-r`, sticky a pantalla completa. Logo arriba con padding `20px 20px 14px`. Grupos con título en mayúsculas. Ítem de 40px con radio 4; activo: `bg-pri-soft text-pri-text font-semibold`. Contador en badge ámbar mono de 11px. Pie: tarjeta de créditos ("Créditos de IA · 340 / 500", barra de 5px y el texto **"Te alcanzan para N documentos"**) y fila de usuario con iniciales, nombre de la empresa, persona y botón de salir.
- Se **quita** el modo contraído del sidebar y el colapso por grupos: el menú nuevo es corto.
- **Topbar** de 60px, sticky, `--topbar` con desenfoque. Contiene la miga (grupo / pantalla), la búsqueda de 280px con ⌘K, el cambio de tema y la campana con ping. La campana abre un popover de 360px con avisos (punto ámbar, título de 13.5px/600 y metadatos de 12.5px).

### Móvil (< 1024px), el cambio principal
- Sin sidebar. La topbar muestra el logo compacto de 26px, el tema y la campana.
- **Barra de pestañas inferior** fija (`position: sticky; bottom:0`), en 5 columnas: **Inicio · Buscar · Postular · Proyectos · Más**. Cada pestaña lleva un icono de 21px y una etiqueta de 11px; la activa va en `--pri-text` con una barra superior de 2px en `--pri`.
- **"Más"** abre un *bottom sheet* con: Documentos con IA, Directorio de consultores, Mis encargos, Plan y créditos y Ajustes. Filas de 52px con chevron.
- El panel admin, que tiene muchas secciones, usa en móvil un **drawer lateral** con hamburguesa en lugar de pestañas.
- Las tablas del admin pasan en móvil a **tarjetas** (primera columna como título y el resto como pares "etiqueta: valor").

### Menú nuevo, empresa (`menus.ts`)
```
(sin título)   Inicio
Descubrir      Convocatorias [badge: nuevas]
Mi trabajo     Proyectos · Postulaciones [badge: listas para radicar] · Documentos con IA
Consultores    Directorio · Mis encargos
Cuenta         Plan y créditos · Ajustes
```
"Sugeridas para ti", "Beneficios tributarios" y "Guardadas" **salen del menú**. Pasan a ser pestañas y chips dentro de Convocatorias. Hay que conservar las rutas (`/sugeridas`, `/guardadas`) como redirecciones a `/convocatorias?tab=sugeridas|guardadas` y `?tipo=beneficio_tributario`.

Consultor: Mi perfil · Encargos [badge] · Documentos · Mi suscripción. En móvil son 4 pestañas.
Admin: los mismos grupos de `menus-admin.ts`, con badges en Fuentes (fallas), Perfiles en revisión y Solicitudes al equipo.

---

## Pantallas

### Identidad, `FundRadar Acceso.dc.html`
Pantalla partida con `flex-wrap` (cada mitad `flex: 1 1 460px`; en móvil se apilan):
- **Izquierda**, banda oscura `#0A1A22`: logo con anillos `#7CC3D2`, eyebrow ámbar con ping ("N convocatorias nuevas hoy"), titular serif de 40px *"¿A qué financiación puede postular su organización hoy?"*, texto en `#C9D3DD` y 3 cifras mono ámbar de 24px (vigentes, monto disponible y entidades). Las cifras salen de los mismos datos que la landing (RF-44).
- **Derecha**: formulario de 420px como máximo.
  - **Login**: correo, contraseña con "¿La olvidó?" en línea, botón "Entrar" de 48px, "¿Aún no tiene cuenta? Cree una gratis" y un enlace a la verificación en dos pasos para administradores.
  - **Registro**: selector de puerta en 2 tarjetas radio (borde de 2px en `--pri` y fondo `pri-soft` cuando está activa) con los textos de `DETALLE`. Debajo: nombre, organización (solo empresa), correo, contraseña ("Mínimo 8 caracteres."), consentimiento con la Ley 1581 (casilla propia de 22px, **desmarcada por defecto**; el botón queda al 50 % de opacidad hasta marcarla) y el CTA "Crear cuenta y empezar la prueba" o "Crear cuenta de consultor". Para empresa se añade "Prueba gratuita de 7 días. Sin tarjeta de crédito."
  - **Revise su correo**: icono en un círculo `pri-soft` de 56px, el correo en negrita y la opción de reenviar.
  - **Recuperar**: volver, correo y "Enviar enlace".
  - **MFA**: icono de escudo, **6 casillas de dígitos** de 56px de alto en mono de 24px (borde `--pri` en la casilla actual) y "Verificar y continuar". Se mantiene toda la lógica de `FormularioMfa.tsx`, incluido el QR al enrolar.
- Pie: Términos y Tratamiento de datos.
- Tratamiento de **usted** en Identidad, como en la landing. Dentro de los portales se mantiene el **tú**.

### Empresa · Inicio
1. Cabecera: eyebrow con la fecha, H1 "Buenas tardes, {nombre}", una línea de resumen (la lógica `resumen` actual) y las acciones *Nuevo proyecto* (secundario) y *Explorar convocatorias →* (primario).
2. **Tarjeta "Tu próximo paso"**, el elemento nuevo más importante. Fondo `pri-soft` y radio 6. Muestra **una sola** acción, calculada así: la postulación activa con el cierre más cercano y requisitos pendientes → *"Completa la postulación a {convocatoria}"*, *"Te faltan N de M requisitos: a, b y c."*, una barra de progreso y los botones *Continuar postulación* y *Ver la convocatoria*. A la derecha, una caja con el número de días en mono de 44px (en `--rose` si faltan menos de 10) y la fecha. Si no hay postulaciones: "Registra tu primer proyecto" o "Revisa tus N sugeridas".
3. **Franja de 4 KPI** en una sola tarjeta con divisores (`grid auto-fit minmax(200px,1fr)`), cada celda clicable: Compatibles contigo · Postulaciones activas · Monto en juego · Créditos de IA ("Te alcanzan para N documentos").
4. Dos columnas (`minmax(min(100%,420px),1fr)`): **Próximos cierres** (caja de días de 48px, nombre, entidad · monto y porcentaje) y **Mis postulaciones** (nombre, etapa, barra y "6/9 · 8 días").
5. La gráfica de fondos por mes (`StackedBarChart`) **sale de Inicio**: le restaba claridad. Si se quiere conservar, puede ir a Plan o a un informe aparte.

### Empresa · Convocatorias (`CatalogoEmpresa.tsx`)
- H1 y descripción con la hora del último rastreo.
- **Pestañas** subrayadas con contador mono: *Todas · Sugeridas para ti · Guardadas*.
- Buscador de 48px con borde `line-strong` y el botón **Filtros** con un contador de filtros activos.
- **Chips rápidos** con scroll horizontal: *Para mi perfil* (activo por defecto, compatibilidad ≥ 60) · *Cierran en 15 días* · *No reembolsable* · *Crédito* · *Beneficio tributario* · *Cooperación*. Activo: `bg-pri text-on-pri`.
- Línea de resultados: "**N convocatorias** coinciden" y, a la derecha, ping + "3 nuevas esta semana".
- **Fila de resultado**: entidad · tipo y el badge NUEVO en ámbar; nombre en serif de 18px; bloques con etiqueta pequeña: *Monto* (mono), *Cierre* (chip de plazo), *Te aplica* (porcentaje en `--pri-text`); botón de guardar con icono de 44px (marcador relleno si está guardada) y *Ver detalle* (outline). La fila usa `flex-wrap` y se apila sola en móvil.
- En la pestaña *Sugeridas*, rejilla de tarjetas (`minmax(min(100%,320px),1fr)`) con anillo de 48px, tipo, nombre, entidad, "Para tu proyecto **X**", monto y plazo.
- **Estado vacío**: borde discontinuo, "No encontramos convocatorias con esos filtros" y *Limpiar filtros*.
- **Drawer de filtros**: a la derecha con 420px en escritorio y como bottom sheet (86 % de alto, radio superior de 12) en móvil. Arriba un aviso en `pri-soft`: *"Ya filtramos por tu perfil: empresa del sector agro en Huila. Ajusta solo si buscas algo distinto."* Los grupos de `FiltroGrupo` pasan de casillas a **botones de opción** de 38px (activo: `pri-soft` con borde `pri`). El monto se pide como **"Cuánto necesitas"**, en un solo campo mono, en lugar de los dos campos de mínimo y máximo. Pie fijo: *Limpiar* y **"Ver N convocatorias"**, con el recuento en vivo.

### Empresa · Ficha de convocatoria (`FichaConvocatoria.tsx`)
- "← Convocatorias", etiquetas (tipo, origen y Nuevo), H1 serif, entidad y "Ver en el portal oficial ↗".
- **Rejilla de 4 datos** en una tarjeta con divisores: Monto · Cierre (fecha y chip de días) · Pueden postularse · Cobertura.
- Columna izquierda (`flex: 1 1 520px`):
  - **"¿Te aplica?"**: anillo de 72px, *"Comparada con tu proyecto X"* y una lista de criterios del cruce con icono redondo de 24px (✓ en `pri-soft` o ! en `rose-soft`), nombre, valor del proyecto y resultado ("Coincide", "Dentro del rango" o "Máximo 24 meses"). Sale de `CompatBreakdown` con los criterios reales.
  - *De qué se trata* (máximo 68ch) · *Requisitos* con número mono "01, 02…" · *Documentos de la convocatoria* (filas de 48px con icono, nombre y tamaño).
- Columna derecha, sticky a 80px (`flex: 1 1 300px`): tarjeta "**¿Te interesa?**" con borde superior de 3px en `pri`, el texto *"Abrimos tu expediente con los N requisitos como lista de tareas y te avisamos antes del cierre."*, **Me interesa** (48px, inicia la postulación con la acción actual) y *Guardar*. Debajo, una tarjeta con dos filas de acción: *Escribir el borrador con IA · Usa 100 de tus 340 créditos* y *Pedir ayuda a un consultor · N expertos en {entidad}*. Al final: "Fuente: portal de X · verificada hoy".
- **Móvil**: barra fija sobre las pestañas con guardar (48px) y **Me interesa**, a todo el ancho.

### Empresa · Proyectos (`ListadoProyectos.tsx`)
- Rejilla de tarjetas: nombre en serif, "tipo · sector · departamento", barra de **información del proyecto** (porcentaje de completitud de `CompletitudProyecto`; ámbar si es menor de 70) y **un consejo concreto** de lo que falta ("Agrega el presupuesto estimado para afinar el cruce."). Cifras: compatibles y postulaciones. Botones: *Ver sugeridas* (outline) y *Editar*.
- **Nuevo proyecto** abre un modal de 520px con 2 opciones grandes: **"Cuéntalo con tus palabras"** (IA, dictado o texto; "Usa 20 créditos"; opción destacada con borde de 2px en `pri`) o **"Llenar el formulario"** ("Unos 5 minutos").

### Empresa · Postulaciones (`TableroPostulaciones.tsx`)
- Selector Tablero/Lista (segmentado con fondo `surface-2`), solo en escritorio.
- **Tablero**: 4 columnas de 220px como mínimo, con fondo `surface-2` y radio 6. Títulos: *En preparación · Reuniendo documentos · Lista para radicar · Radicada*. Cada tarjeta muestra entidad, nombre en serif de 15.5px, proyecto, barra de 4px con "hechos/total", una nota ("8 días para el cierre" o "Radicada hace 6 días") y el avatar del consultor si lo hay. Columna vacía: "Nada en esta etapa."
- **Móvil**: chips de etapa ("Documentos · 1") y lista de tarjetas de la etapa elegida.

### Empresa · Detalle de postulación (`DetallePostulacion.tsx`)
- "← Postulaciones", línea "entidad · Proyecto: X" y H1.
- **Stepper horizontal** de 4 etapas: círculos de 28px (hecha: relleno `pri` con ✓; actual: borde `pri` con el número en `pri-text`; futura: borde `line`), conectores de 2px y la etiqueta de la etapa actual en negrita. Se calcula con `etapaDe()`.
- **Requisitos** como checklist **interactivo**: filas de 52px con una casilla de 24px. Al marcar, el texto se tacha y pasa a `ink-3`. Los pendientes muestran "Adjuntar". Encima, el contador "6 de 9" y una barra de 6px. Marcar un requisito actualiza el stepper.
- Lateral:
  - **"Siguiente paso"** en `pri-soft`. Si está incompleta: "Te faltan N requisitos" y la lista. Si está completa: "Ya puedes radicar", *Ir al portal oficial* y *Marcar como radicada*.
  - Tarjeta del documento con IA ("Documento de propuesta · v2 · Borrador con IA · 2 apartados por revisar").
  - Tarjeta del consultor ("Andrés Rojas te acompaña").
  - **Historial** con fecha mono y evento.

### Empresa · Documentos con IA
Banda informativa en una línea: *"Cada documento usa 100 créditos y cada ajuste, 10. Te quedan 340: alcanzan para 3 documentos. · Conseguir más"*. Lista de filas con estado (Borrador en `amber-soft` o Listo en `pri-soft`), versión y fecha en mono, proyecto en serif, convocatoria, pendientes y *Abrir*.

### Empresa · Directorio de consultores
Chips de especialidad. Tarjetas con avatar de 48px en `pri` con iniciales, nombre en serif, ciudad, "★ 4,9" en mono, "32 encargos", bio, etiquetas `pri-soft` y los botones **Solicitar** y *Ver perfil*.

### Empresa · Mis encargos
Filas con avatar, consultor y convocatoria, y una **barra de 4 tramos** (*Solicitado · Aceptado · En curso · Completado*; los tramos alcanzados en `pri`), una nota ("Revisó el presupuesto · ayer") y una acción según el estado (*Ver avances*, *Cancelar solicitud* o *Calificar*).

### Empresa · Plan y créditos (`VistaSuscripcion.tsx`)
- Tarjeta actual: "Tu plan · Prueba gratuita · Termina en **5 días**…" y, al lado, "**340** de 500 créditos de IA" (mono de 34px), barra de 8px y *"Te alcanzan para 3 documentos. Un documento usa 100 créditos; un ajuste, 10."*.
- 3 planes en tarjetas (el recomendado lleva borde superior de 3px en `pri` y el badge "Recomendado"). Beneficios con ✓, derivados de `beneficiosDePlan()`, con el de créditos en negrita.
- Paquetes de créditos en 3 cajas y el texto `CONTRATAR_EN_PILOTO` como nota.
- **Precios y cupos: deben salir de los datos reales.** Los del prototipo son de ejemplo.

### Empresa · Ajustes
Cuenta (filas etiqueta/valor) · **Apariencia** (segmentado Claro/Oscuro, conectado a `next-themes`) · Seguridad (cambiar contraseña y cerrar sesión) · Ayuda (ver el recorrido).

### Consultor (`FundRadar Consultor.dc.html`)
- **Mi perfil** (`EditorPerfil.tsx`): banda `pri-soft` con el anillo de completitud de 76px, *"Te faltan 2 cosas para el 100 %"* con la lista concreta y el estado "Publicado en el directorio". Secciones: Datos principales (foto, nombre, descripción con ayuda y sitio web opcional) · Especialidades como botones conmutables · Portafolio (borde discontinuo y badge "Pendiente" si está vacío). Lateral: zona de arrastre para la hoja de vida y la reputación (★ y completados). Acciones arriba: *Ver como empresa* y **Guardar cambios**.
- **Encargos** (`EncargosConsultor.tsx`): franja de 4 KPI, pestañas *Solicitudes nuevas · En curso · Historial*.
  - Solicitudes nuevas: tarjeta con borde izquierdo de 3px en ámbar, empresa y antigüedad, convocatoria en serif, proyecto y cierre, el mensaje de la empresa entre comillas en `surface-2` y los botones **Enviar propuesta** y *No puedo*.
  - En curso: progreso y lista de tareas acordadas.
  - Historial: filas.
- **Documentos**: documentos compartidos con el permiso ("Puede comentar" o "Puede editar").
- **Mi suscripción**: 2 planes y la nota del piloto.

### Admin (`FundRadar Admin.dc.html`)
- **Panel general** (`DashboardPanel.tsx`): primero, el bloque **"Requiere tu atención"**, con tarjetas clicables de borde izquierdo ámbar (número mono de 26px y texto): perfiles en revisión, solicitudes sin asignar y borradores sin documentos. Después, la franja de 4 KPI, las barras semanales (la última en `pri` y las demás en `pri-soft`) y la barra segmentada de suscripciones con su leyenda.
- **Tabla genérica** (nuevo `DataTable`) para Convocatorias, Fuentes, Categorías, Tasas, Consultores, Solicitudes, Planes, Suscripciones, Plantillas, Seguridad y Administradores: H1, descripción de una línea, CTA principal, **chips de filtro de estado con contador**, cabecera `surface-2` de 12px en mayúsculas, filas de 14px de padding con badge de estado (ok `pri-soft`, aviso `amber-soft`, error `rose-soft`, neutro `surface-2`) y acción de fila outline. En móvil se muestran como tarjetas.
- **Editor de convocatoria** (`EditorConvocatoria.tsx`) en un **drawer** de 640px (pantalla completa en móvil): cabecera con nombre, estado y "guardado hace 1 min"; **pasos numerados** (*Datos generales · Montos y fechas · Categorías · Requisitos · Documentos*); campos en rejilla `auto-fit minmax(200px,1fr)`; una pista en `pri-soft` sobre el paso siguiente; pie fijo con *Cerrar* y **Guardar y seguir**.
- **Perfiles en revisión** (`BandejaRevision.tsx`): lista a la izquierda y detalle a la derecha, con **checklist de revisión** (✓/✗), *Aprobar y publicar*, *Pedir cambios* y *Rechazar* (rose). Usa `ModalMotivo` para el motivo.
- **Consumo de IA**: KPI, últimos consumos y tarifas editables en mono.

---

## Interacciones y comportamiento
- **Breakpoint**: 1024px (`lg`). Por debajo, pestañas inferiores y sin sidebar.
- Al navegar se hace scroll arriba.
- Hover: los botones primarios pasan a `pri-hover`; las tarjetas clicables cambian el borde a `--pri`; las filas toman fondo `surface-2`.
- El foco visible se mantiene (`outline 2px var(--pri)`, offset 2).
- Los modales y drawers se cierran al tocar el overlay y con Esc, con el foco atrapado.
- Animaciones: solo el ping y las barras que crecen al montar (`crece-ancho` y `crece-alto`, que ya existen). Respetar `prefers-reduced-motion`.
- Los textos de créditos siempre se traducen a **documentos** ("Te alcanzan para N documentos"), con `tarifaDocumento` real.

## Estado
No cambia el modelo de datos. Estado de UI nuevo:
- `tab` de Convocatorias (`todas | sugeridas | guardadas`) en la URL (`?tab=`).
- Chips rápidos en la URL (como los filtros actuales de `catalogo-filtros.ts`).
- `drawerFiltros` abierto o cerrado, `sheetMas` abierto o cerrado (móvil) y `vistaPostulaciones` (`tablero | lista`) en `useAlmacenLocal`.
- "Próximo paso": función de servidor nueva en `lib/` que elige la postulación con el cierre más cercano y pendientes.

## Recursos
- Iconos: **lucide-react** (ya está instalado). Equivalencias: Home/LayoutGrid → `House`, Search, FolderKanban → `Folder`, ClipboardCheck, Sparkles, Users, Handshake → `BriefcaseBusiness`, CreditCard, Settings → `SlidersHorizontal`, Bell, Bookmark, Moon/Sun, Menu, ChevronLeft/Right, Check, X, ExternalLink, FileText, ShieldCheck.
- Logo: SVG en línea (ver Marca). No hay imágenes nuevas.
- Fuentes: Google Fonts vía `next/font`.

## Archivos de esta carpeta
- `FundRadar Acceso.dc.html`: identidad
- `FundRadar Empresa.dc.html`: portal empresa (11 pantallas)
- `FundRadar Consultor.dc.html`: portal consultor
- `FundRadar Admin.dc.html`: panel admin
- `PROMPT_CLAUDE_CODE.md`: prompt listo para pegar en Claude Code

Cada prototipo tiene una opción `vista=movil` (marco de 390px) y `tema=oscuro` en sus props.
