-- Vigente: clientes, consultas, ventas y avisos de cada emprendedora.
-- Pegar entero en Supabase → SQL Editor → Run. Se puede correr más de una vez.
-- Mismo proyecto que Tachán, La Vaquita, Partila y El Fijo: tablas y funciones propias con prefijo vg_.
--
-- Seguridad: las tablas no se leen ni se escriben directo (RLS activado, sin permisos para anon ni authenticated).
-- Todo pasa por las funciones vg_ de abajo, que toman a la dueña de la sesión (auth.uid()) y nunca del celular.

create extension if not exists pgcrypto;

-- ---------- tablas ----------
create table if not exists public.vg_clientes (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 80),
  telefono    text not null default '' check (telefono ~ '^([0-9]{6,15})?$'),
  intereses   text[] not null default '{}' check (cardinality(intereses) <= 20),
  origen      text not null default '' check (char_length(origen) <= 30),
  cumple      text check (cumple ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  nota        text not null default '' check (char_length(nota) <= 1000),
  sin_promos  boolean not null default false,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists vg_clientes_owner on public.vg_clientes (owner);
create unique index if not exists vg_clientes_tel on public.vg_clientes (owner, telefono) where telefono <> '';

create table if not exists public.vg_movimientos (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  cliente_id uuid not null references public.vg_clientes (id) on delete cascade,
  tipo       text not null check (tipo in ('consulta', 'venta', 'mensaje', 'promo', 'nota')),
  fecha      date not null,
  producto   text not null default '' check (char_length(producto) <= 120),
  medio      text not null default '' check (medio in ('', 'credito', 'debito', 'efectivo', 'transferencia', 'mercadopago', 'otro')),
  cuotas     smallint check (cuotas between 1 and 60),
  monto      numeric(12, 2) check (monto >= 0 and monto < 10000000000),
  detalle    text not null default '' check (char_length(detalle) <= 1000),
  motivo     text not null default '' check (char_length(motivo) <= 80),
  creado     timestamptz not null default now()
);
create index if not exists vg_movimientos_owner on public.vg_movimientos (owner);
create index if not exists vg_movimientos_cliente on public.vg_movimientos (cliente_id);

-- Avisos pospuestos o descartados (los avisos en sí se calculan en el celular con src/logic.js).
create table if not exists public.vg_avisos (
  owner  uuid not null references auth.users (id) on delete cascade,
  clave  text not null check (char_length(clave) <= 120),
  estado text not null check (estado in ('descartado', 'pospuesto')),
  hasta  date,
  creado timestamptz not null default now(),
  primary key (owner, clave)
);

create table if not exists public.vg_ajustes (
  owner       uuid primary key references auth.users (id) on delete cascade,
  datos       jsonb not null default '{}'::jsonb check (pg_column_size(datos) < 32000),
  actualizado timestamptz not null default now()
);

alter table public.vg_clientes    enable row level security;
alter table public.vg_movimientos enable row level security;
alter table public.vg_avisos      enable row level security;
alter table public.vg_ajustes     enable row level security;
revoke all on table public.vg_clientes, public.vg_movimientos, public.vg_avisos, public.vg_ajustes from public, anon, authenticated;

-- ---------- ayudantes (no se pueden llamar desde la app) ----------
create or replace function public.vg_yo()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'no_auth' using errcode = '28000'; end if;
  return me;
end $$;

-- ¿Hay algo que parezca un número de tarjeta? 15 a 19 dígitos seguidos (con espacios, puntos o guiones) que pasan Luhn.
create or replace function public.vg_parece_tarjeta(t text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare m text[]; d text; s int; x int; n int;
begin
  if t is null or t !~ '[0-9]' then return false; end if;
  for m in select regexp_matches(t, '([0-9](?:[ .-]?[0-9]){14,18})', 'g') loop
    d := regexp_replace(m[1], '[^0-9]', '', 'g');
    n := length(d);
    if n between 15 and 19 then
      s := 0;
      for i in 0 .. n - 1 loop
        x := substr(d, n - i, 1)::int;
        if i % 2 = 1 then x := x * 2; if x > 9 then x := x - 9; end if; end if;
        s := s + x;
      end loop;
      if s % 10 = 0 then return true; end if;
    end if;
  end loop;
  return false;
end $$;

-- Texto limpio: sin caracteres de control, con largo máximo y sin números de tarjeta.
create or replace function public.vg_txt(t text, maxlen int, campo text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := btrim(regexp_replace(coalesce(t, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
begin
  if char_length(v) > maxlen then raise exception 'largo:%', campo using errcode = '22001'; end if;
  if public.vg_parece_tarjeta(v) then raise exception 'tarjeta' using errcode = '22023'; end if;
  return v;
end $$;

-- Lista de textos (intereses, productos, orígenes): sin vacíos ni repetidos (sin importar mayúsculas).
create or replace function public.vg_lista(j jsonb, maxn int, maxlen int)
returns text[] language plpgsql immutable set search_path = '' as $$
declare r text[] := '{}'; e text; v text;
begin
  if j is null or jsonb_typeof(j) <> 'array' then return r; end if;
  if jsonb_array_length(j) > maxn * 2 then raise exception 'muchos' using errcode = '22023'; end if;
  for e in select jsonb_array_elements_text(j) loop
    v := public.vg_txt(e, maxlen, 'etiqueta');
    if v <> '' and not exists (select 1 from unnest(r) x where lower(x) = lower(v)) then r := r || v; end if;
  end loop;
  if cardinality(r) > maxn then raise exception 'muchos' using errcode = '22023'; end if;
  return r;
end $$;

create or replace function public.vg_cliente_json(c public.vg_clientes)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono, 'intereses', to_jsonb(c.intereses),
    'origen', c.origen, 'cumple', c.cumple, 'nota', c.nota, 'sinPromos', c.sin_promos, 'creado', c.creado)
$$;

create or replace function public.vg_mov_json(m public.vg_movimientos)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'clienteId', m.cliente_id, 'tipo', m.tipo, 'fecha', m.fecha, 'producto', m.producto,
    'medio', m.medio, 'cuotas', m.cuotas, 'monto', m.monto, 'detalle', m.detalle, 'motivo', m.motivo, 'creado', m.creado)
$$;

-- Alta o cambio de un cliente. Con por_tel, si no viene id y el teléfono ya está, suma a ese cliente (no lo duplica).
create or replace function public.vg_cliente_upsert(me uuid, p jsonb, por_tel boolean)
returns public.vg_clientes language plpgsql security definer set search_path = '' as $$
declare
  c public.vg_clientes;
  cid uuid := nullif(p->>'id', '')::uuid;
  v_nombre text := public.vg_txt(p->>'nombre', 80, 'nombre');
  v_tel text := regexp_replace(coalesce(p->>'telefono', ''), '[^0-9]', '', 'g');
  v_int text[] := public.vg_lista(p->'intereses', 20, 40);
  v_origen text := public.vg_txt(p->>'origen', 30, 'origen');
  v_cumple text := nullif(btrim(coalesce(p->>'cumple', '')), '');
  v_nota text := public.vg_txt(p->>'nota', 1000, 'nota');
  v_sin boolean := coalesce((p->>'sinPromos')::boolean, false);
begin
  if v_nombre = '' then raise exception 'falta_nombre' using errcode = '22023'; end if;
  if v_tel <> '' and length(v_tel) not between 6 and 15 then raise exception 'bad_tel' using errcode = '22023'; end if;
  if v_cumple is not null and v_cumple !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then raise exception 'bad_cumple' using errcode = '22023'; end if;

  if cid is not null then
    begin
      update public.vg_clientes set nombre = v_nombre, telefono = v_tel, intereses = v_int, origen = v_origen,
        cumple = v_cumple, nota = v_nota, sin_promos = v_sin, actualizado = now()
       where id = cid and owner = me returning * into c;
    exception when unique_violation then
      raise exception 'tel_repetido' using errcode = '23505';
    end;
    if c.id is null then raise exception 'no_existe' using errcode = 'P0002'; end if;
    return c;
  end if;

  if por_tel and v_tel <> '' then
    select * into c from public.vg_clientes where owner = me and telefono = v_tel for update;
    if c.id is not null then
      -- ya estaba: se suman los intereses nuevos y se completa lo que faltaba, sin pisar lo que había
      update public.vg_clientes set
        intereses = (select coalesce(array_agg(x order by o), '{}') from (
                       select distinct on (lower(x)) x, o from unnest(c.intereses || v_int) with ordinality t(x, o) order by lower(x), o) s),
        origen = case when origen = '' then v_origen else origen end,
        cumple = coalesce(cumple, v_cumple),
        nota = case when nota = '' then v_nota else nota end,
        actualizado = now()
       where id = c.id returning * into c;
      if cardinality(c.intereses) > 20 then raise exception 'muchos' using errcode = '22023'; end if;
      return c;
    end if;
  end if;

  if (select count(*) from public.vg_clientes where owner = me) >= 5000 then
    raise exception 'tope_clientes' using errcode = '54000';
  end if;
  begin
    insert into public.vg_clientes (owner, nombre, telefono, intereses, origen, cumple, nota, sin_promos)
    values (me, v_nombre, v_tel, v_int, v_origen, v_cumple, v_nota, v_sin) returning * into c;
  exception when unique_violation then
    raise exception 'tel_repetido' using errcode = '23505';
  end;
  return c;
end $$;

create or replace function public.vg_mov_insert(me uuid, cid uuid, p jsonb)
returns public.vg_movimientos language plpgsql security definer set search_path = '' as $$
declare
  m public.vg_movimientos;
  v_tipo text := coalesce(p->>'tipo', '');
  v_fecha date := coalesce(nullif(p->>'fecha', '')::date, current_date);
  v_prod text := public.vg_txt(p->>'producto', 120, 'producto');
  v_det text := public.vg_txt(p->>'detalle', 1000, 'detalle');
  v_mot text := public.vg_txt(p->>'motivo', 80, 'motivo');
  v_medio text := '';
  v_cuotas int := null;
  v_monto numeric := null;
begin
  if not exists (select 1 from public.vg_clientes where id = cid and owner = me) then
    raise exception 'no_existe' using errcode = 'P0002';
  end if;
  if v_tipo not in ('consulta', 'venta', 'mensaje', 'promo', 'nota') then raise exception 'bad_tipo' using errcode = '22023'; end if;
  if v_fecha < date '2000-01-01' or v_fecha > current_date + 2 then raise exception 'bad_fecha' using errcode = '22023'; end if;
  if v_tipo = 'venta' then
    v_medio := coalesce(p->>'medio', '');
    if v_medio not in ('', 'credito', 'debito', 'efectivo', 'transferencia', 'mercadopago', 'otro') then
      raise exception 'bad_medio' using errcode = '22023';
    end if;
    if v_medio in ('credito', 'mercadopago') then
      v_cuotas := nullif(p->>'cuotas', '')::int;
      if v_cuotas is not null and v_cuotas not between 1 and 60 then raise exception 'bad_cuotas' using errcode = '22023'; end if;
    end if;
    v_monto := round(nullif(p->>'monto', '')::numeric, 2);
    if v_monto is not null and (v_monto < 0 or v_monto >= 10000000000) then raise exception 'bad_monto' using errcode = '22023'; end if;
  end if;
  if (select count(*) from public.vg_movimientos where cliente_id = cid) >= 500 then
    raise exception 'tope_movimientos' using errcode = '54000';
  end if;
  insert into public.vg_movimientos (owner, cliente_id, tipo, fecha, producto, medio, cuotas, monto, detalle, motivo)
  values (me, cid, v_tipo, v_fecha, v_prod, v_medio, v_cuotas, v_monto, v_det, v_mot) returning * into m;
  update public.vg_clientes set actualizado = now() where id = cid;
  return m;
end $$;

-- ---------- funciones de la app ----------
-- Todo lo de la cuenta en una llamada (una emprendedora tiene cientos de clientes, no millones).
create or replace function public.vg_estado()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.vg_yo();
begin
  return jsonb_build_object(
    'clientes', coalesce((select jsonb_agg(public.vg_cliente_json(c) order by c.creado, c.id) from public.vg_clientes c where c.owner = me), '[]'::jsonb),
    'movimientos', coalesce((select jsonb_agg(public.vg_mov_json(m) order by m.fecha, m.creado, m.id) from public.vg_movimientos m where m.owner = me), '[]'::jsonb),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('clave', a.clave, 'estado', a.estado, 'hasta', a.hasta) order by a.clave)
                          from public.vg_avisos a where a.owner = me), '[]'::jsonb),
    'ajustes', coalesce((select datos from public.vg_ajustes where owner = me), '{}'::jsonb),
    'hoy', current_date);
end $$;

create or replace function public.vg_cliente_guardar(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo();
begin
  return public.vg_cliente_json(public.vg_cliente_upsert(me, p, false));
end $$;

create or replace function public.vg_cliente_borrar(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo();
begin
  delete from public.vg_clientes where id = p_id and owner = me;  -- sus movimientos se borran en cascada
  if not found then raise exception 'no_existe' using errcode = 'P0002'; end if;
end $$;

-- Consulta o venta en un paso: el cliente (nuevo, existente o encontrado por teléfono) y el movimiento.
create or replace function public.vg_registrar(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo(); c public.vg_clientes; m public.vg_movimientos; habia boolean := false;
begin
  if jsonb_typeof(p->'cliente') <> 'object' or jsonb_typeof(p->'movimiento') <> 'object' then
    raise exception 'bad_datos' using errcode = '22023';
  end if;
  if nullif(p->'cliente'->>'id', '') is null then
    habia := exists (select 1 from public.vg_clientes where owner = me and telefono <> ''
                      and telefono = regexp_replace(coalesce(p->'cliente'->>'telefono', ''), '[^0-9]', '', 'g'));
  end if;
  c := public.vg_cliente_upsert(me, p->'cliente', true);
  m := public.vg_mov_insert(me, c.id, p->'movimiento');
  return jsonb_build_object('cliente', public.vg_cliente_json(c), 'movimiento', public.vg_mov_json(m), 'yaEstaba', habia);
end $$;

-- Importar contactos (hasta 1000 por vez). Los teléfonos que ya están se saltean.
create or replace function public.vg_clientes_importar(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo(); e jsonb; c public.vg_clientes; v_tel text; creados jsonb := '[]'::jsonb; rep int := 0;
begin
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 1000 then raise exception 'bad_datos' using errcode = '22023'; end if;
  if (select count(*) from public.vg_clientes where owner = me) + jsonb_array_length(p) > 5000 then
    raise exception 'tope_clientes' using errcode = '54000';
  end if;
  for e in select * from jsonb_array_elements(p) loop
    v_tel := regexp_replace(coalesce(e->>'telefono', ''), '[^0-9]', '', 'g');
    if v_tel <> '' and exists (select 1 from public.vg_clientes where owner = me and telefono = v_tel) then
      rep := rep + 1;
      continue;
    end if;
    c := public.vg_cliente_upsert(me, e - 'id' - 'sinPromos', false);
    creados := creados || public.vg_cliente_json(c);
  end loop;
  return jsonb_build_object('creados', creados, 'repetidos', rep);
end $$;

create or replace function public.vg_mov_agregar(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo();
begin
  return public.vg_mov_json(public.vg_mov_insert(me, nullif(p->>'clienteId', '')::uuid, p));
end $$;

create or replace function public.vg_mov_borrar(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo();
begin
  delete from public.vg_movimientos where id = p_id and owner = me;
  if not found then raise exception 'no_existe' using errcode = 'P0002'; end if;
end $$;

-- Posponer (hasta una fecha) o descartar un aviso. La clave la arma logic.js: «cuota:<venta>:6», «seg:<consulta>»…
create or replace function public.vg_aviso_marcar(p_clave text, p_estado text, p_hasta date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo();
begin
  if p_clave is null or p_clave !~ '^[a-z]{3,10}:[A-Za-z0-9:_-]{1,100}$' then raise exception 'bad_clave' using errcode = '22023'; end if;
  if p_estado not in ('descartado', 'pospuesto') then raise exception 'bad_estado' using errcode = '22023'; end if;
  if p_estado = 'pospuesto' and (p_hasta is null or p_hasta < current_date or p_hasta > current_date + 400) then
    raise exception 'bad_fecha' using errcode = '22023';
  end if;
  delete from public.vg_avisos where owner = me and estado = 'pospuesto' and hasta < current_date - 7;
  if (select count(*) from public.vg_avisos where owner = me) >= 10000 then raise exception 'tope_avisos' using errcode = '54000'; end if;
  insert into public.vg_avisos (owner, clave, estado, hasta)
  values (me, p_clave, p_estado, case when p_estado = 'pospuesto' then p_hasta end)
  on conflict (owner, clave) do update set estado = excluded.estado, hasta = excluded.hasta, creado = now();
  return jsonb_build_object('clave', p_clave, 'estado', p_estado, 'hasta', case when p_estado = 'pospuesto' then p_hasta end);
end $$;

create or replace function public.vg_aviso_quitar(p_clave text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo();
begin
  delete from public.vg_avisos where owner = me and clave = p_clave;
end $$;

-- Ajustes: solo se guardan las claves conocidas, cada una validada.
create or replace function public.vg_ajustes_guardar(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.vg_yo();
  d jsonb := '{}'::jsonb; dias jsonb := '{}'::jsonb; pl jsonb := '{}'::jsonb;
  k text; n int; lim int[];
  car text := regexp_replace(coalesce(p->>'caracteristica', ''), '[^0-9]', '', 'g');
begin
  if jsonb_typeof(p) <> 'object' then raise exception 'bad_datos' using errcode = '22023'; end if;
  d := d || jsonb_build_object('productos', to_jsonb(public.vg_lista(p->'productos', 40, 40)));
  d := d || jsonb_build_object('origenes', to_jsonb(public.vg_lista(p->'origenes', 12, 30)));
  if car <> '' and length(car) between 2 and 4 then d := d || jsonb_build_object('caracteristica', car); end if;
  d := d || jsonb_build_object('firma', public.vg_txt(p->>'firma', 40, 'firma'));
  if jsonb_typeof(p->'dias') = 'object' then
    foreach k in array array['seguimiento', 'volver', 'postventa', 'quieto'] loop
      lim := case k when 'seguimiento' then array[1, 60] when 'volver' then array[7, 180] when 'postventa' then array[1, 90] else array[30, 365] end;
      if (p->'dias'->>k) ~ '^[0-9]{1,3}$' then
        n := (p->'dias'->>k)::int;
        if n between lim[1] and lim[2] then dias := dias || jsonb_build_object(k, n); end if;
      end if;
    end loop;
  end if;
  d := d || jsonb_build_object('dias', dias);
  if jsonb_typeof(p->'plantillas') = 'object' then
    foreach k in array array['seguimiento', 'volver', 'postventa', 'cuota', 'fin', 'quieto', 'cumple', 'promo'] loop
      if jsonb_typeof(p->'plantillas'->k) = 'string' and btrim(p->'plantillas'->>k) <> '' then
        pl := pl || jsonb_build_object(k, public.vg_txt(p->'plantillas'->>k, 700, 'plantilla'));
      end if;
    end loop;
  end if;
  d := d || jsonb_build_object('plantillas', pl);
  insert into public.vg_ajustes (owner, datos) values (me, d)
  on conflict (owner) do update set datos = excluded.datos, actualizado = now();
  return d;
end $$;

-- Borra todo lo de Vigente de esta cuenta. La cuenta queda (es la misma de las otras apps).
create or replace function public.vg_borrar_todo()
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.vg_yo();
begin
  delete from public.vg_movimientos where owner = me;
  delete from public.vg_clientes where owner = me;
  delete from public.vg_avisos where owner = me;
  delete from public.vg_ajustes where owner = me;
end $$;

-- ---------- permisos ----------
revoke all on function public.vg_yo() from public, anon, authenticated;
revoke all on function public.vg_parece_tarjeta(text) from public, anon, authenticated;
revoke all on function public.vg_txt(text, int, text) from public, anon, authenticated;
revoke all on function public.vg_lista(jsonb, int, int) from public, anon, authenticated;
revoke all on function public.vg_cliente_json(public.vg_clientes) from public, anon, authenticated;
revoke all on function public.vg_mov_json(public.vg_movimientos) from public, anon, authenticated;
revoke all on function public.vg_cliente_upsert(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.vg_mov_insert(uuid, uuid, jsonb) from public, anon, authenticated;

revoke all on function public.vg_estado() from public, anon;
revoke all on function public.vg_cliente_guardar(jsonb) from public, anon;
revoke all on function public.vg_cliente_borrar(uuid) from public, anon;
revoke all on function public.vg_registrar(jsonb) from public, anon;
revoke all on function public.vg_clientes_importar(jsonb) from public, anon;
revoke all on function public.vg_mov_agregar(jsonb) from public, anon;
revoke all on function public.vg_mov_borrar(uuid) from public, anon;
revoke all on function public.vg_aviso_marcar(text, text, date) from public, anon;
revoke all on function public.vg_aviso_quitar(text) from public, anon;
revoke all on function public.vg_ajustes_guardar(jsonb) from public, anon;
revoke all on function public.vg_borrar_todo() from public, anon;

grant execute on function public.vg_estado() to authenticated;
grant execute on function public.vg_cliente_guardar(jsonb) to authenticated;
grant execute on function public.vg_cliente_borrar(uuid) to authenticated;
grant execute on function public.vg_registrar(jsonb) to authenticated;
grant execute on function public.vg_clientes_importar(jsonb) to authenticated;
grant execute on function public.vg_mov_agregar(jsonb) to authenticated;
grant execute on function public.vg_mov_borrar(uuid) to authenticated;
grant execute on function public.vg_aviso_marcar(text, text, date) to authenticated;
grant execute on function public.vg_aviso_quitar(text) to authenticated;
grant execute on function public.vg_ajustes_guardar(jsonb) to authenticated;
grant execute on function public.vg_borrar_todo() to authenticated;
