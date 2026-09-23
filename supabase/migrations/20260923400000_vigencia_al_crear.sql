-- RF-78, RN-03 · Ninguna postulación ni documento generado se crea sobre una
-- convocatoria que no esté publicada y vigente (docs/05 §9.7 · sesión 017,
-- Sprint 2 paso 7).
--
-- Hasta ahora lo exigía solo la política de inserción de postulaciones, que no
-- frena a service_role, y documentos_generados no tenía ninguna comprobación.
-- El trigger vale para cualquier camino: los endpoints de postular (Sprint 3) y
-- de generar (Sprint 4) lo heredan y traducen su clave a 409. Se evalúa al
-- crear y si cambia la convocatoria; editar lo ya creado no pasa por aquí.
create or replace function privado.exigir_convocatoria_vigente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.convocatorias c
     where c.id = new.convocatoria_id
       and c.estado = 'publicada'
       and c.fecha_cierre >= privado.hoy_colombia()
  ) then
    raise exception 'La convocatoria no está publicada y vigente'
      using hint = 'convocatoria_no_vigente';
  end if;
  return new;
end;
$$;

revoke all on function privado.exigir_convocatoria_vigente() from public, anon, authenticated;

drop trigger if exists postulaciones_convocatoria_vigente on public.postulaciones;
create trigger postulaciones_convocatoria_vigente
  before insert or update of convocatoria_id on public.postulaciones
  for each row execute function privado.exigir_convocatoria_vigente();

drop trigger if exists documentos_generados_convocatoria_vigente on public.documentos_generados;
create trigger documentos_generados_convocatoria_vigente
  before insert or update of convocatoria_id on public.documentos_generados
  for each row execute function privado.exigir_convocatoria_vigente();
