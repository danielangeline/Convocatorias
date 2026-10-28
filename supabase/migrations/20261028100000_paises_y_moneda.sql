-- Sesión 033 · RN-39 (países elegibles), RN-40 (moneda original), RF-116 y
-- RF-117. docs/05 §9.36: tablas 37 a 40, columnas nuevas en convocatorias, y su
-- uso en la ficha publicable, guardar_convocatoria, las sugerencias y la
-- vigencia al postular o generar.

-- ---------------------------------------------------------------------------
-- Tablas 37 y 38 · Países (ISO 3166-1 alfa-2) y monedas (ISO 4217), con su
-- nombre en español. Solo lectura: las llena esta migración.
-- ---------------------------------------------------------------------------
create table public.paises (
  codigo  char(2) primary key check (codigo ~ '^[A-Z]{2}$'),
  nombre  text not null
);

create table public.monedas (
  codigo  char(3) primary key check (codigo ~ '^[A-Z]{3}$'),
  nombre  text not null
);

alter table public.paises enable row level security;
alter table public.monedas enable row level security;

create policy "paises: lectura con sesión"
  on public.paises for select to authenticated using (true);

create policy "monedas: lectura con sesión"
  on public.monedas for select to authenticated using (true);

insert into public.paises (codigo, nombre) values
  ('AD', 'Andorra'),
  ('AE', 'Emiratos Árabes Unidos'),
  ('AF', 'Afganistán'),
  ('AG', 'Antigua y Barbuda'),
  ('AI', 'Anguila'),
  ('AL', 'Albania'),
  ('AM', 'Armenia'),
  ('AO', 'Angola'),
  ('AQ', 'Antártida'),
  ('AR', 'Argentina'),
  ('AS', 'Samoa Americana'),
  ('AT', 'Austria'),
  ('AU', 'Australia'),
  ('AW', 'Aruba'),
  ('AX', 'Islas Aland'),
  ('AZ', 'Azerbaiyán'),
  ('BA', 'Bosnia y Herzegovina'),
  ('BB', 'Barbados'),
  ('BD', 'Bangladés'),
  ('BE', 'Bélgica'),
  ('BF', 'Burkina Faso'),
  ('BG', 'Bulgaria'),
  ('BH', 'Baréin'),
  ('BI', 'Burundi'),
  ('BJ', 'Benín'),
  ('BL', 'San Bartolomé'),
  ('BM', 'Bermudas'),
  ('BN', 'Brunéi'),
  ('BO', 'Bolivia'),
  ('BQ', 'Caribe neerlandés'),
  ('BR', 'Brasil'),
  ('BS', 'Bahamas'),
  ('BT', 'Bután'),
  ('BV', 'Isla Bouvet'),
  ('BW', 'Botsuana'),
  ('BY', 'Bielorrusia'),
  ('BZ', 'Belice'),
  ('CA', 'Canadá'),
  ('CC', 'Islas Cocos'),
  ('CD', 'República Democrática del Congo'),
  ('CF', 'República Centroafricana'),
  ('CG', 'Congo'),
  ('CH', 'Suiza'),
  ('CI', 'Côte d’Ivoire'),
  ('CK', 'Islas Cook'),
  ('CL', 'Chile'),
  ('CM', 'Camerún'),
  ('CN', 'China'),
  ('CO', 'Colombia'),
  ('CR', 'Costa Rica'),
  ('CU', 'Cuba'),
  ('CV', 'Cabo Verde'),
  ('CW', 'Curazao'),
  ('CX', 'Isla de Navidad'),
  ('CY', 'Chipre'),
  ('CZ', 'Chequia'),
  ('DE', 'Alemania'),
  ('DJ', 'Yibuti'),
  ('DK', 'Dinamarca'),
  ('DM', 'Dominica'),
  ('DO', 'República Dominicana'),
  ('DZ', 'Argelia'),
  ('EC', 'Ecuador'),
  ('EE', 'Estonia'),
  ('EG', 'Egipto'),
  ('EH', 'Sáhara Occidental'),
  ('ER', 'Eritrea'),
  ('ES', 'España'),
  ('ET', 'Etiopía'),
  ('FI', 'Finlandia'),
  ('FJ', 'Fiyi'),
  ('FK', 'Islas Malvinas'),
  ('FM', 'Micronesia'),
  ('FO', 'Islas Feroe'),
  ('FR', 'Francia'),
  ('GA', 'Gabón'),
  ('GB', 'Reino Unido'),
  ('GD', 'Granada'),
  ('GE', 'Georgia'),
  ('GF', 'Guayana Francesa'),
  ('GG', 'Guernesey'),
  ('GH', 'Ghana'),
  ('GI', 'Gibraltar'),
  ('GL', 'Groenlandia'),
  ('GM', 'Gambia'),
  ('GN', 'Guinea'),
  ('GP', 'Guadalupe'),
  ('GQ', 'Guinea Ecuatorial'),
  ('GR', 'Grecia'),
  ('GS', 'Islas Georgia del Sur y Sandwich del Sur'),
  ('GT', 'Guatemala'),
  ('GU', 'Guam'),
  ('GW', 'Guinea-Bisáu'),
  ('GY', 'Guyana'),
  ('HK', 'RAE de Hong Kong (China)'),
  ('HM', 'Islas Heard y McDonald'),
  ('HN', 'Honduras'),
  ('HR', 'Croacia'),
  ('HT', 'Haití'),
  ('HU', 'Hungría'),
  ('ID', 'Indonesia'),
  ('IE', 'Irlanda'),
  ('IL', 'Israel'),
  ('IM', 'Isla de Man'),
  ('IN', 'India'),
  ('IO', 'Territorio Británico del Océano Índico'),
  ('IQ', 'Irak'),
  ('IR', 'Irán'),
  ('IS', 'Islandia'),
  ('IT', 'Italia'),
  ('JE', 'Jersey'),
  ('JM', 'Jamaica'),
  ('JO', 'Jordania'),
  ('JP', 'Japón'),
  ('KE', 'Kenia'),
  ('KG', 'Kirguistán'),
  ('KH', 'Camboya'),
  ('KI', 'Kiribati'),
  ('KM', 'Comoras'),
  ('KN', 'San Cristóbal y Nieves'),
  ('KP', 'Corea del Norte'),
  ('KR', 'Corea del Sur'),
  ('KW', 'Kuwait'),
  ('KY', 'Islas Caimán'),
  ('KZ', 'Kazajistán'),
  ('LA', 'Laos'),
  ('LB', 'Líbano'),
  ('LC', 'Santa Lucía'),
  ('LI', 'Liechtenstein'),
  ('LK', 'Sri Lanka'),
  ('LR', 'Liberia'),
  ('LS', 'Lesoto'),
  ('LT', 'Lituania'),
  ('LU', 'Luxemburgo'),
  ('LV', 'Letonia'),
  ('LY', 'Libia'),
  ('MA', 'Marruecos'),
  ('MC', 'Mónaco'),
  ('MD', 'Moldavia'),
  ('ME', 'Montenegro'),
  ('MF', 'San Martín'),
  ('MG', 'Madagascar'),
  ('MH', 'Islas Marshall'),
  ('MK', 'Macedonia del Norte'),
  ('ML', 'Mali'),
  ('MM', 'Myanmar (Birmania)'),
  ('MN', 'Mongolia'),
  ('MO', 'RAE de Macao (China)'),
  ('MP', 'Islas Marianas del Norte'),
  ('MQ', 'Martinica'),
  ('MR', 'Mauritania'),
  ('MS', 'Montserrat'),
  ('MT', 'Malta'),
  ('MU', 'Mauricio'),
  ('MV', 'Maldivas'),
  ('MW', 'Malaui'),
  ('MX', 'México'),
  ('MY', 'Malasia'),
  ('MZ', 'Mozambique'),
  ('NA', 'Namibia'),
  ('NC', 'Nueva Caledonia'),
  ('NE', 'Níger'),
  ('NF', 'Isla Norfolk'),
  ('NG', 'Nigeria'),
  ('NI', 'Nicaragua'),
  ('NL', 'Países Bajos'),
  ('NO', 'Noruega'),
  ('NP', 'Nepal'),
  ('NR', 'Nauru'),
  ('NU', 'Niue'),
  ('NZ', 'Nueva Zelanda'),
  ('OM', 'Omán'),
  ('PA', 'Panamá'),
  ('PE', 'Perú'),
  ('PF', 'Polinesia Francesa'),
  ('PG', 'Papúa Nueva Guinea'),
  ('PH', 'Filipinas'),
  ('PK', 'Pakistán'),
  ('PL', 'Polonia'),
  ('PM', 'San Pedro y Miquelón'),
  ('PN', 'Islas Pitcairn'),
  ('PR', 'Puerto Rico'),
  ('PS', 'Territorios Palestinos'),
  ('PT', 'Portugal'),
  ('PW', 'Palaos'),
  ('PY', 'Paraguay'),
  ('QA', 'Catar'),
  ('RE', 'Reunión'),
  ('RO', 'Rumanía'),
  ('RS', 'Serbia'),
  ('RU', 'Rusia'),
  ('RW', 'Ruanda'),
  ('SA', 'Arabia Saudí'),
  ('SB', 'Islas Salomón'),
  ('SC', 'Seychelles'),
  ('SD', 'Sudán'),
  ('SE', 'Suecia'),
  ('SG', 'Singapur'),
  ('SH', 'Santa Elena'),
  ('SI', 'Eslovenia'),
  ('SJ', 'Svalbard y Jan Mayen'),
  ('SK', 'Eslovaquia'),
  ('SL', 'Sierra Leona'),
  ('SM', 'San Marino'),
  ('SN', 'Senegal'),
  ('SO', 'Somalia'),
  ('SR', 'Surinam'),
  ('SS', 'Sudán del Sur'),
  ('ST', 'Santo Tomé y Príncipe'),
  ('SV', 'El Salvador'),
  ('SX', 'Sint Maarten'),
  ('SY', 'Siria'),
  ('SZ', 'Esuatini'),
  ('TC', 'Islas Turcas y Caicos'),
  ('TD', 'Chad'),
  ('TF', 'Territorios Australes Franceses'),
  ('TG', 'Togo'),
  ('TH', 'Tailandia'),
  ('TJ', 'Tayikistán'),
  ('TK', 'Tokelau'),
  ('TL', 'Timor-Leste'),
  ('TM', 'Turkmenistán'),
  ('TN', 'Túnez'),
  ('TO', 'Tonga'),
  ('TR', 'Turquía'),
  ('TT', 'Trinidad y Tobago'),
  ('TV', 'Tuvalu'),
  ('TW', 'Taiwán'),
  ('TZ', 'Tanzania'),
  ('UA', 'Ucrania'),
  ('UG', 'Uganda'),
  ('UM', 'Islas menores alejadas de EE. UU.'),
  ('US', 'Estados Unidos'),
  ('UY', 'Uruguay'),
  ('UZ', 'Uzbekistán'),
  ('VA', 'Ciudad del Vaticano'),
  ('VC', 'San Vicente y las Granadinas'),
  ('VE', 'Venezuela'),
  ('VG', 'Islas Vírgenes Británicas'),
  ('VI', 'Islas Vírgenes de EE. UU.'),
  ('VN', 'Vietnam'),
  ('VU', 'Vanuatu'),
  ('WF', 'Wallis y Futuna'),
  ('WS', 'Samoa'),
  ('YE', 'Yemen'),
  ('YT', 'Mayotte'),
  ('ZA', 'Sudáfrica'),
  ('ZM', 'Zambia'),
  ('ZW', 'Zimbabue');

insert into public.monedas (codigo, nombre) values
  ('AED', 'dírham de los Emiratos Árabes Unidos'),
  ('AFN', 'afgani afgano'),
  ('ALL', 'lek albanés'),
  ('AMD', 'dram armenio'),
  ('ANG', 'florín antillano'),
  ('AOA', 'kuanza angoleño'),
  ('ARS', 'peso argentino'),
  ('AUD', 'dólar australiano'),
  ('AWG', 'florín arubeño'),
  ('AZN', 'manat azerbaiyano'),
  ('BAM', 'marco convertible de Bosnia y Herzegovina'),
  ('BBD', 'dólar barbadense'),
  ('BDT', 'taka bangladesí'),
  ('BGN', 'leva búlgara'),
  ('BHD', 'dinar bareiní'),
  ('BIF', 'franco burundés'),
  ('BMD', 'dólar bermudeño'),
  ('BND', 'dólar bruneano'),
  ('BOB', 'boliviano'),
  ('BRL', 'real brasileño'),
  ('BSD', 'dólar bahameño'),
  ('BTN', 'gultrum butanés'),
  ('BWP', 'pula botsuano'),
  ('BYN', 'rublo bielorruso'),
  ('BZD', 'dólar beliceño'),
  ('CAD', 'dólar canadiense'),
  ('CDF', 'franco congoleño'),
  ('CHF', 'franco suizo'),
  ('CLP', 'peso chileno'),
  ('CNY', 'yuan renminbi'),
  ('COP', 'peso colombiano'),
  ('CRC', 'colón costarricense'),
  ('CUP', 'peso cubano'),
  ('CVE', 'escudo de Cabo Verde'),
  ('CZK', 'corona checa'),
  ('DJF', 'franco yibutiano'),
  ('DKK', 'corona danesa'),
  ('DOP', 'peso dominicano'),
  ('DZD', 'dinar argelino'),
  ('EGP', 'libra egipcia'),
  ('ERN', 'nakfa eritreo'),
  ('ETB', 'bir etíope'),
  ('EUR', 'euro'),
  ('FJD', 'dólar fiyiano'),
  ('FKP', 'libra malvinense'),
  ('GBP', 'libra esterlina'),
  ('GEL', 'lari georgiano'),
  ('GHS', 'cedi ghanés'),
  ('GIP', 'libra gibraltareña'),
  ('GMD', 'dalasi gambiano'),
  ('GNF', 'franco guineano'),
  ('GTQ', 'quetzal guatemalteco'),
  ('GYD', 'dólar guyanés'),
  ('HKD', 'dólar hongkonés'),
  ('HNL', 'lempira hondureño'),
  ('HTG', 'gurde haitiano'),
  ('HUF', 'forinto húngaro'),
  ('IDR', 'rupia indonesia'),
  ('ILS', 'nuevo séquel israelí'),
  ('INR', 'rupia india'),
  ('IQD', 'dinar iraquí'),
  ('IRR', 'rial iraní'),
  ('ISK', 'corona islandesa'),
  ('JMD', 'dólar jamaicano'),
  ('JOD', 'dinar jordano'),
  ('JPY', 'yen japonés'),
  ('KES', 'chelín keniano'),
  ('KGS', 'som kirguís'),
  ('KHR', 'riel camboyano'),
  ('KMF', 'franco comorense'),
  ('KPW', 'won norcoreano'),
  ('KRW', 'won surcoreano'),
  ('KWD', 'dinar kuwaití'),
  ('KYD', 'dólar de las Islas Caimán'),
  ('KZT', 'tengue kazajo'),
  ('LAK', 'kip laosiano'),
  ('LBP', 'libra libanesa'),
  ('LKR', 'rupia esrilanquesa'),
  ('LRD', 'dólar liberiano'),
  ('LSL', 'loti lesotense'),
  ('LYD', 'dinar libio'),
  ('MAD', 'dírham marroquí'),
  ('MDL', 'leu moldavo'),
  ('MGA', 'ariari malgache'),
  ('MKD', 'dinar macedonio'),
  ('MMK', 'kiat de Myanmar'),
  ('MNT', 'tugrik mongol'),
  ('MOP', 'pataca macaense'),
  ('MRU', 'uguiya mauritano'),
  ('MUR', 'rupia mauriciana'),
  ('MVR', 'rufiya maldiva'),
  ('MWK', 'kuacha malauí'),
  ('MXN', 'peso mexicano'),
  ('MYR', 'ringit malasio'),
  ('MZN', 'metical mozambiqueño'),
  ('NAD', 'dólar namibio'),
  ('NGN', 'naira nigeriano'),
  ('NIO', 'córdoba oro'),
  ('NOK', 'corona noruega'),
  ('NPR', 'rupia nepalí'),
  ('NZD', 'dólar neozelandés'),
  ('OMR', 'rial omaní'),
  ('PAB', 'balboa panameño'),
  ('PEN', 'sol peruano'),
  ('PGK', 'kina papú'),
  ('PHP', 'peso filipino'),
  ('PKR', 'rupia pakistaní'),
  ('PLN', 'esloti polaco'),
  ('PYG', 'guaraní paraguayo'),
  ('QAR', 'rial catarí'),
  ('RON', 'leu rumano'),
  ('RSD', 'dinar serbio'),
  ('RUB', 'rublo ruso'),
  ('RWF', 'franco ruandés'),
  ('SAR', 'rial saudí'),
  ('SBD', 'dólar salomonense'),
  ('SCR', 'rupia seychellense'),
  ('SDG', 'libra sudanesa'),
  ('SEK', 'corona sueca'),
  ('SGD', 'dólar singapurense'),
  ('SHP', 'libra de Santa Elena'),
  ('SLE', 'leona sierraleonesa'),
  ('SOS', 'chelín somalí'),
  ('SRD', 'dólar surinamés'),
  ('SSP', 'libra sursudanesa'),
  ('STN', 'dobra santotomense'),
  ('SVC', 'colón salvadoreño'),
  ('SYP', 'libra siria'),
  ('SZL', 'lilangeni esuatiní'),
  ('THB', 'bat tailandés'),
  ('TJS', 'somoni tayiko'),
  ('TMT', 'manat turcomano'),
  ('TND', 'dinar tunecino'),
  ('TOP', 'paanga tongano'),
  ('TRY', 'lira turca'),
  ('TTD', 'dólar de Trinidad y Tobago'),
  ('TWD', 'nuevo dólar taiwanés'),
  ('TZS', 'chelín tanzano'),
  ('UAH', 'grivna ucraniana'),
  ('UGX', 'chelín ugandés'),
  ('USD', 'dólar estadounidense'),
  ('UYU', 'peso uruguayo'),
  ('UZS', 'sum uzbeko'),
  ('VES', 'bolívar venezolano'),
  ('VND', 'dong vietnamita'),
  ('VUV', 'vatu vanuatense'),
  ('WST', 'tala samoano'),
  ('XAF', 'franco CFA de África Central'),
  ('XCD', 'dólar del Caribe Oriental'),
  ('XCG', 'florín caribeño'),
  ('XOF', 'franco CFA de África Occidental'),
  ('XPF', 'franco CFP'),
  ('YER', 'rial yemení'),
  ('ZAR', 'rand sudafricano'),
  ('ZMW', 'kuacha zambiano'),
  ('ZWG', 'ZWG');

-- ---------------------------------------------------------------------------
-- Columnas nuevas en convocatorias. Las que ya existen quedan en COP.
-- ---------------------------------------------------------------------------
alter table public.convocatorias
  add column todos_los_paises boolean not null default false,
  add column moneda char(3) not null default 'COP' references public.monedas (codigo);

-- ---------------------------------------------------------------------------
-- Tabla 39 · Países que pueden postularse a cada convocatoria. Misma RLS que
-- convocatoria_departamento (§9.18).
-- ---------------------------------------------------------------------------
create table public.convocatoria_pais (
  convocatoria_id  uuid not null references public.convocatorias (id) on delete cascade,
  pais_codigo      char(2) not null references public.paises (codigo),
  primary key (convocatoria_id, pais_codigo)
);

create index convocatoria_pais_pais_idx on public.convocatoria_pais (pais_codigo);

alter table public.convocatoria_pais enable row level security;

create policy "convocatoria_pais: visible con su convocatoria"
  on public.convocatoria_pais for select to authenticated
  using (exists (select 1 from public.convocatorias c where c.id = convocatoria_id));

create policy "convocatoria_pais: el administrador crea"
  on public.convocatoria_pais for insert to authenticated
  with check ((select privado.es_admin()));

create policy "convocatoria_pais: el administrador elimina"
  on public.convocatoria_pais for delete to authenticated
  using ((select privado.es_admin()));

-- Todas las convocatorias que ya existen admiten a Colombia (se verificó al
-- cargarlas en las sesiones 029 y 032).
insert into public.convocatoria_pais (convocatoria_id, pais_codigo)
select c.id, 'CO' from public.convocatorias c
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tabla 40 · Tasa de referencia por moneda (RN-40): cuántos pesos vale una
-- unidad. Solo para comparar; nunca reemplaza el monto guardado.
-- ---------------------------------------------------------------------------
create table public.tasas_referencia (
  moneda           char(3) primary key references public.monedas (codigo) check (moneda <> 'COP'),
  cop_por_unidad   numeric(14, 4) not null check (cop_por_unidad > 0),
  vigente_desde    date not null,
  actualizado_por  uuid references public.perfiles (id) on delete set null,
  actualizado_at   timestamptz not null default now()
);

alter table public.tasas_referencia enable row level security;

create policy "tasas_referencia: lectura con sesión"
  on public.tasas_referencia for select to authenticated using (true);

create policy "tasas_referencia: el administrador crea"
  on public.tasas_referencia for insert to authenticated
  with check ((select privado.es_admin()));

create policy "tasas_referencia: el administrador cambia"
  on public.tasas_referencia for update to authenticated
  using ((select privado.es_admin())) with check ((select privado.es_admin()));

create policy "tasas_referencia: el administrador borra"
  on public.tasas_referencia for delete to authenticated
  using ((select privado.es_admin()));

revoke all on public.paises, public.monedas, public.convocatoria_pais, public.tasas_referencia from anon;
grant select on public.paises, public.monedas to authenticated;
grant select, insert, delete on public.convocatoria_pais to authenticated;
grant select, insert, update, delete on public.tasas_referencia to authenticated;

-- RF-117 · Fijar la tasa de una moneda; queda quién y cuándo.
create or replace function public.guardar_tasa(p_moneda text, p_cop_por_unidad numeric, p_vigente_desde date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select privado.es_admin()) then
    raise exception 'Solo un administrador con MFA fija tasas' using hint = 'no_es_admin';
  end if;
  if p_moneda is null or upper(p_moneda) = 'COP'
     or not exists (select 1 from public.monedas m where m.codigo = upper(p_moneda)) then
    raise exception 'La moneda no existe o es el peso' using hint = 'moneda_invalida';
  end if;
  if p_cop_por_unidad is null or p_cop_por_unidad <= 0 then
    raise exception 'La tasa debe ser mayor que cero' using hint = 'tasa_invalida';
  end if;
  if p_vigente_desde is null or p_vigente_desde > privado.hoy_colombia() then
    raise exception 'La fecha de la tasa no puede ser futura' using hint = 'fecha_invalida';
  end if;
  insert into public.tasas_referencia (moneda, cop_por_unidad, vigente_desde, actualizado_por, actualizado_at)
  values (upper(p_moneda), p_cop_por_unidad, p_vigente_desde, auth.uid(), now())
  on conflict (moneda) do update set
    cop_por_unidad  = excluded.cop_por_unidad,
    vigente_desde   = excluded.vigente_desde,
    actualizado_por = excluded.actualizado_por,
    actualizado_at  = excluded.actualizado_at;
end;
$$;

revoke all on function public.guardar_tasa(text, numeric, date) from public, anon;
grant execute on function public.guardar_tasa(text, numeric, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Funciones de apoyo (§9.36)
-- ---------------------------------------------------------------------------
-- El país de la empresa: Colombia mientras el registro sea solo para Colombia
-- (RN-39). Una sola función para no repetir la constante.
create or replace function privado.pais_de(p_usuario uuid)
returns char(2)
language sql
immutable
set search_path = ''
as $$ select 'CO'::char(2) $$;

create or replace function privado.convocatoria_elegible(p_convocatoria uuid, p_pais char(2))
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.convocatorias c
     where c.id = p_convocatoria
       and (c.todos_los_paises
            or exists (select 1 from public.convocatoria_pais cp
                        where cp.convocatoria_id = c.id and cp.pais_codigo = p_pais))
  );
$$;

-- RN-40 · El monto en pesos, solo para comparar; null si no hay tasa.
create or replace function privado.monto_cop(p_monto numeric, p_moneda char(3))
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_monto is null then null
    when p_moneda = 'COP' then p_monto
    else p_monto * (select t.cop_por_unidad from public.tasas_referencia t where t.moneda = p_moneda)
  end;
$$;

revoke all on function privado.pais_de(uuid) from public, anon, authenticated;
revoke all on function privado.convocatoria_elegible(uuid, char) from public, anon, authenticated;
revoke all on function privado.monto_cop(numeric, char) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RN-01 · La ficha publicable exige países declarados, y cobertura solo si
-- Colombia es elegible.
-- ---------------------------------------------------------------------------
create or replace function privado.ficha_publicable(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.convocatorias c
     where c.id = p_id
       and coalesce(btrim(c.nombre), '')              <> ''
       and coalesce(btrim(c.entidad_convocante), '')  <> ''
       and (c.todos_los_paises
            or exists (select 1 from public.convocatoria_pais cp where cp.convocatoria_id = p_id))
       and (not privado.convocatoria_elegible(p_id, 'CO')
            or c.cobertura_nacional
            or exists (select 1 from public.convocatoria_departamento cd where cd.convocatoria_id = p_id))
       and coalesce(btrim(c.descripcion), '')         <> ''
       and coalesce(btrim(c.url_postulacion), '')     <> ''
       and c.fecha_cierre is not null
       and (select count(*) from public.convocatoria_categoria cc where cc.convocatoria_id = p_id) >= 1
       and (select count(*) from public.documentos_convocatoria d where d.convocatoria_id = p_id) >= 1
       and (select count(*) from public.requisitos_convocatoria r where r.convocatoria_id = p_id) >= 2
  );
$$;

-- ---------------------------------------------------------------------------
-- guardar_convocatoria (§9.13): mismo cuerpo de 20261027100000 más moneda y
-- países elegibles.
-- ---------------------------------------------------------------------------
create or replace function public.guardar_convocatoria(
  p_id          uuid,
  p_datos       jsonb,
  p_categorias  uuid[],
  p_requisitos  jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actual      public.convocatorias%rowtype;
  v_fuente      uuid;
  v_req         jsonb;
  v_req_id      uuid;
  v_orden       int := 0;
  v_conservados uuid[] := '{}';
  v_nacional    boolean := coalesce((p_datos ->> 'cobertura_nacional')::boolean, false);
  v_deptos      text[];
  v_todos       boolean;
  v_paises      text[];
  v_moneda      text;
begin
  if not (select privado.es_admin()) then
    raise exception 'Solo un administrador con MFA guarda convocatorias' using hint = 'no_es_admin';
  end if;

  select * into v_actual from public.convocatorias where id = p_id for update;
  if not found then
    raise exception 'La convocatoria no existe' using hint = 'no_existe';
  end if;

  -- La comprobacion de RN-01 va al final, sobre lo que quede escrito.

  -- Fuente: activa, o la que ya tenía (CU-02).
  v_fuente := nullif(p_datos ->> 'fuente_id', '')::uuid;
  if v_fuente is not null
     and v_fuente is distinct from v_actual.fuente_id
     and not exists (select 1 from public.fuentes f where f.id = v_fuente and f.activa) then
    raise exception 'La fuente no existe o está inactiva' using hint = 'fuente_invalida';
  end if;

  -- RN-40 · La moneda debe existir en la lista ISO 4217.
  v_moneda := coalesce(nullif(upper(btrim(p_datos ->> 'moneda')), ''), v_actual.moneda);
  if not exists (select 1 from public.monedas m where m.codigo = v_moneda) then
    raise exception 'La moneda no existe' using hint = 'moneda_invalida';
  end if;

  update public.convocatorias set
    fuente_id           = v_fuente,
    nombre              = p_datos ->> 'nombre',
    entidad_convocante  = p_datos ->> 'entidad_convocante',
    descripcion         = nullif(p_datos ->> 'descripcion', ''),
    monto_min           = nullif(p_datos ->> 'monto_min', '')::numeric,
    monto_max           = nullif(p_datos ->> 'monto_max', '')::numeric,
    ubicacion_cobertura = nullif(p_datos ->> 'ubicacion_cobertura', ''),
    cobertura_nacional  = v_nacional,
    fecha_apertura      = nullif(p_datos ->> 'fecha_apertura', '')::date,
    fecha_cierre        = (p_datos ->> 'fecha_cierre')::date,
    url_postulacion     = nullif(p_datos ->> 'url_postulacion', ''),
    -- RF-102: tipo y origen; si no llegan, se conservan los que tenía.
    tipo_convocatoria   = coalesce(nullif(p_datos ->> 'tipo_convocatoria', ''), v_actual.tipo_convocatoria),
    origen              = coalesce(nullif(p_datos ->> 'origen', ''), v_actual.origen),
    -- RN-40: moneda del monto; si no llega, se conserva la que tenía.
    moneda              = v_moneda
  where id = p_id;

  -- Categorías (RF-06): activas, o ya asignadas a esta convocatoria.
  if exists (
    select 1 from unnest(coalesce(p_categorias, '{}')) as c(id)
    where not exists (select 1 from public.categorias k where k.id = c.id and k.activa)
      and not exists (select 1 from public.convocatoria_categoria cc
                      where cc.convocatoria_id = p_id and cc.categoria_id = c.id)
  ) then
    raise exception 'Hay una categoría inexistente o inactiva' using hint = 'categoria_invalida';
  end if;

  delete from public.convocatoria_categoria
  where convocatoria_id = p_id and categoria_id <> all (coalesce(p_categorias, '{}'));

  insert into public.convocatoria_categoria (convocatoria_id, categoria_id)
  select distinct p_id, c.id from unnest(coalesce(p_categorias, '{}')) as c(id)
  on conflict do nothing;

  -- Cobertura (RN-34): nacional, o los departamentos recibidos.
  v_deptos := case when v_nacional then '{}'::text[] else coalesce(
    (select array_agg(distinct d) from jsonb_array_elements_text(coalesce(p_datos -> 'departamentos', '[]'::jsonb)) d),
    '{}') end;

  if exists (select 1 from unnest(v_deptos) d(codigo)
             where not exists (select 1 from public.departamentos x where x.codigo = d.codigo)) then
    raise exception 'Hay un departamento que no existe' using hint = 'departamento_invalido';
  end if;

  delete from public.convocatoria_departamento
  where convocatoria_id = p_id and departamento_codigo <> all (v_deptos);

  insert into public.convocatoria_departamento (convocatoria_id, departamento_codigo)
  select p_id, d from unnest(v_deptos) d
  on conflict do nothing;

  -- RN-39 · Países elegibles: todos, o la lista recibida. Si no llegan, se
  -- conservan los que tenía (un cliente anterior a la sesión 032 no los manda).
  if p_datos ? 'todos_los_paises' or p_datos ? 'paises' then
    v_todos := coalesce((p_datos ->> 'todos_los_paises')::boolean, false);
    v_paises := case when v_todos then '{}'::text[] else coalesce(
      (select array_agg(distinct upper(btrim(x))) from jsonb_array_elements_text(coalesce(p_datos -> 'paises', '[]'::jsonb)) x),
      '{}') end;

    if exists (select 1 from unnest(v_paises) p(codigo)
               where not exists (select 1 from public.paises x where x.codigo = p.codigo)) then
      raise exception 'Hay un país que no existe' using hint = 'pais_invalido';
    end if;

    update public.convocatorias set todos_los_paises = v_todos where id = p_id;

    delete from public.convocatoria_pais
    where convocatoria_id = p_id and pais_codigo <> all (v_paises);

    insert into public.convocatoria_pais (convocatoria_id, pais_codigo)
    select p_id, p from unnest(v_paises) p
    on conflict do nothing;
  end if;

  -- Requisitos (RF-08): el orden es la posición en la lista.
  for v_req in select * from jsonb_array_elements(coalesce(p_requisitos, '[]'::jsonb)) loop
    v_orden := v_orden + 1;
    v_req_id := nullif(v_req ->> 'id', '')::uuid;

    if v_req_id is not null then
      update public.requisitos_convocatoria set
        descripcion = v_req ->> 'descripcion',
        tipo        = v_req ->> 'tipo',
        obligatorio = coalesce((v_req ->> 'obligatorio')::boolean, true),
        orden       = v_orden
      where id = v_req_id and convocatoria_id = p_id;
      if not found then
        raise exception 'El requisito % no pertenece a esta convocatoria', v_req_id using hint = 'requisito_ajeno';
      end if;
    else
      insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden)
      values (p_id, v_req ->> 'descripcion', v_req ->> 'tipo',
              coalesce((v_req ->> 'obligatorio')::boolean, true), v_orden)
      returning id into v_req_id;
    end if;

    v_conservados := v_conservados || v_req_id;
  end loop;

  -- Los checklists ya copiados no cambian (RN-04: requisito_id on delete set null).
  delete from public.requisitos_convocatoria
  where convocatoria_id = p_id and id <> all (v_conservados);

  -- RN-01 · una convocatoria ya publicada no puede quedar incompleta.
  if v_actual.estado = 'publicada' and not (select privado.ficha_publicable(p_id)) then
    raise exception 'Una convocatoria publicada no puede quedar incompleta' using hint = 'publicada_incompleta';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RN-39 · Postular o generar exige, además de vigencia, que el país de la
-- empresa pueda postularse. Mismo trigger de 20260923400000.
-- ---------------------------------------------------------------------------
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
  if not privado.convocatoria_elegible(new.convocatoria_id, privado.pais_de(new.usuario_id)) then
    raise exception 'El país de la empresa no puede postularse a esta convocatoria'
      using hint = 'pais_no_elegible';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RF-16 · Sugerencias: solo convocatorias elegibles para el país del dueño del
-- proyecto, y el monto comparado en pesos con la tasa de referencia (sin tasa,
-- el criterio no coincide). Mismo cuerpo de 20261008100000; la firma no cambia.
-- ---------------------------------------------------------------------------
create or replace function privado.calcular_sugerencias(p_proyecto uuid)
returns table (
  convocatoria_id  uuid,
  tipo_proyecto    boolean,
  sector           boolean,
  tipo_entidad     boolean,
  monto            boolean,
  ubicacion        boolean,
  coincidencias    integer,
  porcentaje       integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_monto  numeric;
  v_depto  text;
  v_pais   char(2);
begin
  select p.monto_buscado, p.departamento_codigo, privado.pais_de(p.usuario_id) into v_monto, v_depto, v_pais
    from public.proyectos p where p.id = p_proyecto;
  if not found then
    return;
  end if;

  return query
  with vigentes as (
    select c.id,
           privado.monto_cop(c.monto_min, c.moneda) as monto_min,
           privado.monto_cop(c.monto_max, c.moneda) as monto_max,
           (c.moneda <> 'COP' and (c.monto_min is not null or c.monto_max is not null)
            and not exists (select 1 from public.tasas_referencia t where t.moneda = c.moneda)) as sin_tasa,
           c.cobertura_nacional, c.fecha_cierre
      from public.convocatorias c
     where c.estado = 'publicada'
       and c.fecha_cierre >= privado.hoy_colombia()
       and privado.convocatoria_elegible(c.id, v_pais)
  ),
  por_tipo as (
    select cc.convocatoria_id as id,
           bool_or(k.tipo = 'tipo_proyecto') as tp,
           bool_or(k.tipo = 'sector')        as se,
           bool_or(k.tipo = 'tipo_entidad')  as te
      from public.convocatoria_categoria cc
      join public.proyecto_categoria pc on pc.categoria_id = cc.categoria_id and pc.proyecto_id = p_proyecto
      join public.categorias k on k.id = cc.categoria_id and k.activa
     where cc.convocatoria_id in (select v.id from vigentes v)
     group by cc.convocatoria_id
  ),
  evaluadas as (
    select v.id, v.fecha_cierre,
           coalesce(t.tp, false) as tp,
           coalesce(t.se, false) as se,
           coalesce(t.te, false) as te,
           (v_monto is not null
             and not v.sin_tasa
             and (v.monto_min is null or v_monto >= v.monto_min)
             and (v.monto_max is null or v_monto <= v.monto_max)) as mo,
           (v.cobertura_nacional
             or (v_depto is not null and exists (
                   select 1 from public.convocatoria_departamento cd
                    where cd.convocatoria_id = v.id and cd.departamento_codigo = v_depto))) as ub
      from vigentes v
      left join por_tipo t on t.id = v.id
  )
  select e.id, e.tp, e.se, e.te, e.mo, e.ub, n.total,
         round(n.total * 100.0 / 5)::integer
    from evaluadas e
    cross join lateral (select e.tp::int + e.se::int + e.te::int + e.mo::int + e.ub::int as total) n
   order by n.total desc, e.fecha_cierre asc, e.id;
end;
$$;

revoke all on function privado.calcular_sugerencias(uuid) from public, anon, authenticated;
