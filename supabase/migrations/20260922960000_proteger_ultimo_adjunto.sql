-- Una convocatoria publicada no pierde su último adjunto (RN-01, CU-03 1b,
-- docs/05 §9.14 · sesión 016).
--
-- RN-01 exige al menos un documento adjunto para publicar, y
-- guardar_convocatoria ya impide dejar incompleta a una publicada. Pero el
-- adjunto no se quita por ahí: se quita con DELETE sobre
-- documentos_convocatoria, y ese camino no miraba el estado. Se comprobó en la
-- pantalla: una publicada se quedó con cero adjuntos.
--
-- El trigger bloquea antes la fila de la convocatoria (for update, igual que
-- guardar_convocatoria y publicar_convocatoria), para que dos borrados
-- simultáneos no la dejen en cero: el segundo espera al primero y, con una
-- instantánea nueva, ya no ve al otro adjunto.
--
-- El borrado en cascada de la convocatoria entera pasa: cuando el trigger se
-- evalúa, la fila padre ya no existe y no hay estado que proteger.
--
-- security definer para que la regla no dependa de las políticas RLS de quien
-- borra (vale igual para el administrador y para service_role).
create or replace function privado.proteger_ultimo_adjunto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select c.estado into v_estado
    from public.convocatorias c
   where c.id = old.convocatoria_id
     for update;

  if v_estado = 'publicada'
     and not exists (select 1 from public.documentos_convocatoria d
                      where d.convocatoria_id = old.convocatoria_id and d.id <> old.id) then
    raise exception 'Una convocatoria publicada necesita al menos un documento adjunto'
      using hint = 'publicada_incompleta';
  end if;

  return old;
end;
$$;

revoke all on function privado.proteger_ultimo_adjunto() from public, anon, authenticated;

drop trigger if exists documentos_convocatoria_proteger_ultimo on public.documentos_convocatoria;
create trigger documentos_convocatoria_proteger_ultimo
  before delete on public.documentos_convocatoria
  for each row execute function privado.proteger_ultimo_adjunto();
