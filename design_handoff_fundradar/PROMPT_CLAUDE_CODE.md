# Prompt para Claude Code

Copia la carpeta `design_handoff_fundradar/` en la raíz del repo y pega esto en Claude Code:

---

Vas a implementar el rediseño **FundRadar** en este repo (Next.js App Router + Tailwind v4 + lucide-react + Supabase). La especificación completa está en `design_handoff_fundradar/README.md`. Los `.dc.html` de esa carpeta son **prototipos de referencia en HTML**: ábrelos y léelos para sacar valores exactos, pero **no copies su código**. Recrea todo con los componentes y patrones existentes (`components/ui`, `components/shell`, `components/viz`, `lib/*`).

**Reglas que no se pueden romper**
1. No cambies la lógica de negocio, las consultas a Supabase, las migraciones, los RF/RN ni la autorización (`exigirRol`, `matriz.ts`). Solo cambian la presentación, la navegación y la jerarquía.
2. No inventes datos. Los números, planes y precios del prototipo son de ejemplo. Usa siempre los datos reales que hoy reciben las páginas.
3. Conserva las rutas actuales. `/sugeridas` y `/guardadas` deben redirigir a `/convocatorias?tab=sugeridas|guardadas`.
4. Accesibilidad: objetivos táctiles de 44px como mínimo, foco visible, `aria-*` en pestañas, modales y casillas, y `prefers-reduced-motion`.
5. Antes de empezar, lee `CLAUDE.md` y `ESTADO.md` y sigue sus convenciones (bitácora en `docs/bitacora/`, español, comentarios con RF/CU).

**Plan por fases.** Haz un commit por fase, corre `npm run build` y `npm run lint` al cerrar cada una y detente a mostrarme el resultado antes de seguir:

**Fase 1: tokens y marca**
- Reemplaza los tokens de `app/globals.css` (`:root` y `.dark`) por los de la sección "Tokens de diseño" del README. Añade `--line-strong`, `--amber-soft`, `--rose-soft`, `--topbar` y `--overlay`, y quita `--violet` y `--sky` de la UI. Actualiza `@theme inline`.
- En `app/layout.tsx` cambia las fuentes de `next/font/google` a Source Serif 4 (500, 600, como `--font-display`), Inter (400 a 700, como `--font-sans`) e IBM Plex Mono (500, como `--font-plex-mono`).
- Añade `@keyframes ping` y la clase `.ping-ring`, respetando reduced motion.
- `Logo.tsx`: nuevo símbolo de dos anillos y punto ámbar, y el texto "FundRadar". Renombra "Convocatorias" a "FundRadar" en metadata, títulos y textos visibles.
- `Button.tsx`: radio de 4px, `min-h-11`, variante nueva `outline` y eliminación de `ai`/`consultor` (migra sus usos). `Card.tsx`: radio de 6px y sin sombra. `Badge.tsx`: radio de 3px y tonos `ok | aviso | error | neutro`. `PageHeader.tsx`: H1 en serif 32/600 y eyebrow en mayúsculas con tracking .08em.
- `viz/Deadline.tsx` y `viz/CompatRing.tsx` con las reglas de color del README.

**Fase 2: shell y navegación**
- `menus.ts`: el menú nuevo de empresa del README. "Sugeridas" y "Beneficios tributarios" salen del menú; "Guardadas" pasa a ser una pestaña.
- `Sidebar.tsx`: 252px, sin modo contraído ni grupos colapsables, pie con créditos ("Te alcanzan para N documentos", usando la tarifa real) y fila de usuario.
- `Topbar.tsx`: 60px, desenfoque, miga, búsqueda de 280px, tema y campana con ping.
- Nuevo `components/shell/TabsInferiores.tsx`, visible solo por debajo de `lg`: Inicio, Buscar, Postular, Proyectos y Más. Más abre un `BottomSheet` con el resto del menú. Para el consultor, 4 pestañas. El admin usa el `Drawer` actual con hamburguesa en móvil.
- Ajusta `AppShell.tsx`, el padding del contenido (`px-4 pt-5 pb-24` en móvil para no tapar las pestañas) y `max-w-[1200px]`.

**Fase 3: identidad** (`app/(identidad)/layout.tsx` y `components/identidad/*`)
- Layout partido: banda oscura `#0A1A22` con titular, ping y 3 cifras reales, y el formulario a la derecha. En móvil se apilan.
- `SelectorPuerta` como tarjetas radio con borde de 2px. Consentimiento con casilla propia de 22px; el CTA queda deshabilitado visualmente hasta marcarla.
- `FormularioMfa`: 6 casillas de dígito visibles sobre el input real, sin tocar la lógica.

**Fase 4: portal empresa**, pantalla por pantalla según el README:
Inicio (tarjeta "Tu próximo paso" con una función nueva en `lib/` y la gráfica fuera) → Convocatorias (pestañas, chips rápidos, filas nuevas y drawer o bottom sheet de filtros con recuento en vivo) → Ficha ("¿Te aplica?" con `CompatBreakdown`, columna de acción sticky y barra fija en móvil) → Proyectos (consejo de completitud y modal de 2 caminos) → Postulaciones (tablero o lista y chips de etapa en móvil) → Detalle (stepper y checklist interactivo que actualiza la etapa) → Documentos → Directorio → Encargos (barra de 4 tramos) → Plan y créditos → Ajustes (tema conectado a `next-themes`).

**Fase 5: portal consultor**: Mi perfil (banda de completitud con lo que falta), Encargos (pestañas y tarjetas de solicitud con el mensaje de la empresa), Documentos y Suscripción.

**Fase 6: panel admin**: Panel general (bloque "Requiere tu atención" primero), `DataTable` con chips de estado y vista en tarjetas en móvil para todos los listados, `EditorConvocatoria` dentro de un `Drawer` de 640px con pasos numerados, `BandejaRevision` en lista y detalle con checklist, y Consumo de IA.

**Verificación en cada fase**
- Revisa cada pantalla a 1440px y a 390px, en claro y en oscuro.
- Contraste mínimo de 4.5:1 en el texto. El ámbar nunca va como texto sobre claro.
- Compara visualmente con el `.dc.html` correspondiente (`?vista=movil` para móvil) y corrige diferencias de espaciado, tamaño o color.
- Escribe la bitácora de la sesión en `docs/bitacora/` siguiendo el formato existente.

Empieza leyendo el README del handoff y `CLAUDE.md`, y después propón un plan breve de la Fase 1 con los archivos que vas a tocar.
