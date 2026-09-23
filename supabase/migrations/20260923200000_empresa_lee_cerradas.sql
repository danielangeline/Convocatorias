-- La empresa puede leer las convocatorias cerradas (RF-11, RN-02 · docs/05
-- §9.10 · sesión 017, Sprint 2 paso 5).
--
-- RF-11 y RN-02 piden que las cerradas queden fuera del listado por defecto y
-- reaparezcan bajo un filtro explícito, marcadas y sin acciones. Hasta ahora la
-- RLS solo dejaba ver las publicadas y vigentes, así que el filtro no podía
-- traer nada. "Cerrada" es el estado `cerrada` o una `publicada` cuya fecha ya
-- pasó (el job de RF-10 aún no la ha cerrado). Borradores y despublicadas
-- siguen invisibles para la empresa (RN-33).
--
-- Leer no es actuar: la política de inserción de postulaciones exige por su
-- cuenta publicada y vigente (RF-78) y los documentos generados no tienen
-- política de inserción para la empresa. Las tablas hijas y los adjuntos del
-- bucket heredan esta visibilidad.
drop policy if exists "convocatorias: la empresa lee las publicadas y vigentes" on public.convocatorias;
drop policy if exists "convocatorias: la empresa lee las publicadas y las cerradas" on public.convocatorias;
create policy "convocatorias: la empresa lee las publicadas y las cerradas"
  on public.convocatorias for select to authenticated
  using (
    estado in ('publicada', 'cerrada')
    and (select privado.rol_actual()) = 'empresa'
  );
