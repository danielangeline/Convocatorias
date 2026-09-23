# Incidente abierto · Guardar una convocatoria se cuelga ~20 s y muere

**Abierto:** 22 de septiembre de 2026, sesión 015 · **Estado: sin resolver** · **Gravedad: alta, bloquea el Sprint 2**

> Este archivo existe para que la próxima sesión **no repita el trabajo ya hecho**. Contiene el síntoma, cómo reproducirlo, lo que se descartó **con prueba**, lo que quedó sin comprobar y un plan de ataque ordenado.
> Contexto de la sesión: [`../bitacora/2026-09-22-sesion-015.md`](../bitacora/2026-09-22-sesion-015.md).

---

## 1. Síntoma

`PATCH /api/admin/convocatorias/[id]` se queda **entre 19 y 21 segundos** y responde **500**. El usuario ve *"No pudimos completar la acción. Intenta de nuevo."*

En el log del servidor (`.next/dev/logs/next-development.log`):

```
Catálogo: guardar convocatoria falló "" "TypeError: fetch failed"
```

Y con el error completo desplegado (instrumentación que se retiró al cerrar):

```
TypeError: fetch failed
Caused by: Error: read ECONNRESET (ECONNRESET)
    at TLSWrap.onStreamRead (node:internal/stream_base_commons:216:20)
```

Medidas concretas: 19 247 ms, 20 291 ms, 20 294 ms, 20 301 ms, 20 307 ms. **La regularidad del número es la pista más fuerte que hay.**

El fallo ocurre dentro de `guardarConvocatoria` ([`lib/admin/catalogo.ts`](../../lib/admin/catalogo.ts)), en la llamada `supabase.rpc("guardar_convocatoria", …)`.

**No corrompe datos:** la transacción se revierte y la ficha queda intacta. Lo que se pierde es la operación y 20 segundos.

## 2. Cómo reproducirlo

**Por la suite** (lo más fiable):

```bash
node --env-file=.env.local scripts/prueba-publicar-convocatoria.mjs
```

Falla en el `PATCH` que reduce los requisitos de dos a uno; los scripts avisan con `(reintento N por fallo de red …)`. Deja 4 comprobaciones en rojo, todas del mismo síntoma.

**En el navegador**, con sesión de administrador: abrir una convocatoria que tenga un adjunto y dos requisitos, quitar un requisito y pulsar *Guardar cambios*. Se queda **más de 34 segundos** sin respuesta. Verificado el 22-sep.

**Lo que NO lo reproduce:** un caso mínimo aislado —crear la convocatoria, dos requisitos, una categoría y un adjunto (tanto insertado con `service_role` como subido por el flujo real de tres pasos), y luego el mismo `PATCH`— responde **200 en ~1,5 s**, siempre, con y sin adjunto.

## 3. Descartado, con prueba

| Hipótesis | Cómo se descartó |
|---|---|
| Bloqueo de fila en Postgres | Función temporal sobre `pg_stat_activity` (migraciones `20260922900000` y `…900001`, creada y retirada). No apareció nada esperando. **Ver la limitación en §4.** |
| `privado.ficha_publicable` | Se quitó de `guardar_convocatoria` (migración `…900002`) y el cuelgue siguió |
| `security invoker` frente a `definer` | Se probaron las dos (`…900005`). Igual |
| La reescritura del cuerpo de la función | Se restauró el cuerpo **literal** de la sesión 011 (`…900004`). Igual |
| El adjunto en sí, o hablar con Storage | El caso mínimo con adjunto —insertado y subido de verdad— pasa siempre |
| Intermitencia de red | Cuatro intentos seguidos fallan igual, con esperas de 1,5 / 3 / 4,5 s entre ellos |
| Caché o proceso viejo del servidor | Se mató el proceso, se borró `.next` y se arrancó limpio. Siguió |

## 4. Lo que quedó sin comprobar — empezar por aquí

**El descarte del bloqueo en Postgres está incompleto.** El vigilante solo imprimía las filas con `wait_event` no vacío, es decir, procesos **esperando**. Una consulta que estuviera **corriendo** 20 segundos (plan malo, bucle, trabajo real) no tiene `wait_event` y **no se habría visto**. Esa es la primera piedra que hay que levantar.

## 5. Hechos que no encajan

- Una corrida con el servidor recién arrancado por `preview_start` dejó solo **1–2** comprobaciones en rojo; otras, arrancadas con `npm run dev` igual de frías, dejaron **4**.
- El punto exacto del fallo se mueve entre corridas: unas veces el `PATCH` sobre una convocatoria en **borrador**, otras sobre una **publicada**.
- El caso mínimo nunca falla y la suite larga casi siempre. Sugiere que influye **el número de peticiones que lleva el proceso servidor**, no los datos. Pero no se confirmó.

## 6. Plan de ataque, por orden de coste y valor

1. **Repetir el vigilante de `pg_stat_activity` sin filtrar por `wait_event`.** Capturar `state`, `query_start`, `backend_start` y `query` de todo lo que no esté `idle`, cada 300 ms, mientras corre la suite.
   - Si aparece una consulta **`active` durante 20 s** → el problema está en Postgres y se ve exactamente cuál es.
   - Si **no aparece nada** → la petición ni siquiera llega a Postgres, y el problema es del cliente HTTP o de la red. Salta al punto 2.
2. **Instrumentar el `fetch` del cliente de servidor.** En `crearClienteServidor` ([`lib/supabase/servidor.ts`](../../lib/supabase/servidor.ts)) se le puede pasar un `fetch` propio que registre inicio, fin y error de cada llamada, y de paso cuente los sockets vivos (`process._getActiveHandles?.().length`). Con eso se sabe si el proceso acumula conexiones.
3. **Mirar los logs de Supabase** (panel → Logs Explorer → API y Postgres) en la franja exacta del fallo. **Esto solo lo puede hacer el Product Owner**, el agente no tiene acceso al panel.
4. **Probar el mismo caso en producción.** Si en Vercel no ocurre, el problema es del servidor de desarrollo local y baja de prioridad — aunque no desaparece, porque en local se trabaja todos los días.

Dos sospechas concretas que conviene tener a mano al mirar el punto 1: el `delete … where id <> all (v_conservados)` cuando el array tiene un solo elemento, y los **índices funcionales únicos** que creó la sesión 014 sobre `privado.nombre_normalizado` en `categorias` y `fuentes`, que participan en el guardado a través de `convocatoria_categoria`.

## 7. Cómo quedó el código y la base

**Lo que funciona y se conserva:** `publicar_convocatoria` exige la ficha completa que decidió el Product Owner —ubicación, descripción, enlace, ≥1 categoría, ≥1 adjunto, ≥2 requisitos y cierre no vencido— y el endpoint enumera de una vez todo lo que falta.

**Lo que se revirtió para no dejar el panel peor:** `guardar_convocatoria` volvió a la comprobación de la sesión 011 (migración `…900006`). **Hueco conocido:** editando una convocatoria **ya publicada** se le puede quitar la ubicación, la descripción, la categoría o el adjunto; el enlace y los requisitos sí siguen protegidos. Publicar lo exige todo.

**Migraciones de la sesión 015**, en orden. Se conservan aunque algunas sean idas y vueltas, porque llegaron a aplicarse y el historial debe poder reconstruirse:

| Migración | Qué hizo |
|---|---|
| `20260922100000_publicar_ficha_completa` | La lista nueva de RN-01: crea `ficha_publicable` y la usan publicar y guardar |
| `20260922900000_diagnostico_temporal` | Función temporal sobre `pg_stat_activity` |
| `20260922900001_retirar_diagnostico` | La retira (ya no existe en la base) |
| `20260922900002_bisec_temporal` | Bisección: dejó `guardar_convocatoria` sin la comprobación final |
| `20260922900003_restaurar_guardar` | Restaura la versión con comprobación |
| `20260922900004_guardar_convocatoria_original` | Cuerpo literal de la sesión 011 + comprobación final |
| `20260922900005_ficha_publicable_definer` | `ficha_publicable` pasa a `security definer` |
| `20260922900006_guardar_sin_ficha_publicable` | **Estado actual:** guardar vuelve a la comprobación de la 011 |

**Los scripts no maquillan el fallo:** marcan los casos afectados y reintentan hasta tres veces lo idempotente (`GET` y `PATCH`), avisando por pantalla. Nunca reintentan un `POST`, porque repetirlo podría duplicar lo que el primero sí llegó a hacer.

## 8. Decisión pendiente del Product Owner

**¿Revertir todo lo de la sesión 015 mientras se investiga?** El panel volvería al comportamiento del 18-sep: sin las reglas nuevas de publicación, pero sin el cuelgue. Es una sola migración. Hasta que se decida, queda como está.
