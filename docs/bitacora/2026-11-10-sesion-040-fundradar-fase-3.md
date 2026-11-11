# Sesión 040 · 2026-11-10 (Fase 3)

**Sprint:** 5 · día 12 de 30 (rediseño visual, sin RF nuevos)

## Objetivo de la sesión

Fase 3 del rediseño FundRadar: identidad (`app/(identidad)/*`, `components/identidad/*`).

## Qué se hizo

Solo presentación; ningún RF/RN/RNF cambia de estado (CU-14, CU-38, RF-01, RF-03, RF-44, RF-84, RF-88 sin cambios de lógica).

- `app/(identidad)/layout.tsx`: pantalla partida. Banda `#0A1A22` con logo, ping ámbar, titular serif y tres cifras reales de `obtenerIndicadores()` (vigentes, monto disponible, entidades; RF-44); formulario de 420 px a la derecha; se apilan en móvil (la banda se compacta y deja solo logo, ping y titular).
- `Campo`: 48 px, borde `line-strong`, etiqueta enlazada con `htmlFor` y acción en línea («¿La olvidó?»). `Aviso` con `rose-soft` / `amber-soft`.
- `SelectorPuerta`: tarjetas radio con borde de 2 px (`pri` y fondo `pri-soft` al elegir).
- Registro: casilla propia de 22 px, CTA atenuado hasta marcarla (sigue activo para que el navegador pida la autorización, RF-88), «Prueba gratuita de 7 días. Sin tarjeta de crédito.» para empresa, y «Revise su correo» con el correo en negrita.
- MFA: 6 casillas de 56 px sobre el input real (invisible, mismo `onChange`, `autoComplete="one-time-code"`); la lógica de `FormularioMfa` y el QR no se tocaron.
- Textos de Identidad en tratamiento de **usted** (login, registro, recuperar, definir contraseña, MFA).

## Cómo se verificó

`tsc` limpio, `npm run lint` 0 errores, `npm run build` compila. Navegador con cuentas temporales (`e3b904`, ya borradas): registro a 1440 px en claro; MFA con un administrador temporal (3 dígitos tecleados llenan 3 casillas y la 4.ª queda activa) a 1440 px claro y a 390 px oscuro.

## Decisiones tomadas

- **No se añadió el enlace público a la verificación en dos pasos** que pide el README del handoff: contradice la regla 11 de `CLAUDE.md` (RN-31, RF-85: «sin opción de administrador en ninguna pantalla pública»; `/mfa` responde 404 a quien no es administrador). El administrador sigue llegando a `/mfa` desde el login.
- **Eyebrow de la banda:** «N convocatorias vigentes hoy» en lugar de «nuevas hoy»: no existe un dato de «nuevas hoy» y no se inventa.
- **Sin «Reenviar» en «Revise su correo»** ni enlaces a Términos y Tratamiento de datos: no hay acción de reenvío ni páginas de términos (RNF-24 sigue abierto).

## Qué quedó abierto

- Decidir si se crea la acción de reenvío del correo y las páginas de Términos y Tratamiento de datos (requieren RF/documentación antes de programarse).
- Las pantallas `/auth/recuperar` y `/auth/definir-contrasena` no se recorrieron en el navegador (mismos componentes y estilos que las revisadas).
- La landing (`app/page.tsx`) conserva su diseño propio; el handoff no la cubre.

## Estado al cerrar

Fase 3 lista para revisión; falta la Fase 4 (portal empresa).
