// ---------- Vigente: reglas sin pantallas (se prueban con node --test) ----------
// Fechas como texto «AAAA-MM-DD» (la fecha del celular, sin horas), teléfonos como dígitos para WhatsApp («5491123456789»).

const DEFAULTS = {
  productos: ["Cacerola 24", "Cacerola 20", "Bifera", "Sartén", "Wok", "Combo"],
  origenes: ["Publicidad", "Instagram", "Facebook", "Recomendación", "Feria o reunión", "Otro"],
  caracteristica: "11",
  dias: { seguimiento: 3, volver: 30, postventa: 10, quieto: 90 },
  plantillas: {
    seguimiento: "¡Hola {nombre}! ¿Cómo estás? Te escribo por tu consulta[ de {producto}]. ¿Te quedó alguna duda? Si querés te paso precios y formas de pago 😊",
    volver: "¡Hola {nombre}! ¿Cómo va? Hace un tiempo me consultaste[ por {producto}]. Este mes hay novedades y opciones de pago, ¿te cuento?",
    postventa: "¡Hola {nombre}! ¿Cómo te va con tu {producto}? Si tenés alguna duda de uso, escribime. Y si te gustó, me ayudás un montón recomendándome 🙌",
    cuota: "¡Hola {nombre}! ¿Cómo estás? ¿Qué tal tu {producto}? Te cuento que hay promos nuevas, por si querés sumar otra pieza a tu cocina 😊",
    fin: "¡Hola {nombre}! ¡Ya terminaste de pagar tu {producto}! 🎉 Si querés sumar otra pieza, tengo opciones nuevas para contarte.",
    quieto: "¡Hola {nombre}! ¿Cómo estás? Hace mucho que no hablamos. ¿Cómo te va con tus piezas? Cuando quieras te cuento las novedades.",
    cumple: "¡Feliz cumple, {nombre}! 🎂 Que tengas un hermoso día.",
    promo: "¡Hola {nombre}! Te escribo porque esta semana hay una promo[ en {producto}] que te puede interesar. ¿Te paso los detalles?",
  },
};
const MEDIOS = [
  ["credito", "Tarjeta de crédito"], ["debito", "Débito"], ["efectivo", "Efectivo"],
  ["transferencia", "Transferencia"], ["mercadopago", "Mercado Pago"], ["otro", "Otro"],
];
const CUOTAS = [1, 3, 6, 9, 10, 12, 18, 24];
const CON_CUOTAS = new Set(["credito", "mercadopago"]);
const TIPOS = { consulta: "Consulta", venta: "Venta", mensaje: "Mensaje", promo: "Promo", nota: "Nota" };
// Orden de importancia: si una persona tiene varios avisos, se muestra el primero.
const PRIORIDAD = { cumple: 0, seg: 1, post: 2, fin: 3, cuota: 4, volver: 5, quieto: 6 };
const PLANTILLA = { cumple: "cumple", seg: "seguimiento", post: "postventa", fin: "fin", cuota: "cuota", volver: "volver", quieto: "quieto" };
const DE_VENTA = new Set(["seg", "volver", "cuota", "fin", "quieto"]); // los que salen con «No ofrecerle más»

function ajustesDe(raw) {
  const r = raw || {};
  const lista = (v, d) => (Array.isArray(v) && v.length ? v.slice() : d.slice());
  return {
    productos: lista(r.productos, DEFAULTS.productos),
    origenes: lista(r.origenes, DEFAULTS.origenes),
    caracteristica: /^\d{2,4}$/.test(r.caracteristica || "") ? r.caracteristica : DEFAULTS.caracteristica,
    dias: { ...DEFAULTS.dias, ...(r.dias || {}) },
    plantillas: { ...DEFAULTS.plantillas, ...(r.plantillas || {}) },
  };
}

// ---------- fechas ----------
const pad = n => String(n).padStart(2, "0");
const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoyISO = (d = new Date()) => isoDe(d);
const okISO = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(utc(s));
function utc(s) { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d); }
const desdeUtc = t => new Date(t).toISOString().slice(0, 10);
const sumarDias = (s, n) => desdeUtc(utc(s) + n * 864e5);
const diasEntre = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
function sumarMeses(s, n) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const fin = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(Math.min(d, fin))}`;
}
// Meses enteros entre dos fechas (del 10/3 al 9/4 es 0; al 10/4 es 1).
function mesesEntre(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  let n = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1 && sumarMeses(a, n) > b) n--;
  return n;
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fechaCorta(s, hoy) {
  const [y, m, d] = s.split("-").map(Number);
  const h = hoy ? hoy.slice(0, 4) : String(y);
  return `${d} de ${MESES[m - 1]}${String(y) === h ? "" : ` de ${y}`}`;
}
function hace(s, hoy) {
  const n = diasEntre(s, hoy);
  if (n <= 0) return n === 0 ? "hoy" : `en ${-n === 1 ? "1 día" : `${-n} días`}`;
  if (n === 1) return "ayer";
  if (n < 14) return `hace ${n} días`;
  if (n < 60) return `hace ${Math.round(n / 7)} semanas`;
  const m = mesesEntre(s, hoy);
  if (m < 24) return `hace ${m} meses`;
  return `hace ${Math.floor(m / 12)} años`;
}
// Cumple: «MM-DD» → la próxima fecha (hoy incluido). El 29/2 se festeja el 28 en los años no bisiestos.
function proximoCumple(mmdd, hoy) {
  if (!/^\d{2}-\d{2}$/.test(mmdd || "")) return null;
  const en = y => {
    const [m, d] = mmdd.split("-").map(Number);
    const fin = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${pad(m)}-${pad(Math.min(d, fin))}`;
  };
  const y = Number(hoy.slice(0, 4));
  const este = en(y);
  return este >= hoy ? este : en(y + 1);
}

// ---------- teléfonos (Argentina) ----------
// Saca el «15» de un número nacional de 12 dígitos (característica de 2, 3 o 4 + 15 + abonado).
function sin15(r) {
  if (r.length !== 12) return r;
  if (r.startsWith("11")) return r.slice(2, 4) === "15" ? r.slice(0, 2) + r.slice(4) : r;
  for (const L of [3, 4]) if (r.slice(L, L + 2) === "15") return r.slice(0, L) + r.slice(L + 2);
  return r;
}
// Cualquier forma de escribir un celular → dígitos para wa.me. "" si no se entiende.
function normalizarTel(raw, car = DEFAULTS.caracteristica) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    let r = d.slice(2);
    if (r.startsWith("9")) r = r.slice(1);
    if (r.startsWith("0")) r = r.slice(1);
    r = sin15(r);
    if (r.length === 10) return "549" + r;
    return "";
  }
  if (d.startsWith("0")) {
    const r = sin15(d.slice(1));
    return r.length === 10 ? "549" + r : "";
  }
  const c = String(car || DEFAULTS.caracteristica).replace(/^0+/, "");
  const local = 10 - c.length;
  // ninguna característica empieza con 15: «15 2345-6789» es un celular local
  if (d.length === local + 2 && d.startsWith("15")) return "549" + c + d.slice(2);
  if (d.length === 12) { const r = sin15(d); if (r.length === 10) return "549" + r; }
  if (d.length === 10) return "549" + d;
  if (d.length === local) return "549" + c + d;
  if (d.length >= 11 && d.length <= 15) return d; // de otro país, con su código
  return "";
}
function formatearTel(t) {
  const d = String(t || "");
  if (/^549\d{10}$/.test(d)) {
    const n = d.slice(3);
    if (n.startsWith("11")) return `+54 9 11 ${n.slice(2, 6)}-${n.slice(6)}`;
    return `+54 9 ${n.slice(0, 3)} ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  return d ? "+" + d : "";
}
const linkWa = (tel, texto) => `https://wa.me/${tel}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;

// ---------- textos ----------
const sinTildes = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function primerNombre(nombre) {
  const w = String(nombre || "").trim().split(/\s+/)[0] || "";
  return w ? w.charAt(0).toLocaleUpperCase("es") + w.slice(1) : "";
}
// {nombre}, {producto}, {cuota}, {cuotas}. Lo que va entre corchetes se saca si la variable de adentro está vacía:
// «tu consulta[ de {producto}]» queda «tu consulta» si no se sabe el producto.
function llenar(tpl, v) {
  const val = k => (v[k] == null ? "" : String(v[k]));
  return String(tpl || "")
    .replace(/\[([^\[\]]*)\]/g, (_, dentro) => (/\{(nombre|producto|cuota|cuotas)\}/.test(dentro) && [...dentro.matchAll(/\{(\w+)\}/g)].some(m => !val(m[1])) ? "" : dentro))
    .replace(/\{(nombre|producto|cuota|cuotas)\}/g, (_, k) => val(k))
    .replace(/[ \t]{2,}/g, " ").replace(/ ([.,!?])/g, "$1").trim();
}
// «Cacerola 24 + Bifera» → «cacerola 24 y bifera», para que se lea bien en medio de una frase.
const enFrase = p => String(p || "").split(/\s*\+\s*/).filter(Boolean)
  .map(x => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(x) ? x.charAt(0).toLocaleLowerCase("es") + x.slice(1) : x))
  .join(" y ");
// ¿Parece un número de tarjeta? 15 a 19 dígitos seguidos (con espacios, puntos o guiones) que pasan Luhn. Igual que en la base.
function pareceTarjeta(t) {
  const re = /\d(?:[ .-]?\d){14,18}/g;
  let m;
  while ((m = re.exec(String(t || "")))) {
    const d = m[0].replace(/\D/g, "");
    if (d.length < 15 || d.length > 19) continue;
    let s = 0;
    for (let i = 0; i < d.length; i++) {
      let x = Number(d[d.length - 1 - i]);
      if (i % 2) { x *= 2; if (x > 9) x -= 9; }
      s += x;
    }
    if (s % 10 === 0) return true;
  }
  return false;
}
const plata = n => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
function leerMonto(s) {
  const t = String(s || "").replace(/[^\d,.]/g, "");
  if (!t) return null;
  // «350.000» y «350000,50» como se escriben acá; «350000.5» también
  const coma = t.lastIndexOf(","), punto = t.lastIndexOf(".");
  let n;
  if (coma > -1) n = Number(t.slice(0, coma).replace(/\./g, "") + "." + t.slice(coma + 1));
  else if (punto > -1 && t.length - punto - 1 === 3) n = Number(t.replace(/\./g, ""));
  else n = Number(t);
  return isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n * 100) / 100 : null;
}

// ---------- datos del cliente ----------
function indice(state) {
  const porCliente = new Map();
  for (const c of state.clientes) porCliente.set(c.id, []);
  for (const m of state.movimientos) { const l = porCliente.get(m.clienteId); if (l) l.push(m); }
  for (const l of porCliente.values()) l.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.creado || "") < String(b.creado || "") ? -1 : 1));
  return porCliente;
}
const ultimo = (movs, tipo) => { for (let i = movs.length - 1; i >= 0; i--) if (movs[i].tipo === tipo) return movs[i]; return null; };
const contactos = movs => movs.filter(m => m.tipo !== "nota");
function hitos(n) {
  if (!(n >= 2)) return [];
  return [...new Set([Math.round(n / 2), Math.round((n * 3) / 4), n])].filter(k => k >= 2 && k <= n).sort((a, b) => a - b);
}
const cuotaActual = (v, hoy) => Math.max(0, Math.min(v.cuotas, mesesEntre(v.fecha, hoy)));
// Resumen de una persona para la lista y la ficha.
function situacion(c, movs, hoy) {
  const v = ultimo(movs, "venta"), q = ultimo(movs, "consulta");
  const cont = contactos(movs);
  const ultima = cont.length ? cont[cont.length - 1].fecha : null;
  let estado = "contacto", texto = "Sin movimientos";
  if (v && v.cuotas >= 2 && sumarMeses(v.fecha, v.cuotas) > hoy) {
    estado = "cuotas";
    const k = cuotaActual(v, hoy);
    texto = k ? `Cuota ${k} de ${v.cuotas}` : `${v.cuotas} cuotas, arranca`;
  } else if (v) { estado = "compro"; texto = `Compró ${hace(v.fecha, hoy)}`; }
  else if (q) { estado = "consulto"; texto = `Consultó ${hace(q.fecha, hoy)}`; }
  return { estado, texto, venta: v, consulta: q, ultima };
}

// ---------- avisos ----------
// Todos los avisos posibles de una persona, con desde/hasta. Después se filtran por hoy, hechos, pospuestos y descartados.
function candidatos(c, movs, aj, hoy) {
  const out = [];
  const add = (tipo, clave, desde, hasta, extra) => out.push({ tipo, clave, clienteId: c.id, desde, hasta, ...extra });
  const cb = proximoCumple(c.cumple, sumarDias(hoy, -1));
  if (cb) add("cumple", `cumple:${c.id}:${cb.slice(0, 4)}`, cb, cb, { dia: cb });
  const v = ultimo(movs, "venta");
  if (v) {
    const d = sumarDias(v.fecha, aj.dias.postventa);
    add("post", `post:${v.id}`, d, sumarDias(d, 29), { mov: v });
    for (const k of hitos(v.cuotas)) {
      const d2 = sumarMeses(v.fecha, k);
      add(k === v.cuotas ? "fin" : "cuota", `cuota:${v.id}:${k}`, d2, sumarDias(d2, 29), { mov: v, k, n: v.cuotas });
    }
    const cont = contactos(movs);
    const L = cont.length ? cont[cont.length - 1].fecha : v.fecha;
    add("quieto", `quieto:${c.id}:${L.replace(/-/g, "")}`, sumarDias(L, aj.dias.quieto), "9999-12-31", { ultima: L });
  }
  const q = ultimo(movs, "consulta");
  if (q && !(v && v.fecha >= q.fecha)) {
    const fin = sumarDias(q.fecha, aj.dias.volver);
    add("seg", `seg:${q.id}`, sumarDias(q.fecha, aj.dias.seguimiento), sumarDias(fin, -1), { mov: q });
    add("volver", `volver:${q.id}`, fin, sumarDias(fin, 29), { mov: q });
  }
  return out;
}
// Hecho: hubo contacto desde el día del aviso. El cumple solo se da por hecho con el saludo.
// Para los de venta, también si le escribió en las 2 semanas anteriores (después de lo que lo originó):
// así nadie recibe una promo y a los pocos días otro ofrecimiento (lo pidió la «clienta» del consejo).
const RESPIRO = 14;
function hecho(a, movs) {
  if (a.tipo === "cumple") return movs.some(m => m.motivo === a.clave);
  let desde = a.desde;
  if (DE_VENTA.has(a.tipo)) {
    const pausa = sumarDias(a.desde, -RESPIRO), tras = a.mov ? sumarDias(a.mov.fecha, 1) : a.desde;
    desde = pausa > tras ? pausa : tras;
    if (desde > a.desde) desde = a.desde;
  }
  return movs.some(m => m.tipo !== "nota" && m !== a.mov && (m.fecha >= desde || m.motivo === a.clave));
}
function avisos(state, hoy, ajustesRaw) {
  const aj = ajustesDe(ajustesRaw || state.ajustes);
  const marcas = new Map((state.avisos || []).map(a => [a.clave, a]));
  const idx = indice(state);
  const activos = [], proximos = [];
  const semana = sumarDias(hoy, 7);
  for (const c of state.clientes) {
    const movs = idx.get(c.id) || [];
    let mejor = null, prox = null;
    for (const a of candidatos(c, movs, aj, hoy)) {
      if (c.sinPromos && DE_VENTA.has(a.tipo)) continue;
      if (hecho(a, movs)) continue;
      const mk = marcas.get(a.clave);
      if (mk && mk.estado === "descartado") continue;
      let desde = a.desde;
      if (mk && mk.estado === "pospuesto" && mk.hasta > desde) desde = mk.hasta;
      if (desde > a.hasta && !(mk && mk.estado === "pospuesto")) continue;
      const item = { ...a, desde, pospuesto: !!(mk && mk.estado === "pospuesto" && mk.hasta > hoy) };
      const fin = a.hasta > desde ? a.hasta : desde;
      if (desde <= hoy && hoy <= fin) {
        if (!mejor || PRIORIDAD[a.tipo] < PRIORIDAD[mejor.tipo] || (PRIORIDAD[a.tipo] === PRIORIDAD[mejor.tipo] && desde > mejor.desde)) mejor = item;
      } else if (desde > hoy && desde <= semana) {
        if (!prox || desde < prox.desde) prox = item;
      }
    }
    if (mejor) activos.push(armar(mejor, c, movs, aj, hoy));
    else if (prox) proximos.push(armar(prox, c, movs, aj, hoy));
  }
  activos.sort((a, b) => PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo] || (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  proximos.sort((a, b) => (a.desde < b.desde ? -1 : 1));
  return { activos, proximos };
}
// El aviso listo para la pantalla: título, detalle y el mensaje para WhatsApp.
function armar(a, c, movs, aj, hoy) {
  const nombre = primerNombre(c.nombre);
  const m = a.mov;
  const prod = (m && m.producto) || (a.tipo === "seg" || a.tipo === "volver" ? (c.intereses || [])[0] : "") || "";
  const fallback = a.tipo === "seg" || a.tipo === "volver" ? "" : "compra";
  let titulo = "", detalle = "";
  const plantilla = PLANTILLA[a.tipo];
  if (a.tipo === "cumple") titulo = a.dia === hoy ? "Hoy cumple años" : a.dia === sumarDias(hoy, 1) ? "Mañana cumple años" : `Cumple el ${fechaCorta(a.dia, hoy)}`;
  else if (a.tipo === "seg") { titulo = `Consultó ${hace(m.fecha, hoy)} y no compró`; detalle = "Buen momento para preguntarle si le quedó alguna duda."; }
  else if (a.tipo === "volver") { titulo = `Consultó ${hace(m.fecha, hoy)} y no compró`; detalle = "Volvé a ofrecerle, con alguna novedad."; }
  else if (a.tipo === "post") { titulo = `Compró ${hace(m.fecha, hoy)}`; detalle = "Preguntale cómo le va y pedile una recomendación."; }
  else if (a.tipo === "cuota") { titulo = `Va por la cuota ${a.k} de ${a.n}`; detalle = "Aprox. Buen momento para ofrecerle otra pieza."; }
  else if (a.tipo === "fin") { titulo = `Terminó de pagar las ${a.n} cuotas`; detalle = "Aprox. Ya puede sumar otra compra."; }
  else if (a.tipo === "quieto") { titulo = `No hablan desde ${hace(a.ultima, hoy)}`; detalle = "Escribile para mantener el contacto."; }
  if (a.desde > hoy) detalle = `Aparece ${hace(a.desde, hoy)}.`;
  const mensaje = llenar(aj.plantillas[plantilla], { nombre, producto: enFrase(prod) || fallback, cuota: a.k, cuotas: a.n });
  return { ...a, nombre: c.nombre, telefono: c.telefono, producto: prod, titulo, detalle, mensaje, prioridad: PRIORIDAD[a.tipo] };
}

// ---------- promos: a quién ----------
const ESTADOS_PROMO = [
  ["todos", "Todos"], ["consultaron", "Consultaron y no compraron"], ["compraron", "Ya compraron"],
  ["cuotas", "Con cuotas en curso"], ["pagaron", "Terminaron de pagar"],
];
function segmento(state, f, hoy) {
  const idx = indice(state);
  const want = (f.intereses || []).map(sinTildes);
  const out = [];
  for (const c of state.clientes) {
    if (c.sinPromos || !c.telefono) continue;
    const movs = idx.get(c.id) || [];
    const v = ultimo(movs, "venta"), q = ultimo(movs, "consulta");
    const e = f.estado || "todos";
    if (e === "consultaron" && !(q && !v)) continue;
    if (e === "compraron" && !v) continue;
    const enCurso = v && v.cuotas >= 2 && sumarMeses(v.fecha, v.cuotas) > hoy;
    if (e === "cuotas" && !enCurso) continue;
    if (e === "pagaron" && !(v && v.cuotas >= 2 && !enCurso)) continue;
    const suyos = [...(c.intereses || []), ...movs.filter(m => m.producto && (m.tipo === "consulta" || m.tipo === "venta")).map(m => m.producto)];
    let producto = "";
    if (want.length) {
      const hit = suyos.find(p => want.includes(sinTildes(p)));
      if (!hit) continue;
      producto = hit;
    } else producto = (v && v.producto) || (q && q.producto) || (c.intereses || [])[0] || "";
    if (f.sinPromoDias > 0) {
      const lim = sumarDias(hoy, -f.sinPromoDias);
      if (movs.some(m => m.tipo === "promo" && m.fecha > lim)) continue;
    }
    out.push({ cliente: c, producto });
  }
  out.sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre, "es"));
  return out;
}

// ---------- números del mes ----------
function resumenMes(state, hoy) {
  const mes = hoy.slice(0, 7);
  const cli = new Map(state.clientes.map(c => [c.id, c]));
  const r = { consultas: 0, ventas: 0, enCuotas: 0, monto: 0, conMonto: 0, mensajes: 0, origen: {}, productos: {} };
  for (const m of state.movimientos) {
    if (m.fecha.slice(0, 7) !== mes) continue;
    const c = cli.get(m.clienteId);
    const o = (c && c.origen) || "Sin dato";
    if (m.tipo === "consulta") {
      r.consultas++;
      (r.origen[o] = r.origen[o] || { consultas: 0, ventas: 0 }).consultas++;
      if (m.producto) r.productos[m.producto] = (r.productos[m.producto] || 0) + 1;
    } else if (m.tipo === "venta") {
      r.ventas++;
      if (m.cuotas >= 2) r.enCuotas++;
      if (m.monto != null) { r.monto += Number(m.monto); r.conMonto++; }
      (r.origen[o] = r.origen[o] || { consultas: 0, ventas: 0 }).ventas++;
    } else if (m.tipo === "mensaje" || m.tipo === "promo") r.mensajes++;
  }
  r.topProductos = Object.entries(r.productos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  r.porOrigen = Object.entries(r.origen).sort((a, b) => b[1].ventas - a[1].ventas || b[1].consultas - a[1].consultas);
  return r;
}

// ---------- importar contactos ----------
// Quoted-printable (así exporta Android los nombres con tildes) → texto.
function qp(s) {
  const bytes = [];
  const t = s.replace(/=\r?\n/g, "");
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9A-F]{2}$/i.test(t.slice(i + 1, i + 3))) { bytes.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(t.charCodeAt(i) & 0xff);
  }
  try { return new TextDecoder("utf-8").decode(new Uint8Array(bytes)); } catch (e) { return s; }
}
const vcfTexto = s => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
function parsearVCF(text) {
  // las líneas que siguen con espacio son parte de la anterior; las de quoted-printable terminan en «=»
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/=\n(?=[^\n])/g, "=\u0001").replace(/\n[ \t]/g, "").split("\n").map(l => l.replace(/=\u0001/g, "=\n"));
  const out = [];
  let cur = null;
  for (const line of raw) {
    const u = line.toUpperCase();
    if (u.startsWith("BEGIN:VCARD")) { cur = { nombre: "", n: "", telefonos: [] }; continue; }
    if (u.startsWith("END:VCARD")) { if (cur) { cur.nombre = cur.nombre || cur.n; out.push({ nombre: cur.nombre, telefonos: cur.telefonos }); } cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const head = line.slice(0, i), val = line.slice(i + 1);
    const prop = head.split(";")[0].split(".").pop().toUpperCase();
    const dec = /ENCODING=QUOTED-PRINTABLE/i.test(head) ? qp(val) : val;
    if (prop === "FN") cur.nombre = vcfTexto(dec);
    else if (prop === "N") { const p = dec.split(";"); cur.n = vcfTexto([p[1], p[2], p[0]].filter(Boolean).join(" ")); }
    else if (prop === "TEL") cur.telefonos.push(dec.replace(/^tel:/i, "").trim());
  }
  return out.filter(c => c.nombre || c.telefonos.length);
}
function filasCSV(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const first = s.split(/\r?\n/)[0] || "";
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
function parsearCSV(text) {
  const rows = filasCSV(text);
  if (rows.length < 2) return [];
  const h = rows[0].map(x => sinTildes(x).trim());
  const col = re => h.findIndex(x => re.test(x));
  const full = col(/^(name|nombre|nombre completo|full name|display name)$/);
  const first = col(/^(first name|given name|nombre de pila|nombre)$/);
  const mid = col(/^(middle name|segundo nombre)$/);
  const last = col(/^(last name|family name|apellido|apellidos)$/);
  const tels = h.map((x, i) => (/(phone|telefono|tel\b|celular|movil|whatsapp|mobile)/.test(x) && !/(type|tipo|label|etiqueta)/.test(x) ? i : -1)).filter(i => i >= 0);
  if (!tels.length) return [];
  return rows.slice(1).map(r => {
    const g = i => (i >= 0 ? String(r[i] || "").trim() : "");
    const nombre = g(full) && full !== first ? g(full) : [g(first), g(mid), g(last)].filter(Boolean).join(" ");
    const telefonos = tels.flatMap(i => g(i).split(/\s*:::\s*/)).filter(Boolean);
    return { nombre: nombre || g(full), telefonos };
  }).filter(c => c.nombre || c.telefonos.length);
}
// «Laura bifera» → sugiere «Bifera». Primero el producto entero; si no, la primera palabra si no se confunde con otro producto.
function sugerirIntereses(nombre, productos) {
  const n = " " + sinTildes(nombre).replace(/[^a-z0-9ñ]+/g, " ") + " ";
  const enteros = productos.filter(p => n.includes(" " + sinTildes(p).replace(/[^a-z0-9ñ]+/g, " ").trim() + " "));
  if (enteros.length) return enteros;
  const por = new Map();
  for (const p of productos) {
    const w = sinTildes(p).split(/[^a-z0-9ñ]+/)[0];
    if (w.length >= 4) por.set(w, (por.get(w) || []).concat(p));
  }
  for (const [w, ps] of por) if (ps.length === 1 && n.includes(" " + w + " ")) return ps;
  return [];
}
// Contactos (de la agenda, .vcf o .csv) → filas para importar: uno por teléfono, con lo sugerido y si ya está.
function aImportar(contactos, aj, existentes) {
  const ya = new Set(existentes || []);
  const vistos = new Set();
  const out = [];
  for (const c of contactos) {
    const nombre = String(c.nombre || "").trim().slice(0, 80);
    const tel = (c.telefonos || []).map(t => normalizarTel(t, aj.caracteristica)).find(Boolean) || "";
    if (!tel || vistos.has(tel)) continue;
    vistos.add(tel);
    const intereses = sugerirIntereses(nombre, aj.productos);
    out.push({ nombre: nombre || formatearTel(tel), telefono: tel, intereses, yaEsta: ya.has(tel), sugerido: intereses.length > 0 });
  }
  out.sort((a, b) => (b.sugerido - a.sugerido) || a.nombre.localeCompare(b.nombre, "es"));
  return out;
}

// ---------- descargar los datos ----------
// Celda de CSV: entre comillas, y lo que empieza con = + - @ va con un apóstrofo para que Excel no lo tome como fórmula.
const celda = v => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = filas => "﻿" + filas.map(r => r.map(celda).join(";")).join("\r\n");
function csvClientes(state, hoy) {
  const idx = indice(state);
  const filas = [["Nombre", "Teléfono", "Intereses", "De dónde vino", "Cumple", "No ofrecerle más", "Nota", "Situación", "Última compra", "Producto", "Medio", "Cuotas", "Último contacto"]];
  for (const c of state.clientes) {
    const s = situacion(c, idx.get(c.id) || [], hoy);
    const v = s.venta;
    filas.push([c.nombre, c.telefono, (c.intereses || []).join(", "), c.origen, c.cumple || "", c.sinPromos ? "Sí" : "", c.nota, s.texto,
      v ? v.fecha : "", v ? v.producto : "", v ? medioTexto(v.medio) : "", v && v.cuotas ? v.cuotas : "", s.ultima || ""]);
  }
  return csv(filas);
}
function csvMovimientos(state) {
  const cli = new Map(state.clientes.map(c => [c.id, c]));
  const filas = [["Fecha", "Tipo", "Nombre", "Teléfono", "Producto", "Medio", "Cuotas", "Monto", "Detalle", "Motivo"]];
  for (const m of state.movimientos) {
    const c = cli.get(m.clienteId) || {};
    filas.push([m.fecha, TIPOS[m.tipo] || m.tipo, c.nombre || "", c.telefono || "", m.producto, medioTexto(m.medio), m.cuotas || "", m.monto == null ? "" : m.monto, m.detalle, m.motivo]);
  }
  return csv(filas);
}
const medioTexto = k => (MEDIOS.find(x => x[0] === k) || [k, k || ""])[1];

// ---------- productos: catálogo y búsqueda que perdona errores ----------
// Un catálogo es opcional y se prende en Ajustes. Piezas sueltas, sin combos (los combos cambian cada mes y van en Promos).
// Cada pieza se nombra por pieza y medida («Cacerola 24»): la línea o el color van en la nota, así el ranking y las promos no se parten.
const CATALOGOS = {
  essen: {
    nombre: "Essen",
    fuente: "catálogo del equipo, ciclo 10",
    piezas: [
      "Cacerola 18", "Cacerola 24", "Cacerola 28", "Cacerola cuadrada 29",
      "Sartén 18", "Sartén 24", "Sartén 28", "Sartén 31 paellera", "Sartén express 18",
      "Bifera", "Bifera doble hornalla", "Plancha doble hornalla", "Flip 2.2", "Flip Nuit 24", "Wok 30", "Fuente rectangular 30",
      "Savarín 18", "Savarín 24", "Savarín 28", "Jarrito Quick", "Kamado", "Disco Nuit", "Tapa grill para disco", "Anafe de inducción", "Robot Rein",
      "Set de budineras", "Vaporizador", "Cestillo freidor", "Soporte para brasas", "Asas de silicona", "Libro de recetas",
      "Cuchillo Utility", "Cuchillo Carving", "Cuchillo Chef", "Cuchillo Santoku", "Afilador de cuchillos", "Tabla bifaz 30x30", "Tabla bifaz 40x30",
      "Vaso térmico", "Botella térmica", "Mate térmico", "Mate Neo", "Termo", "Bombilla",
      "Set de utensilios x5", "Set espátula y batidor", "Set utensilios de carne", "Set utensilios de pastas", "Set utensilios de parrilla",
      "Rallador fino", "Rallador medio", "Rallador grueso", "Rallador de cintas",
      "Balanza", "Mandolina", "Rebanador de queso", "Cafetera italiana", "Set de tarros", "Centrifugador de vegetales", "Multiprocesador de vegetales",
      "Abrelatas", "Pelador", "Corta pizza", "Rejilla de desmolde", "Estira masas", "Tarro medidor", "Set de bowls de acero", "Aceite de oliva",
      "Salero y pimentero", "Molinillo", "Limpiador de acero", "Limpiador desengrasante", "Limpiador abrillantador",
    ],
    // Los botones con los que arranca quien prende el catálogo sin haber tocado sus productos (las piezas que más se repiten en los combos).
    inicio: ["Cacerola 24", "Sartén 24", "Cacerola 18", "Flip 2.2", "Savarín 24", "Bifera", "Cacerola 28", "Wok 30"],
  },
};
const RELLENO = new Set(["de", "del", "la", "el", "los", "las", "con", "para", "cm", "cms", "centimetros"]);
// «Caserola 24cm» → «caserola 24»: sin tildes ni mayúsculas, números separados de las letras y sin palabras de relleno.
function claveProd(s) {
  return sinTildes(s).replace(/(\d),(\d)/g, "$1.$2").replace(/([a-zñ])(\d)/g, "$1 $2").replace(/(\d)([a-zñ])/g, "$1 $2")
    .replace(/[^a-z0-9ñ.]+/g, " ").split(" ").map(w => w.replace(/^\.+|\.+$/g, "")).filter(w => w && !RELLENO.has(w)).join(" ");
}
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// ¿La palabra escrita (q) es esta palabra del producto (w)? Los números tienen que ser iguales; las palabras admiten un error
// (dos si son largas), siempre que empiecen con la misma letra. Mientras escribe, la última palabra puede estar a medias.
function palabraCoincide(q, w, aMedias) {
  if (q === w || (aMedias && w.startsWith(q))) return true;
  if (/^\d/.test(q) || /^\d/.test(w) || q[0] !== w[0] || q.length < 4) return false;
  const tol = q.length >= 7 ? 2 : 1;
  return distancia(q, w) <= tol || (aMedias && q.length < w.length && distancia(q, w.slice(0, q.length)) <= tol);
}
function productosUnicos(lista) {
  const vistos = new Set(), out = [];
  for (const p of lista || []) { const k = claveProd(p); if (k && !vistos.has(k)) { vistos.add(k); out.push(p); } }
  return out;
}
// Productos de la lista que se parecen a lo escrito, los más parecidos primero.
// mientras = true: está escribiendo (la última palabra puede estar a medias, «cac» trae las cacerolas).
function buscarProductos(texto, lista, mientras = true) {
  const q = claveProd(texto).split(" ").filter(Boolean);
  if (!q.length) return [];
  const out = [];
  productosUnicos(lista).forEach((p, orden) => {
    const w = claveProd(p).split(" ");
    let exactas = 0;
    const ok = q.every((t, i) => w.some(x => { const s = palabraCoincide(t, x, mientras && i === q.length - 1); if (s && t === x) exactas++; return s; }));
    if (ok) out.push({ p, puntos: exactas * 10 + (palabraCoincide(q[0], w[0], mientras && q.length === 1) ? 5 : 0) - w.length, orden });
  });
  return out.sort((a, b) => b.puntos - a.puntos || a.orden - b.orden).map(x => x.p);
}
// Lo que escribió en «Buscá la pieza», ya terminado: una pieza conocida, varias posibles o un producto nuevo.
function resolverProducto(texto, lista) {
  const t = String(texto || "").trim().replace(/\s+/g, " ");
  if (!claveProd(t)) return { tipo: "vacio" };
  const igual = productosUnicos(lista).find(p => claveProd(p) === claveProd(t));
  if (igual) return { tipo: "uno", valor: igual };
  const hits = buscarProductos(t, lista, false);
  if (hits.length === 1) return { tipo: "uno", valor: hits[0] };
  if (hits.length > 1) return { tipo: "varios", opciones: hits };
  const parecidos = buscarProductos(t, lista, true);
  if (parecidos.length) return { tipo: "varios", opciones: parecidos };
  // Una medida que no existe («cacerola 22») suele ser un error: que elija entre las medidas que hay.
  const palabras = claveProd(t).split(" ").filter(w => !/^\d/.test(w)).join(" ");
  const medidas = palabras && palabras !== claveProd(t) ? buscarProductos(palabras, lista, false) : [];
  if (medidas.length) return { tipo: "varios", opciones: medidas };
  return { tipo: "nuevo", valor: t.charAt(0).toUpperCase() + t.slice(1) };
}

if (typeof module !== "undefined") {
  module.exports = { DEFAULTS, MEDIOS, CUOTAS, CON_CUOTAS, TIPOS, PRIORIDAD, ESTADOS_PROMO, ajustesDe, hoyISO, okISO, sumarDias, diasEntre, sumarMeses, mesesEntre,
    fechaCorta, hace, proximoCumple, normalizarTel, formatearTel, linkWa, sinTildes, primerNombre, llenar, pareceTarjeta, plata, leerMonto,
    indice, situacion, hitos, cuotaActual, candidatos, avisos, segmento, resumenMes, parsearVCF, parsearCSV, sugerirIntereses, aImportar,
    csvClientes, csvMovimientos, medioTexto, enFrase, CATALOGOS, claveProd, buscarProductos, resolverProducto, productosUnicos };
}
