import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../src/logic.js');

let seq = 0;
const C = (nombre, extra = {}) => ({ id: 'c' + ++seq, nombre, telefono: '54911' + String(10000000 + seq), intereses: [], origen: '', cumple: null, nota: '', sinPromos: false, ...extra });
const M = (c, tipo, fecha, extra = {}) => ({ id: 'm' + ++seq, clienteId: c.id, tipo, fecha, producto: '', medio: '', cuotas: null, monto: null, detalle: '', motivo: '', creado: fecha + 'T12:00:00Z', ...extra });
const S = (clientes, movimientos, avisos = [], ajustes = {}) => ({ clientes, movimientos, avisos, ajustes });
const hoyDe = (st, hoy) => L.avisos(st, hoy);
const tipos = r => r.activos.map(a => `${a.nombre}:${a.tipo}`);

test('teléfonos argentinos → dígitos para WhatsApp', () => {
  const casos = {
    '+54 9 11 2345-6789': '5491123456789',
    '011 15-2345-6789': '5491123456789',
    '11 15 2345 6789': '5491123456789',
    '1123456789': '5491123456789',
    '15-2345-6789': '5491123456789',   // con la característica por defecto (11)
    '2345-6789': '5491123456789',
    '0351 15 123-4567': '5493511234567',
    '351 155 123456': '5493515123456',  // 351 15 5123456
    '+54 351 123 4567': '5493511234567',
    '2944 15 123456': '5492944123456',  // característica de 4 cifras
    '+598 99 123 456': '59899123456',   // otro país
    '123': '',
    '': '',
  };
  for (const [raw, want] of Object.entries(casos)) assert.equal(L.normalizarTel(raw), want, raw);
  assert.equal(L.normalizarTel('15 123-4567', '351'), '5493511234567', 'con la característica de Córdoba');
  assert.equal(L.normalizarTel('4123-4567', '0351'), '', 'número local que no coincide con la característica');
  assert.equal(L.formatearTel('5491123456789'), '+54 9 11 2345-6789');
  assert.equal(L.formatearTel('5493511234567'), '+54 9 351 123-4567');
  assert.equal(L.linkWa('5491123456789', '¡Hola Ana! ¿Cómo va?'), 'https://wa.me/5491123456789?text=%C2%A1Hola%20Ana!%20%C2%BFC%C3%B3mo%20va%3F');
});

test('fechas: meses enteros, sumar meses y «hace»', () => {
  assert.equal(L.mesesEntre('2026-03-10', '2026-04-09'), 0);
  assert.equal(L.mesesEntre('2026-03-10', '2026-04-10'), 1);
  assert.equal(L.mesesEntre('2026-01-31', '2026-02-28'), 1, 'fin de mes');
  assert.equal(L.sumarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(L.sumarMeses('2026-11-15', 3), '2027-02-15');
  assert.equal(L.hace('2026-10-19', '2026-10-19'), 'hoy');
  assert.equal(L.hace('2026-10-18', '2026-10-19'), 'ayer');
  assert.equal(L.hace('2026-10-16', '2026-10-19'), 'hace 3 días');
  assert.equal(L.hace('2026-09-28', '2026-10-19'), 'hace 3 semanas');
  assert.equal(L.hace('2026-07-10', '2026-10-19'), 'hace 3 meses');
  assert.equal(L.proximoCumple('10-19', '2026-10-19'), '2026-10-19');
  assert.equal(L.proximoCumple('10-18', '2026-10-19'), '2027-10-18');
  assert.equal(L.proximoCumple('02-29', '2026-10-19'), '2027-02-28', 'bisiesto en año común');
});

test('hitos de cuotas como lo contó Naty', () => {
  assert.deepEqual(L.hitos(12), [6, 9, 12]);
  assert.deepEqual(L.hitos(18), [9, 14, 18]);
  assert.deepEqual(L.hitos(6), [3, 5, 6]);
  assert.deepEqual(L.hitos(3), [2, 3]);
  assert.deepEqual(L.hitos(2), [2]);
  assert.deepEqual(L.hitos(1), []);
  assert.deepEqual(L.hitos(null), []);
});

test('consulta sin venta: seguimiento a los 3 días, volver a ofrecer al mes', () => {
  const ana = C('ana pérez', { intereses: ['Bifera'] });
  const q = M(ana, 'consulta', '2026-10-01', { producto: 'Bifera' });
  const st = S([ana], [q]);
  assert.deepEqual(tipos(hoyDe(st, '2026-10-03')), [], 'antes de los 3 días, nada');
  assert.equal(hoyDe(st, '2026-10-03').proximos[0].tipo, 'seg', 'pero aparece en próximos');
  const r = hoyDe(st, '2026-10-04');
  assert.deepEqual(tipos(r), ['ana pérez:seg']);
  assert.equal(r.activos[0].titulo, 'Consultó hace 3 días y no compró');
  assert.match(r.activos[0].mensaje, /^¡Hola Ana! .*tu consulta de bifera\./);
  assert.deepEqual(tipos(hoyDe(st, '2026-10-31')), ['ana pérez:volver'], 'a los 30 días cambia a volver a ofrecer');
  assert.deepEqual(tipos(hoyDe(st, '2026-12-15')), [], 'después de un mes más, se apaga');
  // si le escribió, se da por hecho
  const st2 = S([ana], [q, M(ana, 'mensaje', '2026-10-05')]);
  assert.deepEqual(tipos(hoyDe(st2, '2026-10-06')), []);
  assert.deepEqual(tipos(hoyDe(st2, '2026-10-31')), ['ana pérez:volver'], 'el de volver a ofrecer sigue');
  // si compró después, no hay seguimiento de esa consulta
  const st3 = S([ana], [q, M(ana, 'venta', '2026-10-02', { producto: 'Bifera', medio: 'efectivo' })]);
  assert.ok(!tipos(hoyDe(st3, '2026-10-04')).some(t => t.endsWith(':seg')));
  // una nota no cuenta como contacto
  const st4 = S([ana], [q, M(ana, 'nota', '2026-10-05', { detalle: 'llamar a la tarde' })]);
  assert.deepEqual(tipos(hoyDe(st4, '2026-10-06')), ['ana pérez:seg']);
});

test('venta en 12 cuotas: postventa, cuota 6, 9 y 12', () => {
  const marta = C('Marta');
  const v = M(marta, 'venta', '2026-01-10', { producto: 'Cacerola 24', medio: 'credito', cuotas: 12 });
  const st = S([marta], [v]);
  assert.deepEqual(tipos(hoyDe(st, '2026-01-20')), ['Marta:post']);
  assert.match(hoyDe(st, '2026-01-20').activos[0].mensaje, /con tu cacerola 24\?/);
  assert.deepEqual(tipos(hoyDe(st, '2026-03-10')), [], 'entre medio, nada');
  const c6 = hoyDe(st, '2026-07-12');
  assert.deepEqual(tipos(c6), ['Marta:cuota']);
  assert.equal(c6.activos[0].titulo, 'Va por la cuota 6 de 12');
  assert.equal(c6.activos[0].clave, `cuota:${v.id}:6`);
  assert.equal(hoyDe(st, '2026-10-15').activos[0].titulo, 'Va por la cuota 9 de 12');
  assert.equal(hoyDe(st, '2027-01-11').activos[0].tipo, 'fin');
  // si le escribió en la cuota 6, el de la 9 igual aparece
  const st2 = S([marta], [v, M(marta, 'mensaje', '2026-07-12')]);
  assert.deepEqual(tipos(hoyDe(st2, '2026-07-13')), []);
  assert.equal(hoyDe(st2, '2026-10-12').activos[0].titulo, 'Va por la cuota 9 de 12');
  // si le mandó una promo 10 días antes de la cuota 6, no le ofrece otra vez
  const st4 = S([marta], [v, M(marta, 'promo', '2026-07-01', { motivo: 'Día del Padre' })]);
  assert.deepEqual(tipos(hoyDe(st4, '2026-07-12')), [], 'respiro de 2 semanas');
  const st5 = S([marta], [v, M(marta, 'promo', '2026-06-20')]);
  assert.deepEqual(tipos(hoyDe(st5, '2026-07-12')), ['Marta:cuota'], 'hace más de 2 semanas sí');
  // si volvió a comprar, mandan los avisos de la venta nueva
  const st3 = S([marta], [v, M(marta, 'venta', '2026-06-01', { producto: 'Bifera', medio: 'efectivo' })]);
  assert.deepEqual(tipos(hoyDe(st3, '2026-07-12')), [], 'no hay cuota de la vieja: la nueva es en efectivo');
});

test('sin contacto: solo a quien alguna vez compró', () => {
  const a = C('Ana'), b = C('Bea'), imp = C('Importada');
  const st = S([a, b, imp], [M(a, 'venta', '2026-01-05', { medio: 'efectivo' }), M(b, 'consulta', '2026-01-05')]);
  const r = hoyDe(st, '2026-06-01');
  assert.deepEqual(tipos(r), ['Ana:quieto']);
  assert.equal(r.activos[0].titulo, 'No hablan desde hace 4 meses');
});

test('cumple: el día (el anterior, en próximos); se da por hecho solo con el saludo', () => {
  const ana = C('Ana', { cumple: '10-20' });
  const st = S([ana], []);
  assert.deepEqual(tipos(hoyDe(st, '2026-10-19')), [], 'no se saluda un día antes');
  assert.equal(hoyDe(st, '2026-10-19').proximos[0].tipo, 'cumple');
  assert.equal(hoyDe(st, '2026-10-19').proximos[0].titulo, 'Mañana cumple años');
  assert.equal(hoyDe(st, '2026-10-20').activos[0].titulo, 'Hoy cumple años');
  assert.deepEqual(tipos(hoyDe(st, '2026-10-21')), []);
  const clave = hoyDe(st, '2026-10-20').activos[0].clave;
  assert.deepEqual(tipos(hoyDe(S([ana], [M(ana, 'mensaje', '2026-10-19')]), '2026-10-20')), ['Ana:cumple'], 'otro mensaje no cuenta');
  assert.deepEqual(tipos(hoyDe(S([ana], [M(ana, 'mensaje', '2026-10-20', { motivo: clave })]), '2026-10-20')), []);
});

test('un aviso por persona, el más importante', () => {
  const ana = C('Ana', { cumple: '07-12' });
  const v = M(ana, 'venta', '2026-01-10', { medio: 'credito', cuotas: 12 });
  const r = hoyDe(S([ana], [v]), '2026-07-12');
  assert.deepEqual(tipos(r), ['Ana:cumple']);
});

test('no ofrecerle más: sin avisos de venta, con cumple y postventa', () => {
  const ana = C('Ana', { sinPromos: true, cumple: '07-12' });
  const v = M(ana, 'venta', '2026-01-10', { medio: 'credito', cuotas: 12 });
  assert.deepEqual(tipos(hoyDe(S([ana], [v]), '2026-01-20')), ['Ana:post']);
  assert.deepEqual(tipos(hoyDe(S([ana], [v]), '2026-07-13')), [], 'la cuota 6 no aparece');
  assert.deepEqual(tipos(hoyDe(S([ana], [v]), '2026-07-12')), ['Ana:cumple']);
  const q = C('Bea', { sinPromos: true });
  assert.deepEqual(tipos(hoyDe(S([q], [M(q, 'consulta', '2026-10-01')]), '2026-10-05')), []);
});

test('posponer y descartar', () => {
  const ana = C('Ana');
  const q = M(ana, 'consulta', '2026-10-01');
  const clave = `seg:${q.id}`;
  const pos = hoyDe(S([ana], [q], [{ clave, estado: 'pospuesto', hasta: '2026-10-10' }]), '2026-10-05');
  assert.deepEqual(tipos(pos), []);
  assert.equal(pos.proximos[0].desde, '2026-10-10');
  assert.deepEqual(tipos(hoyDe(S([ana], [q], [{ clave, estado: 'pospuesto', hasta: '2026-10-10' }]), '2026-10-10')), ['Ana:seg']);
  assert.deepEqual(tipos(hoyDe(S([ana], [q], [{ clave, estado: 'descartado', hasta: null }]), '2026-10-05')), []);
});

test('los días se cambian en ajustes', () => {
  const ana = C('Ana');
  const st = S([ana], [M(ana, 'consulta', '2026-10-01')], [], { dias: { seguimiento: 1 } });
  assert.deepEqual(tipos(hoyDe(st, '2026-10-02')), ['Ana:seg']);
  const aj = L.ajustesDe({ dias: { seguimiento: 5 }, plantillas: { seg: 'x' }, productos: [] });
  assert.equal(aj.dias.volver, 30, 'lo que no se cambió queda por defecto');
  assert.equal(aj.productos.length, L.DEFAULTS.productos.length, 'sin productos, los de siempre');
});

test('plantillas', () => {
  assert.equal(L.llenar('¡Hola {nombre}! Tu {producto}.', { nombre: 'Ana', producto: 'Bifera' }), '¡Hola Ana! Tu Bifera.');
  assert.equal(L.llenar('Hola {nombre}  {otra}', { nombre: 'Ana' }), 'Hola Ana {otra}');
  assert.equal(L.primerNombre('  laura bifera '), 'Laura');
  const sinProd = C('Ana');
  const r = hoyDe(S([sinProd], [M(sinProd, 'consulta', '2026-10-01')]), '2026-10-04');
  assert.match(r.activos[0].mensaje, /Te escribo por tu consulta\. ¿Pudiste/, 'sin producto se saca el pedazo entre corchetes');
  assert.equal(L.llenar('Hola[ {nombre}], ¿qué tal[ tu {producto}]?', { nombre: 'Ana', producto: '' }), 'Hola Ana, ¿qué tal?');
  assert.equal(L.llenar('[Corchete sin variable]', {}), 'Corchete sin variable');
  assert.equal(L.enFrase('Cacerola 24 + Bifera'), 'cacerola 24 y bifera');
  assert.equal(L.enFrase('WOK'), 'WOK', 'las siglas quedan');
});

test('tarjetas: se detectan con Luhn, teléfonos y DNI no', () => {
  assert.ok(L.pareceTarjeta('4111 1111 1111 1111'));
  assert.ok(L.pareceTarjeta('pagó con 5500-0055-5555-5559 en 12'));
  assert.ok(L.pareceTarjeta('3782 822463 10005'));
  assert.ok(!L.pareceTarjeta('4111 1111 1111 1112'));
  assert.ok(!L.pareceTarjeta('+54 9 11 2345-6789'));
  assert.ok(!L.pareceTarjeta('DNI 30.123.456, cuotas 12'));
  assert.ok(!L.pareceTarjeta(''));
});

test('montos como se escriben acá', () => {
  assert.equal(L.leerMonto('350.000'), 350000);
  assert.equal(L.leerMonto('$ 350.000,50'), 350000.5);
  assert.equal(L.leerMonto('350000'), 350000);
  assert.equal(L.leerMonto('1.234.567'), 1234567);
  assert.equal(L.leerMonto(''), null);
  assert.equal(L.plata(350000), '$350.000');
});

test('promos: a quién', () => {
  const a = C('Ana', { intereses: ['Bifera'] });
  const b = C('Bea', { intereses: ['Wok'] });
  const c = C('Caro');
  const d = C('Dani', { sinPromos: true, intereses: ['Bifera'] });
  const e = C('Eli', { telefono: '' , intereses: ['Bifera'] });
  const movs = [
    M(a, 'consulta', '2026-09-01', { producto: 'Bifera' }),
    M(b, 'venta', '2026-05-01', { producto: 'Wok', medio: 'credito', cuotas: 6 }),
    M(c, 'venta', '2025-01-01', { producto: 'Cacerola 24', medio: 'credito', cuotas: 12 }),
    M(a, 'promo', '2026-10-10', { motivo: 'Día de la Madre' }),
  ];
  const st = S([a, b, c, d, e], movs);
  const n = f => L.segmento(st, f, '2026-10-19').map(x => x.cliente.nombre);
  assert.deepEqual(n({}), ['Ana', 'Bea', 'Caro'], 'sin los que no quieren ni los que no tienen teléfono');
  assert.deepEqual(n({ intereses: ['bifera'] }), ['Ana']);
  assert.deepEqual(n({ estado: 'consultaron' }), ['Ana']);
  assert.deepEqual(n({ estado: 'compraron' }), ['Bea', 'Caro']);
  assert.deepEqual(n({ estado: 'cuotas' }), ['Bea']);
  assert.deepEqual(n({ estado: 'pagaron' }), ['Caro']);
  assert.deepEqual(n({ sinPromoDias: 30 }), ['Bea', 'Caro'], 'Ana recibió una promo hace 9 días');
  assert.equal(L.segmento(st, { intereses: ['Cacerola 24'] }, '2026-10-19')[0].producto, 'Cacerola 24', 'lo que compró también cuenta');
});

test('números del mes y de dónde vienen las ventas', () => {
  const a = C('Ana', { origen: 'Publicidad' }), b = C('Bea', { origen: 'Recomendación' }), c = C('Caro', { origen: 'Publicidad' });
  const st = S([a, b, c], [
    M(a, 'consulta', '2026-10-02', { producto: 'Bifera' }), M(a, 'venta', '2026-10-05', { medio: 'credito', cuotas: 12, monto: 300000 }),
    M(b, 'venta', '2026-10-08', { medio: 'efectivo' }), M(c, 'consulta', '2026-10-09', { producto: 'Bifera' }),
    M(c, 'consulta', '2026-09-30', { producto: 'Wok' }), M(a, 'mensaje', '2026-10-10'),
  ]);
  const r = L.resumenMes(st, '2026-10-19');
  assert.equal(r.consultas, 2);
  assert.equal(r.ventas, 2);
  assert.equal(r.enCuotas, 1);
  assert.equal(r.monto, 300000);
  assert.equal(r.mensajes, 1);
  assert.deepEqual(r.topProductos[0], ['Bifera', 2]);
  assert.deepEqual(r.porOrigen[0], ['Publicidad', { consultas: 2, ventas: 1 }]);
});

test('vCard de Android con tildes (quoted-printable) y varios teléfonos', () => {
  const vcf = [
    'BEGIN:VCARD', 'VERSION:2.1', 'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:P=C3=A9rez;Laura;;;',
    'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Laura P=C3=A9rez bifera', 'TEL;CELL:+54 9 11 2345-6789', 'TEL;HOME:4555-1234', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Gómez;Marta;;;', 'TEL;TYPE=CELL:011 15-3333-4444', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Sin teléfono', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Nombre muy largo que sigue', ' en otra línea', 'item1.TEL:+5493511234567', 'END:VCARD',
  ].join('\r\n');
  const r = L.parsearVCF(vcf);
  assert.equal(r.length, 4);
  assert.equal(r[0].nombre, 'Laura Pérez bifera');
  assert.deepEqual(r[0].telefonos, ['+54 9 11 2345-6789', '4555-1234']);
  assert.equal(r[1].nombre, 'Marta Gómez');
  assert.equal(r[3].nombre, 'Nombre muy largo que sigueen otra línea', 'la línea doblada se une sin el espacio de la sangría');
  assert.deepEqual(r[3].telefonos, ['+5493511234567']);
});

test('CSV de Google Contactos y uno simple con punto y coma', () => {
  const g = 'First Name,Middle Name,Last Name,Phone 1 - Label,Phone 1 - Value\nLaura,,"Pérez, bifera",Mobile,+54 9 11 2345-6789 ::: 4555-1234\nMarta,,,Mobile,011 15 3333 4444\n';
  const r = L.parsearCSV(g);
  assert.equal(r.length, 2);
  assert.equal(r[0].nombre, 'Laura Pérez, bifera');
  assert.deepEqual(r[0].telefonos, ['+54 9 11 2345-6789', '4555-1234']);
  const s = L.parsearCSV('Nombre;Teléfono\nAna wok;1122223333\n');
  assert.deepEqual(s, [{ nombre: 'Ana wok', telefonos: ['1122223333'] }]);
  assert.deepEqual(L.parsearCSV('a;b\n1;2'), [], 'sin columna de teléfono');
});

test('importar: sugiere el interés por el nombre, saltea repetidos y marca los que ya están', () => {
  const aj = L.ajustesDe({});
  assert.deepEqual(L.sugerirIntereses('Laura bifera', aj.productos), ['Bifera']);
  assert.deepEqual(L.sugerirIntereses('Marta Cacerola 24', aj.productos), ['Cacerola 24']);
  assert.deepEqual(L.sugerirIntereses('Marta cacerola', aj.productos), [], 'cacerola sola: ¿20 o 24?');
  assert.deepEqual(L.sugerirIntereses('Ana SARTEN', aj.productos), ['Sartén']);
  assert.deepEqual(L.sugerirIntereses('Wokolina', aj.productos), [], 'palabra entera');
  const filas = L.aImportar([
    { nombre: 'Laura bifera', telefonos: ['+54 9 11 2345-6789'] },
    { nombre: 'Laura otra vez', telefonos: ['011 15 2345 6789'] },
    { nombre: 'Tía Coca', telefonos: ['11 4444 5555'] },
    { nombre: 'Sin número', telefonos: [] },
    { nombre: 'Ya cargada', telefonos: ['1166667777'] },
  ], aj, ['5491166667777']);
  assert.deepEqual(filas.map(f => [f.nombre, f.sugerido, f.yaEsta]), [['Laura bifera', true, false], ['Tía Coca', false, false], ['Ya cargada', false, true]]);
});

test('descargar: CSV sin fórmulas', () => {
  const a = C('=HYPERLINK("x")', { nota: '+1 llamar' });
  const out = L.csvClientes(S([a], [M(a, 'venta', '2026-10-01', { producto: 'Wok', medio: 'credito', cuotas: 6 })]), '2026-10-19');
  assert.ok(out.startsWith('﻿"Nombre"'));
  assert.ok(out.includes(`"'=HYPERLINK(""x"")"`), 'el = va con apóstrofo');
  assert.ok(out.includes(`"'+1 llamar"`));
  assert.ok(out.includes('"Tarjeta de crédito"'));
  const mv = L.csvMovimientos(S([a], [M(a, 'consulta', '2026-10-01', { producto: 'Wok' })]));
  assert.equal(mv.split('\r\n').length, 2);
});

test('situación para la lista', () => {
  const a = C('Ana');
  const st = [M(a, 'venta', '2026-04-10', { medio: 'credito', cuotas: 12 })];
  assert.deepEqual(L.situacion(a, st, '2026-10-19').texto, 'Cuota 6 de 12');
  assert.equal(L.situacion(a, [], '2026-10-19').estado, 'contacto');
  assert.equal(L.situacion(a, [M(a, 'consulta', '2026-10-16')], '2026-10-19').texto, 'Consultó hace 3 días');
});
