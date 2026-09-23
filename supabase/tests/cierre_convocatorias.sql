-- RF-10, CU-06, RN-02 · Cierre diario de convocatorias vencidas (sesión 017).
--
--   npx supabase db query --linked -f supabase/tests/cierre_convocatorias.sql
--
-- Corre en una transacción que termina SIEMPRE con un error "RESULTADO …" que la
-- revierte: no deja nada escrito. Se lee ese mensaje: cada línea dice OK o FALLA.
do $$
declare
  v_res text := '';
  v_cerradas integer;
  v_estado text;
  f record;
begin
  insert into public.convocatorias (id, nombre, entidad_convocante, fecha_cierre, estado, url_postulacion) values
    ('00000000-0000-0000-0000-0000000cc001', 'Vencida ayer', 'Prueba', privado.hoy_colombia() - 1, 'publicada', 'https://prueba.gov.co/1'),
    ('00000000-0000-0000-0000-0000000cc002', 'Cierra hoy', 'Prueba', privado.hoy_colombia(), 'publicada', 'https://prueba.gov.co/2'),
    ('00000000-0000-0000-0000-0000000cc003', 'Borrador vencido', 'Prueba', privado.hoy_colombia() - 5, 'borrador', null),
    ('00000000-0000-0000-0000-0000000cc004', 'Despublicada vencida', 'Prueba', privado.hoy_colombia() - 5, 'despublicada', 'https://prueba.gov.co/4');

  v_cerradas := privado.cerrar_convocatorias_vencidas();

  for f in select * from (values
      ('00000000-0000-0000-0000-0000000cc001'::uuid, 'cerrada', 'la publicada vencida ayer se cierra'),
      ('00000000-0000-0000-0000-0000000cc002'::uuid, 'publicada', 'la que cierra hoy sigue abierta (vence al terminar el día en Colombia)'),
      ('00000000-0000-0000-0000-0000000cc003'::uuid, 'borrador', 'un borrador vencido no se toca'),
      ('00000000-0000-0000-0000-0000000cc004'::uuid, 'despublicada', 'una despublicada vencida no se toca')
    ) as t(id, esperado, caso)
  loop
    select estado into v_estado from public.convocatorias where id = f.id;
    v_res := v_res || format(E'\n%s %s -> %s', case when v_estado = f.esperado then 'OK   ' else 'FALLA' end, f.caso, v_estado);
  end loop;

  v_res := v_res || format(E'\n%s la función devuelve cuántas cerró -> %s',
    case when v_cerradas >= 1 then 'OK   ' else 'FALLA' end, v_cerradas);
  v_res := v_res || format(E'\n%s una segunda pasada no cierra nada más de la prueba -> %s',
    case when privado.cerrar_convocatorias_vencidas() = 0 then 'OK   ' else 'FALLA' end, 'ok');
  v_res := v_res || format(E'\n%s hoy en Colombia -> %s (UTC: %s)',
    case when privado.hoy_colombia() = (now() at time zone 'America/Bogota')::date then 'OK   ' else 'FALLA' end,
    privado.hoy_colombia(), current_date);

  raise exception 'RESULTADO (todo se revierte):%', v_res;
end $$;
