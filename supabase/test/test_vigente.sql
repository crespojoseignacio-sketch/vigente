-- Pruebas de vigente.sql en un Postgres común (después de supabase_stub.sql).
-- psql -f supabase/test/supabase_stub.sql -f supabase/vigente.sql -f supabase/test/test_vigente.sql
\set ON_ERROR_STOP on

insert into auth.users (id) values ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002');

-- Corre un SQL y devuelve el mensaje de error, o 'ok'.
create or replace function public.t_err(q text) returns text language plpgsql as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function public.t_err(text) to anon, authenticated;

-- ---------- sin sesión ----------
set role anon;
do $$ begin
  assert t_err('select vg_estado()') like 'permission denied%', 'anon no puede llamar a las funciones';
  assert t_err('select * from vg_clientes') like 'permission denied%', 'anon no lee la tabla';
end $$;
reset role;

set role authenticated;
do $$ begin
  perform set_config('request.jwt.claim.sub', '', false);
  assert t_err('select vg_estado()') = 'no_auth', 'sin sesión: no_auth';
  assert t_err('select * from vg_clientes') like 'permission denied%', 'tampoco con sesión se lee la tabla directo';
  assert t_err('insert into vg_clientes (owner, nombre) values (''aaaaaaaa-0000-4000-8000-000000000001'', ''x'')') like 'permission denied%', 'ni se escribe';
  assert t_err('select vg_yo()') like 'permission denied%', 'los ayudantes no se pueden llamar';
  assert t_err('select vg_cliente_upsert(''aaaaaaaa-0000-4000-8000-000000000001'', ''{}'', false)') like 'permission denied%', 'ni el de alta directa';
end $$;

-- ---------- Naty (A) ----------
do $$
declare r jsonb; r2 jsonb; s jsonb; cid uuid; cid2 uuid; vid uuid;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);

  -- consulta de alguien nuevo
  r := vg_registrar('{"cliente":{"nombre":"  Laura Pérez ","telefono":"+54 9 11 2345-6789","intereses":["Bifera","bifera"," "],"origen":"Publicidad"},
                      "movimiento":{"tipo":"consulta","fecha":"2026-10-01","producto":"Bifera","detalle":"Vio la publicidad de Instagram"}}');
  cid := (r->'cliente'->>'id')::uuid;
  assert r->'cliente'->>'nombre' = 'Laura Pérez', 'nombre sin espacios de más';
  assert r->'cliente'->>'telefono' = '5491123456789', 'teléfono solo dígitos';
  assert r->'cliente'->'intereses' = '["Bifera"]', 'intereses sin repetidos ni vacíos';
  assert not (r->>'yaEstaba')::boolean, 'era nueva';

  -- venta al mismo teléfono sin id: no duplica, suma el interés
  r2 := vg_registrar('{"cliente":{"nombre":"Laura","telefono":"5491123456789","intereses":["Cacerola 24"]},
                       "movimiento":{"tipo":"venta","fecha":"2026-10-05","producto":"Cacerola 24","medio":"credito","cuotas":12,"monto":"350000.555"}}');
  assert (r2->'cliente'->>'id')::uuid = cid, 'mismo cliente por teléfono';
  assert (r2->>'yaEstaba')::boolean, 'avisa que ya estaba';
  assert r2->'cliente'->>'nombre' = 'Laura Pérez', 'no pisa el nombre';
  assert r2->'cliente'->'intereses' = '["Bifera", "Cacerola 24"]', 'suma el interés nuevo';
  assert (r2->'movimiento'->>'cuotas')::int = 12 and (r2->'movimiento'->>'monto')::numeric = 350000.56, 'cuotas y monto redondeado';
  vid := (r2->'movimiento'->>'id')::uuid;

  -- en efectivo no hay cuotas
  r := vg_mov_agregar(jsonb_build_object('clienteId', cid, 'tipo', 'venta', 'producto', 'Sartén', 'medio', 'efectivo', 'cuotas', 6));
  assert r->>'cuotas' is null, 'efectivo: sin cuotas';
  assert (r->>'fecha')::date = current_date, 'sin fecha: hoy';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'venta', 'medio', 'credito', 'cuotas', 99))) = 'bad_cuotas', 'cuotas fuera de rango';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'venta', 'medio', 'bitcoin'))) = 'bad_medio', 'medio desconocido';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'venta', 'monto', -1))) = 'bad_monto', 'monto negativo';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'regalo'))) = 'bad_tipo', 'tipo desconocido';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'mensaje', 'fecha', (current_date + 10)::text))) = 'bad_fecha', 'fecha futura';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'mensaje', 'detalle', repeat('x', 1001)))) = 'largo:detalle', 'detalle largo';

  -- números de tarjeta: nunca
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'nota', 'detalle', 'pagó con 4111 1111 1111 1111 vto 12/29'))) = 'tarjeta', 'tarjeta en una nota';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'nota', 'detalle', 'amex 3782-822463-10005'))) = 'tarjeta', 'amex con guiones';
  assert t_err(format('select vg_cliente_guardar(%L)', jsonb_build_object('id', cid, 'nombre', 'Laura', 'nota', '5500005555555559'))) = 'tarjeta', 'tarjeta en la nota del cliente';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'nota', 'detalle', 'su hija: +54 9 11 2345-6789, dni 30.123.456'))) = 'ok', 'un teléfono o un DNI sí';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', cid, 'tipo', 'nota', 'detalle', '4111 1111 1111 1112'))) = 'ok', 'si no pasa Luhn no es tarjeta';

  -- cambiar datos
  r := vg_cliente_guardar(jsonb_build_object('id', cid, 'nombre', 'Laura Pérez', 'telefono', '5491123456789', 'intereses', '["Cacerola 24"]', 'cumple', '03-15', 'sinPromos', true));
  assert r->>'cumple' = '03-15' and (r->>'sinPromos')::boolean, 'cumple y no ofrecerle más';
  assert t_err(format('select vg_cliente_guardar(%L)', jsonb_build_object('id', cid, 'nombre', 'Laura', 'cumple', '13-40'))) = 'bad_cumple', 'cumple inválido';
  assert t_err(format('select vg_cliente_guardar(%L)', jsonb_build_object('id', cid, 'nombre', ' '))) = 'falta_nombre', 'sin nombre';
  assert t_err(format('select vg_cliente_guardar(%L)', jsonb_build_object('nombre', 'Corto', 'telefono', '123'))) = 'bad_tel', 'teléfono corto';

  -- dos clientes no pueden tener el mismo teléfono
  r := vg_cliente_guardar('{"nombre":"Marta","telefono":"5493511234567"}');
  cid2 := (r->>'id')::uuid;
  assert t_err(format('select vg_cliente_guardar(%L)', jsonb_build_object('id', cid2, 'nombre', 'Marta', 'telefono', '5491123456789'))) = 'tel_repetido', 'teléfono repetido al cambiar';
  assert t_err('select vg_cliente_guardar(''{"nombre":"Otra","telefono":"5493511234567"}'')') = 'tel_repetido', 'teléfono repetido al crear';

  -- importar: saltea los que ya están (también si se repiten en la misma tanda)
  r := vg_clientes_importar('[{"nombre":"Ana bifera","telefono":"5491100000001","intereses":["Bifera"]},
                              {"nombre":"Laura dup","telefono":"5491123456789"},
                              {"nombre":"Ana otra vez","telefono":"5491100000001"},
                              {"nombre":"Sin teléfono"}]');
  assert jsonb_array_length(r->'creados') = 2 and (r->>'repetidos')::int = 2, 'importa 2, saltea 2';
  assert t_err('select vg_clientes_importar(''{"nombre":"x"}'')') = 'bad_datos', 'importar pide una lista';

  -- avisos
  r := vg_aviso_marcar('cuota:' || vid || ':6', 'pospuesto', current_date + 7);
  assert r->>'estado' = 'pospuesto', 'pospuesto';
  r := vg_aviso_marcar('cuota:' || vid || ':6', 'descartado', null);
  assert r->>'hasta' is null, 'descartado no tiene fecha';
  assert t_err('select vg_aviso_marcar(''<script>'', ''descartado'', null)') = 'bad_clave', 'clave rara';
  assert t_err(format('select vg_aviso_marcar(%L, %L, %L)', 'seg:x', 'pospuesto', current_date - 1)) = 'bad_fecha', 'posponer al pasado';
  perform vg_aviso_quitar('cuota:' || vid || ':6');

  -- ajustes: solo lo conocido, validado
  r := vg_ajustes_guardar('{"productos":["Bifera","Cacerola 24","bifera"],"caracteristica":"0351","dias":{"seguimiento":5,"volver":2,"quieto":"x"},
                            "plantillas":{"cuota":"Hola {nombre}!","otra":"no"},"firma":"Naty","admin":true}');
  assert r->'productos' = '["Bifera", "Cacerola 24"]', 'productos sin repetidos';
  assert r->>'caracteristica' = '0351', 'característica';
  assert r->'dias' = '{"seguimiento": 5}', 'días fuera de rango no se guardan';
  assert r->'plantillas' = '{"cuota": "Hola {nombre}!"}', 'solo plantillas conocidas';
  assert not (r ? 'admin'), 'claves desconocidas afuera';

  s := vg_estado();
  assert jsonb_array_length(s->'clientes') = 4, 'cuatro clientes';
  assert jsonb_array_length(s->'movimientos') = 5, 'cinco movimientos';
  assert s->'ajustes'->>'firma' = 'Naty', 'ajustes en el estado';
end $$;

-- ---------- otra emprendedora (B) no ve ni toca nada de A ----------
do $$
declare a_cli uuid; a_mov uuid; s jsonb;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);
  s := vg_estado();
  a_cli := (s->'clientes'->0->>'id')::uuid;
  a_mov := (s->'movimientos'->0->>'id')::uuid;

  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', false);
  s := vg_estado();
  assert jsonb_array_length(s->'clientes') = 0 and jsonb_array_length(s->'movimientos') = 0, 'B no ve los clientes de A';
  assert s->'ajustes' = '{}', 'ni sus ajustes';
  assert t_err(format('select vg_mov_agregar(%L)', jsonb_build_object('clienteId', a_cli, 'tipo', 'mensaje'))) = 'no_existe', 'B no le agrega movimientos a un cliente de A';
  assert t_err(format('select vg_cliente_guardar(%L)', jsonb_build_object('id', a_cli, 'nombre', 'Hackeado'))) = 'no_existe', 'B no cambia un cliente de A';
  assert t_err(format('select vg_cliente_borrar(%L)', a_cli)) = 'no_existe', 'B no borra un cliente de A';
  assert t_err(format('select vg_mov_borrar(%L)', a_mov)) = 'no_existe', 'B no borra un movimiento de A';
  assert t_err(format('select vg_registrar(%L)', jsonb_build_object('cliente', jsonb_build_object('id', a_cli, 'nombre', 'x'), 'movimiento', '{"tipo":"consulta"}'::jsonb))) = 'no_existe', 'ni por registrar';
  -- el mismo teléfono puede estar en dos cuentas distintas
  s := vg_registrar('{"cliente":{"nombre":"Laura","telefono":"5491123456789"},"movimiento":{"tipo":"consulta"}}');
  assert not (s->>'yaEstaba')::boolean, 'para B es nueva';
  perform vg_borrar_todo();
  assert jsonb_array_length(vg_estado()->'clientes') = 0, 'B borró lo suyo';

  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false);
  s := vg_estado();
  assert jsonb_array_length(s->'clientes') = 4, 'A sigue con sus cuatro';
  assert (select x->>'nombre' from jsonb_array_elements(s->'clientes') x where (x->>'id')::uuid = a_cli) <> 'Hackeado', 'y sin cambios';

  -- borrar un cliente borra sus movimientos
  perform vg_cliente_borrar(a_cli);
  s := vg_estado();
  assert not exists (select 1 from jsonb_array_elements(s->'movimientos') x where (x->>'clienteId')::uuid = a_cli), 'movimientos en cascada';
  perform vg_borrar_todo();
  s := vg_estado();
  assert jsonb_array_length(s->'clientes') = 0 and s->'ajustes' = '{}', 'A borró todo';
end $$;
reset role;

-- Si se borra la cuenta (por ejemplo desde Tachán), se va todo lo de Vigente.
do $$ begin
  insert into public.vg_clientes (owner, nombre) values ('bbbbbbbb-0000-4000-8000-000000000002', 'Prueba');
  delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000002';
  assert not exists (select 1 from public.vg_clientes where owner = 'bbbbbbbb-0000-4000-8000-000000000002'), 'cascada desde la cuenta';
end $$;

\echo 'vigente.sql: todas las pruebas pasaron'
