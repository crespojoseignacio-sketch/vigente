// ---------- Vigente: pantallas ----------
// Hoy (a quién escribirle y por qué) · Clientes y su ficha · Promos de a una · Ajustes · Importar contactos.
// JavaScript sin frameworks: cada cambio vuelve a dibujar la vista con plantillas; todo lo que escribe el usuario pasa por esc().
const S = {
  mode: "loading",  // db | demo | offline
  ready: false,     // ¿ya se cargaron los datos?
  loadErr: null,
  route: "hoy",     // hoy | clientes | ficha | promos | ajustes | importar
  id: null,         // cliente abierto
  q: "",
  filtro: "todos",
  limite: 80,
  authMode: "login",
  authMsg: null,
  promo: { intereses: [], estado: "todos", sinPromoDias: 30, texto: null, nombre: "" },
  envio: null,      // {nombre, texto, ids: [], i, hechos}
  imp: null,        // {filas: [], marcados: Set, q}
  install: null,
  busy: false,
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const st = () => Store.state;
const aj = () => ajustesDe(st() && st().ajustes);
const hoy = () => hoyISO();
const cliente = id => st() && st().clientes.find(c => c.id === id);
const lower = s => sinTildes(String(s || "").trim());
const ORIGEN_DEF = "Otro";
// Estilos de la app: cada emprendedora elige el suyo en Ajustes (queda en ese celular).
const TEMAS = [
  ["recetario", "Recetario", "Letra de libro de cocina, una tarjeta por persona y la perilla de las cuotas."],
  ["etiquetas", "Etiquetas", "Como las etiquetas de WhatsApp: un color por aviso y una lista que entra más gente."],
  ["cuaderno", "Cuaderno", "Hoja con renglones, letra más grande y un círculo para tachar a quien ya le escribiste."],
];
const TEMA_DEF = "recetario";
const COLOR_TEMA = { recetario: "#2A1F2D", etiquetas: "#15233F", cuaderno: "#1E2A55" };
function temaGuardado() { try { const t = localStorage.getItem("vigente.tema"); return TEMAS.some(x => x[0] === t) ? t : TEMA_DEF; } catch (e) { return TEMA_DEF; } }
function aplicarTema(t) {
  document.documentElement.dataset.tema = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", COLOR_TEMA[t] || COLOR_TEMA[TEMA_DEF]);
}
aplicarTema(temaGuardado());
// Cómo se llama cada aviso, como una etiqueta de WhatsApp Business.
const ETIQUETA = { cumple: "Cumple", seg: "Seguimiento", volver: "Volver a ofrecer", post: "Postventa", cuota: "Cuotas", fin: "Terminó de pagar", quieto: "Sin contacto" };
const iniciales = n => String(n || "").trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toLocaleUpperCase("es")).join("") || "·";
// Las cuotas como casilleros (Etiquetas y Cuaderno); en Recetario se ve la perilla.
function segmentos(k, n) {
  if (!(n >= 2)) return "";
  return `<span class="segmentos" role="img" aria-label="Cuota ${k} de ${n}">${Array.from({ length: Math.min(n, 36) }, (_, i) => `<i class="${i < k ? "si" : ""}"></i>`).join("")}</span>`;
}

const I = (d, extra = "") => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  hoy: I('<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zm0 4v4.6l3 1.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  gente: I('<circle cx="9" cy="8.5" r="3.3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 19.5c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.6c1.9.6 3.1 2.2 3.5 4.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  promo: I('<path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1zM17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  mas: I('<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  ajustes: I('<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  atras: I('<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  chat: I('<path d="M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 9 19l-4.5.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 10.5h6M9 13.5h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  tel: I('<path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  reloj: I('<circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.5V13l2.4 1.6M9.5 2.8h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  editar: I('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  buscar: I('<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  bajar: I('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  agenda: I('<rect x="5" y="3.5" width="14" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 17c.7-2 2.2-3 4-3s3.3 1 4 3M3 8h2M3 12h2M3 16h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  cerrar: I('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  puntos: I('<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>'),
};
// Íconos del centro de la perilla, según el aviso.
const GLIFO = {
  seg: '<path d="M9.6 9.4a2.6 2.6 0 1 1 3.4 2.5c-.6.2-1 .8-1 1.4v.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>',
  volver: '<path d="M8 9.5h6.5a3.5 3.5 0 0 1 0 7H10M8 9.5l2.6-2.6M8 9.5l2.6 2.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  post: '<path d="M12 18s-5.5-3.2-5.5-7a3 3 0 0 1 5.5-1.7A3 3 0 0 1 17.5 11c0 3.8-5.5 7-5.5 7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  cumple: '<path d="M6.5 18.5h11v-5h-11zM7.5 13.5v-2h9v2M12 11.5v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 5.3c.9 1 .9 1.9 0 2.4-.9-.5-.9-1.4 0-2.4z" fill="currentColor"/>',
  quieto: '<path d="M15.5 6.5a6 6 0 1 0 2 8.8 5 5 0 0 1-2-8.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  persona: '<circle cx="12" cy="9.5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 18c.8-2.6 2.6-4 5-4s4.2 1.4 5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

// La perilla: el ciclo de cada persona. Con cuotas, un segmento por cuota (las pagadas en azafrán).
function perilla({ tipo, k = 0, n = 0, f = 0, centro = "" }, size = 56) {
  const r = 23, C = 2 * Math.PI * r;
  let marcas = "";
  if (n >= 2) {
    const gap = n > 18 ? 1.4 : 2.6, seg = C / n - gap;
    const fill = [];
    for (let i = 0; i < k; i++) fill.push(seg.toFixed(2), gap.toFixed(2));
    fill.push("0", C.toFixed(2));
    marcas = `<circle class="p-track" cx="28" cy="28" r="${r}" stroke-dasharray="${seg.toFixed(2)} ${gap.toFixed(2)}"/>`
      + (k ? `<circle class="p-fill" cx="28" cy="28" r="${r}" stroke-dasharray="${fill.join(" ")}"/>` : "");
  } else {
    const len = Math.max(0, Math.min(1, f)) * C;
    marcas = `<circle class="p-track" cx="28" cy="28" r="${r}"/>` + (len ? `<circle class="p-fill" cx="28" cy="28" r="${r}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}"/>` : "");
  }
  const mid = centro !== "" ? `<text x="28" y="34" text-anchor="middle" class="p-num">${esc(centro)}</text>`
    : `<g transform="translate(16 16)" class="p-ico">${GLIFO[tipo] || GLIFO.persona}</g>`;
  return `<svg class="perilla p-${tipo}" viewBox="0 0 56 56" width="${size}" height="${size}" aria-hidden="true"><circle class="p-base" cx="28" cy="28" r="27"/><g transform="rotate(-90 28 28)">${marcas}</g>${mid}</svg>`;
}
function perillaAviso(a) {
  const d = aj().dias;
  if (a.tipo === "cuota" || a.tipo === "fin") return perilla({ tipo: a.tipo, k: a.k, n: a.n, centro: String(a.k) });
  if (a.tipo === "seg" || a.tipo === "volver") return perilla({ tipo: a.tipo, f: diasEntre(a.mov.fecha, hoy()) / (d.volver * 2) });
  if (a.tipo === "post") return perilla({ tipo: "post", f: 1 });
  if (a.tipo === "cumple") return perilla({ tipo: "cumple", f: 1 });
  return perilla({ tipo: a.tipo, f: 0.12 });
}
function perillaCliente(c, s, size) {
  const v = s.venta;
  if (s.estado === "cuotas") { const k = cuotaActual(v, hoy()); return perilla({ tipo: "cuota", k, n: v.cuotas, centro: k ? String(k) : "" }, size); }
  if (s.estado === "compro") return perilla({ tipo: "post", f: 1 }, size);
  if (s.estado === "consulto") return perilla({ tipo: "seg", f: 0.25 }, size);
  return perilla({ tipo: "persona" }, size);
}
function logo(size = 36) {
  return `<svg class="logo" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><rect class="lg-bg" width="64" height="64" rx="16"/><g transform="rotate(-90 32 32)"><circle class="lg-track" cx="32" cy="32" r="19" fill="none" stroke-width="7" stroke-dasharray="7.9 2.05"/><circle class="lg-fill" cx="32" cy="32" r="19" fill="none" stroke-width="7" stroke-dasharray="7.9 2.05 7.9 2.05 7.9 2.05 7.9 2.05 7.9 2.05 7.9 2.05 0 200"/></g><circle class="lg-dot" cx="32" cy="32" r="8"/></svg>`;
}

// ---------- avisos ----------
let toastTimer = null, toastUndo = null;
function toast(msg, undo = null) {
  const t = $("#toast");
  toastUndo = undo;
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" class="toast-btn" data-act="toast-undo">${esc(undo.label)}</button>` : ""}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; toastUndo = null; }, undo ? 8000 : 4000);
}
const errText = e => {
  const c = String((e && e.code) || (e && e.message) || "");
  if (c === "timeout" || c === "offline") return "No hay conexión. Revisá internet y probá de nuevo: lo que escribiste sigue acá.";
  if (c === "no_auth") return "Se cerró tu sesión. Entrá de nuevo con tu mail y contraseña.";
  if (c === "sin_base") return "La base de Vigente todavía no está lista. Avisale a quien te pasó la app.";
  if (c === "tarjeta") return "Eso parece un número de tarjeta. Por seguridad no se guarda: borralo y probá de nuevo.";
  if (c === "tel_repetido") return "Ya tenés a otra persona con ese teléfono.";
  if (c === "bad_tel") return "Revisá el teléfono: le faltan o le sobran números.";
  if (c === "falta_nombre") return "Falta el nombre.";
  if (c.startsWith("largo")) return "Hay un texto demasiado largo. Acortalo y probá de nuevo.";
  if (c === "bad_fecha") return "Revisá la fecha: no puede ser futura.";
  if (c === "bad_cuotas") return "Las cuotas van de 1 a 60.";
  if (c === "bad_monto") return "Revisá el monto.";
  if (c === "bad_cumple") return "Revisá el día del cumple.";
  if (c === "muchos") return "Son demasiadas etiquetas. Sacá alguna.";
  if (c === "tope_clientes") return "Llegaste al máximo de 5.000 clientes.";
  if (c === "tope_movimientos") return "Esta persona ya tiene 500 movimientos: es el máximo.";
  if (c === "no_existe") return "Eso ya no está. Recargá la página.";
  return c && !/^[a-z_:]+$/.test(c) ? c : "No se pudo guardar. Probá de nuevo.";
};
// Envuelve una acción: muestra el error y deja todo como estaba.
const safe = fn => async (...a) => {
  if (S.busy) return;
  S.busy = true;
  document.body.classList.add("busy");
  try { await fn(...a); }
  catch (e) {
    if (e && e.code === "no_auth") { await Store.auth.signOut(); render(); }
    const box = document.querySelector("#sheet .form-err");
    if (box) { box.textContent = errText(e); box.hidden = false; box.scrollIntoView({ block: "nearest" }); }
    else toast(errText(e));
  } finally { S.busy = false; document.body.classList.remove("busy"); }
};

// ---------- hojas (paneles que suben desde abajo) ----------
let sheetOn = false;
function openSheet(html, opts = {}) {
  const sh = $("#sheet");
  sh.innerHTML = `<div class="backdrop" data-act="sheet-close"></div><section class="panel" role="dialog" aria-modal="true" aria-label="${esc(opts.label || "Panel")}">
    <button class="panel-x" data-act="sheet-close" aria-label="Cerrar">${ICON.cerrar}</button>${html}<p class="form-err" role="alert" hidden></p></section>`;
  sh.classList.add("on");
  document.body.classList.add("sheet-open");
  if (!sheetOn) history.pushState({ sheet: true }, "", location.href);
  sheetOn = true;
  const f = sh.querySelector("[autofocus]") || sh.querySelector(".panel h2");
  if (f) { if (!f.hasAttribute("tabindex") && f.tagName === "H2") f.setAttribute("tabindex", "-1"); f.focus({ preventScroll: true }); }
  if (opts.mount) opts.mount(sh);
}
function hideSheet() {
  const sh = $("#sheet");
  sh.classList.remove("on");
  sh.innerHTML = "";
  document.body.classList.remove("sheet-open");
  sheetOn = false;
}
function closeSheet() { if (sheetOn && history.state && history.state.sheet) history.back(); else hideSheet(); }
window.addEventListener("popstate", () => { if (sheetOn) hideSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetOn) closeSheet(); });

// ---------- rutas ----------
function leerRuta() {
  const h = location.hash.replace(/^#\/?/, "");
  const [r, id] = h.split("/");
  S.route = ["hoy", "clientes", "promos", "ajustes", "importar"].includes(r) ? r : r === "c" && id ? "ficha" : "hoy";
  S.id = S.route === "ficha" ? decodeURIComponent(id) : null;
}
const go = r => { if (location.hash !== "#/" + r) location.hash = "#/" + r; else render(); };
window.addEventListener("hashchange", () => { if (sheetOn) hideSheet(); leerRuta(); render(); window.scrollTo(0, 0); });

// ---------- vista principal ----------
function render() {
  const app = $("#app");
  if (S.mode === "loading") return;
  if (S.mode === "offline") { app.innerHTML = vistaSinConexion(); return; }
  if (!Store.auth.user()) { app.innerHTML = vistaLogin(); return; }
  if (!S.ready) {
    app.innerHTML = S.loadErr ? `<section class="vacio"><h1>No se pudieron traer tus datos</h1><p>${esc(errText(S.loadErr))}</p><button class="btn primary" data-act="reload">Probar de nuevo</button><button class="btn ghost" data-act="salir">Salir</button></section>`
      : `<div class="loading">Trayendo tus clientes…</div>`;
    return;
  }
  const v = { hoy: vistaHoy, clientes: vistaClientes, ficha: vistaFicha, promos: vistaPromos, ajustes: vistaAjustes, importar: vistaImportar }[S.route] || vistaHoy;
  const conNav = ["hoy", "clientes", "promos"].includes(S.route);
  app.innerHTML = (Store.demo ? `<div class="demo-bar"><span>Estás mirando un ejemplo: nada se guarda en la nube.</span><button class="link" data-act="demo-salir">Salir del ejemplo</button></div>` : "")
    + `<div class="vista v-${S.route}">${v()}</div>` + (conNav ? nav() : "");
}
function nav() {
  const b = (r, ico, txt) => `<a class="tab${S.route === r ? " on" : ""}" href="#/${r}"${S.route === r ? ' aria-current="page"' : ""}>${ico}<span>${txt}</span></a>`;
  return `<nav class="tabs" aria-label="Secciones">${b("hoy", ICON.hoy, "Hoy")}${b("clientes", ICON.gente, "Clientes")}
    <button class="tab anotar" data-act="anotar">${ICON.mas}<span>Anotar</span></button>${b("promos", ICON.promo, "Promos")}</nav>`;
}
function vistaSinConexion() {
  return `<section class="vacio"><div class="brand">${logo()}<b>Vigente</b></div><h1>No hay conexión</h1><p>Vigente guarda tus clientes en la nube, así no se pierden si cambiás de celular. Para abrirla hace falta internet.</p><button class="btn primary" data-act="reload">Probar de nuevo</button></section>`;
}

// ---------- entrar ----------
function vistaLogin() {
  const alta = S.authMode === "signup";
  const muestra = { tipo: "cuota", k: 6, n: 12 };
  return `<section class="login">
    <div class="brand">${logo(40)}<b>Vigente</b></div>
    <h1>A quién escribirle hoy, y qué decirle.</h1>
    <p class="lead">Anotás cada consulta y cada venta en segundos. Vigente te avisa cuándo volver a escribirle a cada persona: el seguimiento, la mitad de las cuotas, el cumple. El mensaje sale escrito, desde tu WhatsApp.</p>
    <img class="ilustra" src="/ilustra/${esc(document.documentElement.dataset.tema)}.webp" alt="" width="640" height="400" decoding="async" data-ilustra>
    <div class="muestra" aria-hidden="true">
      ${perilla({ ...muestra, centro: "6" }, 52)}<span class="inicial i-cuota">MG</span><span class="tilde"></span>
      <div><span class="etiqueta e-cuota">Cuotas</span><b>Marta Gómez</b><span>Va por la cuota 6 de 12</span>${segmentos(6, 12)}<em>«¡Hola Marta! ¿Qué tal la cacerola?…»</em></div>
    </div>
    <form class="card form" data-form="login" novalidate>
      <div class="seg" role="tablist" aria-label="Entrar o crear cuenta">
        <button type="button" role="tab" aria-selected="${!alta}" class="${alta ? "" : "on"}" data-act="auth-mode" data-m="login">Ya tengo cuenta</button>
        <button type="button" role="tab" aria-selected="${alta}" class="${alta ? "on" : ""}" data-act="auth-mode" data-m="signup">Crear cuenta</button>
      </div>
      <label class="fld"><span>Mail</span><input name="email" type="email" autocomplete="email" inputmode="email" required></label>
      <label class="fld"><span>Contraseña</span><input name="pass" type="password" minlength="8" autocomplete="${alta ? "new-password" : "current-password"}" required></label>
      ${alta ? `<p class="hint">Al menos 8 caracteres. Es solo para Vigente y las otras apps de esta cuenta.</p>` : ""}
      ${S.authMsg ? `<p class="${S.authMsg.ok ? "ok-msg" : "form-err"}" role="alert">${esc(S.authMsg.text)}</p>` : ""}
      <button class="btn primary big" type="submit">${alta ? "Crear mi cuenta" : "Entrar"}</button>
      ${alta ? "" : `<button type="button" class="link" data-act="olvide">Me olvidé la contraseña</button>`}
    </form>
    <button class="btn ghost big" data-act="demo">Probar con un ejemplo</button>
    <p class="fine">Tus clientes los ves solo vos. Vigente no guarda números de tarjeta. <button class="link" data-act="privacidad">Cómo se cuidan los datos</button></p>
  </section>`;
}
function textoPrivacidad() {
  return `<h2>Cómo se cuidan los datos</h2>
  <ul class="lista-texto">
    <li><b>Lo que se guarda:</b> nombre y teléfono de tus clientes, qué les interesó, qué compraron, cómo pagaron (medio y cuotas), el monto si lo anotás, tus notas y cuándo les escribiste.</li>
    <li><b>Quién lo ve:</b> solo vos, con tu mail y contraseña. Se verifica en la base, no en el celular: otra cuenta no puede leer tus clientes aunque lo intente.</li>
    <li><b>Lo que no se guarda nunca:</b> números de tarjeta. Si en una nota aparece algo que parece uno, la app no lo guarda.</li>
    <li><b>Los mensajes</b> salen desde tu WhatsApp, de a uno. Vigente no lee tus chats ni manda nada sola.</li>
    <li><b>Tus datos son tuyos:</b> en Ajustes podés descargarlos en una planilla o borrarlos.</li>
    <li><b>Respetá a quien no quiere mensajes:</b> si alguien te pide que no le escribas más, marcá «No ofrecerle más» en su ficha.</li>
  </ul>
  <button class="btn primary big" data-act="sheet-close">Entendido</button>`;
}

// ---------- hoy ----------
function vistaHoy() {
  const s = st(), h = hoy();
  const { activos, proximos } = avisos(s, h);
  const [y, m, d] = h.split("-").map(Number);
  const fecha = `${DIAS[new Date(y, m - 1, d).getDay()]} ${d} de ${MESES[m - 1]}`;
  const nuevo = !s.clientes.length;
  const titulo = nuevo ? "Empecemos por la próxima consulta" : activos.length ? `${activos.length === 1 ? "Una persona" : `${activos.length} personas`} para escribirle hoy` : "Hoy no hay a quién escribirle";
  return `<header class="top">
      <div class="brand small">${logo(28)}<b>Vigente</b></div>
      <a class="icon-btn" href="#/ajustes" aria-label="Ajustes">${ICON.ajustes}</a>
    </header>
    <p class="fecha">${fecha}</p>
    <h1 class="titulo">${esc(titulo)}</h1>
    ${!leerFlag("tema-elegido") ? `<section class="bloque elegir-estilo"><h2 class="sub">¿Cómo querés verla?</h2><p class="hint">Hay tres estilos. Lo podés cambiar cuando quieras en Ajustes.</p>
      ${opcionesEstilo()}<button class="btn ghost big" data-act="tema-ok">Así está bien</button></section>` : ""}
    ${nuevo ? bienvenida() : ""}
    ${activos.length ? `<div class="avisos">${activos.map((a, i) => (i === 0 || activos[i - 1].tipo !== a.tipo
      ? `<h2 class="grupo g-${a.tipo}">${esc(ETIQUETA[a.tipo])} <span>${activos.filter(x => x.tipo === a.tipo).length}</span></h2>` : "") + avisoCard(a)).join("")}</div>`
      : nuevo ? "" : `<p class="lead">Nadie consultó hace poco ni está por la mitad de las cuotas. Buen momento para anotar consultas o mandar una promo.</p>
        <div class="fila-btns"><button class="btn" data-act="anotar">Anotar</button><a class="btn" href="#/promos">Armar una promo</a></div>`}
    ${proximos.length ? `<details class="bloque"><summary>Próximos 7 días <span class="cuenta">${proximos.length}</span></summary>
      <ul class="prox">${proximos.map(a => `<li><button class="prox-row" data-act="ficha" data-id="${esc(a.clienteId)}">
        <span class="prox-cuando">${esc(cuando(a.desde, h))}</span><span class="prox-txt"><b>${esc(a.nombre)}</b><span>${esc(a.titulo)}</span></span></button></li>`).join("")}</ul></details>` : ""}
    ${s.movimientos.length ? numerosMes() : ""}
    ${S.install && !leerFlag("instalar-no") ? `<div class="bloque instalar"><p><b>Tenela a mano.</b> Instalala y queda como una app más del celular.</p>
      <div class="fila-btns"><button class="btn primary" data-act="instalar">Instalar</button><button class="link" data-act="instalar-no">Ahora no</button></div></div>` : ""}`;
}
function cuando(desde, h) {
  const n = diasEntre(h, desde);
  if (n === 1) return "Mañana";
  const [y, m, d] = desde.split("-").map(Number);
  return DIAS[new Date(y, m - 1, d).getDay()];
}
function bienvenida() {
  return `<div class="bienvenida">
    <img class="ilustra" src="/ilustra/${esc(document.documentElement.dataset.tema)}.webp" alt="" width="640" height="400" decoding="async" data-ilustra>
    <p class="lead">Cada vez que te consulten o te compren, anotalo acá. Con eso Vigente arma la lista de a quién escribirle cada día.</p>
    <button class="paso" data-act="nueva-consulta"><b>Me consultaron</b><span>Nombre, teléfono y qué le interesó. Veinte segundos.</span></button>
    <button class="paso" data-act="nueva-venta"><b>Vendí</b><span>También las ventas viejas del cuaderno, con su fecha y sus cuotas.</span></button>
    <a class="paso" href="#/importar"><b>Traer contactos del teléfono</b><span>Elegís cuáles. No cambia ni borra nada de tu agenda.</span></a>
  </div>`;
}
function avisoCard(a, compacto = false) {
  const wa = a.telefono
    ? `<a class="btn wa big" href="${esc(linkWa(a.telefono, a.mensaje))}" target="_blank" rel="noopener noreferrer" data-act="escribir" data-clave="${esc(a.clave)}" data-id="${esc(a.clienteId)}">${ICON.chat}<span>Escribirle</span></a>`
    : `<button class="btn big" data-act="editar" data-id="${esc(a.clienteId)}">Agregar su teléfono</button>`;
  return `<article class="aviso t-${a.tipo}${compacto ? " compacto" : ""}">
    ${a.telefono ? `<button class="tilde" data-act="ya-escribi" data-clave="${esc(a.clave)}" data-id="${esc(a.clienteId)}" aria-label="Ya le escribí a ${esc(primerNombre(a.nombre))}"></button>` : ""}
    <div class="aviso-top">${compacto ? "" : perillaAviso(a) + `<span class="inicial i-${a.tipo}" aria-hidden="true">${esc(iniciales(a.nombre))}</span>`}
      <div class="aviso-main">
        <span class="etiqueta e-${a.tipo}">${esc(ETIQUETA[a.tipo] || "")}</span>
        ${compacto ? `<p class="aviso-hoy">Para escribirle hoy</p>` : `<h2><button class="nombre" data-act="ficha" data-id="${esc(a.clienteId)}">${esc(a.nombre)}</button></h2>`}
        <p class="motivo">${esc(a.titulo)}</p>
        ${a.tipo === "cuota" || a.tipo === "fin" ? segmentos(a.k, a.n) : ""}
        ${a.producto || a.detalle ? `<p class="detalle">${a.producto ? `<span class="chip quieto">${esc(a.producto)}</span>` : ""}<span class="det-txt">${esc(a.detalle)}</span></p>` : ""}
      </div>
    </div>
    <p class="msg">${esc(a.mensaje)}</p>
    <div class="aviso-acts">${wa}<button class="btn icon" data-act="posponer" data-clave="${esc(a.clave)}" aria-label="Más tarde, ya le escribí o descartar">${ICON.reloj}</button></div>
  </article>`;
}
function numerosMes() {
  const r = resumenMes(st(), hoy());
  const mes = MESES[Number(hoy().slice(5, 7)) - 1];
  const tasa = r.consultas ? Math.round((r.ventas / r.consultas) * 100) : null;
  return `<details class="bloque numeros"><summary>Números de ${mes}</summary>
    <dl class="nums">
      <div><dt>Consultas</dt><dd>${r.consultas}</dd></div>
      <div><dt>Ventas</dt><dd>${r.ventas}</dd></div>
      <div><dt>En cuotas</dt><dd>${r.enCuotas}</dd></div>
      <div><dt>Mensajes</dt><dd>${r.mensajes}</dd></div>
    </dl>
    ${r.conMonto ? `<p class="hint">Vendiste ${esc(plata(r.monto))} en ${plural(r.conMonto, "venta con monto", "ventas con monto")}.</p>` : ""}
    ${tasa != null ? `<p class="hint">${r.ventas} ${r.ventas === 1 ? "venta" : "ventas"} cada ${r.consultas} ${r.consultas === 1 ? "consulta" : "consultas"} este mes.</p>` : ""}
    ${r.porOrigen.length ? `<h3>De dónde vienen</h3><table class="tabla"><thead><tr><th scope="col">Origen</th><th scope="col">Consultas</th><th scope="col">Ventas</th></tr></thead><tbody>
      ${r.porOrigen.map(([o, x]) => `<tr><th scope="row">${esc(o)}</th><td>${x.consultas}</td><td>${x.ventas}</td></tr>`).join("")}</tbody></table>` : ""}
    ${r.topProductos.length ? `<h3>Lo más consultado</h3><ol class="ranking">${r.topProductos.map(([p, n]) => `<li><span>${esc(p)}</span><b>${n}</b></li>`).join("")}</ol>` : ""}
  </details>`;
}

// ---------- clientes ----------
const FILTROS = [["todos", "Todos"], ["consulto", "Consultaron"], ["compro", "Compraron"], ["cuotas", "En cuotas"], ["sinpromos", "No ofrecerle más"]];
function vistaClientes() {
  const s = st(), h = hoy(), idx = indice(s);
  const q = lower(S.q), qd = S.q.replace(/\D/g, "");
  const filas = s.clientes.map(c => ({ c, s: situacion(c, idx.get(c.id) || [], h) }));
  const cuenta = { todos: filas.length, consulto: 0, compro: 0, cuotas: 0, sinpromos: 0 };
  for (const f of filas) {
    if (f.s.estado === "consulto") cuenta.consulto++;
    if (f.s.estado === "compro" || f.s.estado === "cuotas") cuenta.compro++;
    if (f.s.estado === "cuotas") cuenta.cuotas++;
    if (f.c.sinPromos) cuenta.sinpromos++;
  }
  const pasa = f => (S.filtro === "todos" || (S.filtro === "consulto" && f.s.estado === "consulto") || (S.filtro === "compro" && (f.s.estado === "compro" || f.s.estado === "cuotas"))
    || (S.filtro === "cuotas" && f.s.estado === "cuotas") || (S.filtro === "sinpromos" && f.c.sinPromos))
    && (!q || lower(f.c.nombre).includes(q) || (qd.length >= 3 && f.c.telefono.includes(qd)) || (f.c.intereses || []).some(i => lower(i).includes(q)));
  const lista = filas.filter(pasa).sort((a, b) => ((b.s.ultima || "") > (a.s.ultima || "") ? 1 : (b.s.ultima || "") < (a.s.ultima || "") ? -1 : a.c.nombre.localeCompare(b.c.nombre, "es")));
  return `<header class="top"><h1 class="titulo chico">Clientes <span class="cuenta">${s.clientes.length}</span></h1>
      <a class="btn small" href="#/importar">${ICON.agenda}<span>Importar</span></a></header>
    ${s.clientes.length ? `<label class="buscar">${ICON.buscar}<input type="search" data-in="buscar" value="${esc(S.q)}" placeholder="Buscar por nombre, teléfono o producto" aria-label="Buscar clientes"></label>
    <div class="chips filtros" role="group" aria-label="Filtrar">${FILTROS.map(([k, t]) => `<button class="chip${S.filtro === k ? " on" : ""}" aria-pressed="${S.filtro === k}" data-act="filtro" data-f="${k}">${t} <span>${cuenta[k]}</span></button>`).join("")}</div>
    <ul class="clientes">${lista.slice(0, S.limite).map(clienteRow).join("")}</ul>
    ${lista.length > S.limite ? `<button class="btn ghost big" data-act="ver-mas">Ver ${Math.min(80, lista.length - S.limite)} más</button>` : ""}
    ${!lista.length ? `<p class="lead">Nadie coincide con la búsqueda.</p>` : ""}`
    : `<section class="vacio"><p class="lead">Todavía no anotaste a nadie. Empezá por la próxima consulta que te llegue, o traé tus contactos.</p>
      <div class="fila-btns"><button class="btn primary" data-act="nueva-consulta">Me consultaron</button><a class="btn" href="#/importar">Importar contactos</a></div></section>`}`;
}
function clienteRow({ c, s }) {
  return `<li><a class="cli" href="#/c/${esc(encodeURIComponent(c.id))}">${perillaCliente(c, s, 44)}<span class="inicial i-${s.estado}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
    <span class="cli-txt"><b>${esc(c.nombre)}</b><span>${esc(s.texto)}</span>
    ${(c.intereses || []).length ? `<span class="cli-chips">${c.intereses.slice(0, 3).map(i => `<span class="chip quieto">${esc(i)}</span>`).join("")}</span>` : ""}</span>
    ${c.sinPromos ? `<span class="tag-no" title="No ofrecerle más">No ofrecer</span>` : ""}</a></li>`;
}

// ---------- ficha ----------
function vistaFicha() {
  const c = cliente(S.id);
  if (!c) return `<header class="top"><a class="icon-btn" href="#/clientes" aria-label="Volver">${ICON.atras}</a></header><section class="vacio"><p class="lead">Esa persona ya no está en tus clientes.</p></section>`;
  const h = hoy(), movs = (indice(st()).get(c.id) || []).slice();
  const s = situacion(c, movs, h);
  const av = avisos({ ...st(), clientes: [c] }, h);
  const a = av.activos[0], p = av.proximos[0];
  const saludo = llenar("¡Hola {nombre}!", { nombre: primerNombre(c.nombre) });
  return `<header class="top"><a class="icon-btn" href="#/clientes" aria-label="Volver a clientes">${ICON.atras}</a>
      <button class="btn small" data-act="editar" data-id="${esc(c.id)}">${ICON.editar}<span>Editar</span></button></header>
    <section class="ficha-head">${perillaCliente(c, s, 72)}<span class="inicial grande i-${s.estado}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
      <div><h1 class="titulo">${esc(c.nombre)}</h1><p class="sit">${esc(s.texto)}${s.venta && s.venta.cuotas >= 2 && s.estado === "cuotas" ? ", aprox." : ""}</p>
      ${s.estado === "cuotas" ? segmentos(cuotaActual(s.venta, h), s.venta.cuotas) : ""}</div></section>
    ${c.telefono ? `<div class="fila-btns contacto">
      <a class="btn wa" href="${esc(linkWa(c.telefono, saludo))}" target="_blank" rel="noopener noreferrer" data-act="escribir-libre" data-id="${esc(c.id)}">${ICON.chat}<span>WhatsApp</span></a>
      <a class="btn" href="tel:+${esc(c.telefono)}">${ICON.tel}<span>Llamar</span></a></div>
      <p class="tel">${esc(formatearTel(c.telefono))}</p>`
      : `<button class="btn" data-act="editar" data-id="${esc(c.id)}">Agregar su teléfono</button>`}
    ${a ? `<div class="ficha-aviso">${avisoCard(a, true)}</div>` : p ? `<p class="hint prox-ficha">Próximo aviso, ${esc(cuando(p.desde, h).toLowerCase())}: ${esc(p.titulo)}.</p>` : ""}
    <div class="acciones">
      <button class="btn" data-act="nueva-venta" data-id="${esc(c.id)}">Anotar venta</button>
      <button class="btn" data-act="nueva-consulta" data-id="${esc(c.id)}">Anotar consulta</button>
      <button class="btn" data-act="nueva-nota" data-id="${esc(c.id)}">Anotar mensaje o nota</button>
    </div>
    <dl class="datos">
      ${(c.intereses || []).length ? `<div><dt>Le interesa</dt><dd>${c.intereses.map(i => `<span class="chip quieto">${esc(i)}</span>`).join(" ")}</dd></div>` : ""}
      ${c.origen ? `<div><dt>De dónde vino</dt><dd>${esc(c.origen)}</dd></div>` : ""}
      ${c.cumple ? `<div><dt>Cumple</dt><dd>${esc(fechaCumple(c.cumple))}</dd></div>` : ""}
      ${c.nota ? `<div><dt>Nota</dt><dd class="nota">${esc(c.nota)}</dd></div>` : ""}
    </dl>
    <label class="switch"><input type="checkbox" data-act="sin-promos" data-id="${esc(c.id)}" ${c.sinPromos ? "checked" : ""}>
      <span><b>No ofrecerle más</b><small>No aparece en promos ni en avisos de venta. Siguen el cumple y la postventa.</small></span></label>
    <h2 class="sub">Historial</h2>
    ${movs.length ? `<ol class="historial">${movs.reverse().map(m => movRow(m, h)).join("")}</ol>` : `<p class="hint">Todavía no hay nada anotado.</p>`}
    <button class="link peligro" data-act="borrar-cliente" data-id="${esc(c.id)}">Borrar a ${esc(primerNombre(c.nombre))} de mis clientes</button>`;
}
const fechaCumple = mmdd => { const [m, d] = mmdd.split("-").map(Number); return `${d} de ${MESES[m - 1]}`; };
function movRow(m, h) {
  const extra = [];
  if (m.tipo === "venta") {
    if (m.medio) extra.push(medioTexto(m.medio) + (m.cuotas >= 2 ? ` en ${m.cuotas} cuotas` : m.cuotas === 1 ? " en 1 pago" : ""));
    if (m.monto != null) extra.push(plata(m.monto));
  }
  if (m.tipo === "promo" && m.motivo) extra.push(`Promo «${m.motivo}»`);
  if (m.tipo === "mensaje" && m.motivo) extra.push(motivoTexto(m.motivo));
  return `<li class="mov m-${m.tipo}"><div class="mov-head"><span class="mov-tipo">${esc(TIPOS[m.tipo] || m.tipo)}</span><time datetime="${esc(m.fecha)}">${esc(fechaCorta(m.fecha, h))}</time>
    <button class="icon-btn small" data-act="mov-menu" data-id="${esc(m.id)}" aria-label="Opciones de este movimiento">${ICON.puntos}</button></div>
    ${m.producto ? `<p class="mov-prod">${esc(m.producto)}</p>` : ""}${extra.length ? `<p class="mov-extra">${esc(extra.join(", "))}</p>` : ""}
    ${m.detalle ? `<p class="mov-det">${esc(m.detalle)}</p>` : ""}</li>`;
}
const motivoTexto = k => ({ cumple: "Saludo de cumple", seg: "Seguimiento de la consulta", volver: "Volver a ofrecer", post: "Postventa", cuota: "Aviso de cuotas", quieto: "Retomar el contacto" }[String(k).split(":")[0]] || "");

// ---------- formularios: anotar ----------
function chipsCheck(name, opciones, marcadas, tipo = "checkbox") {
  const set = new Set((marcadas || []).map(lower));
  return opciones.map(o => `<label class="chip-in"><input type="${tipo}" name="${name}" value="${esc(o)}" ${set.has(lower(o)) ? "checked" : ""}><span>${esc(o)}</span></label>`).join("");
}
const fechaInput = (name, val) => `<input type="date" name="${name}" value="${esc(val || hoy())}" max="${hoy()}" min="2000-01-01" required>`;
function bloqueQuien(pref) {
  if (pref) return `<input type="hidden" name="cid" value="${esc(pref.id)}"><p class="quien">${esc(pref.nombre)}${pref.telefono ? ` <span>${esc(formatearTel(pref.telefono))}</span>` : ""}</p>`;
  return `<input type="hidden" name="cid" value="">
    <label class="fld"><span>Teléfono</span><span class="con-btn"><input name="tel" inputmode="tel" autocomplete="off" placeholder="11 2345-6789" data-in="tel" autofocus>
      ${navigator.clipboard && navigator.clipboard.readText ? `<button type="button" class="btn small" data-act="pegar">Pegar</button>` : ""}</span></label>
    <p class="hint tel-hint" aria-live="polite">Copialo del chat de WhatsApp y tocá Pegar.</p>
    <label class="fld"><span>Nombre</span><input name="nombre" maxlength="80" autocomplete="off" list="dl-nombres" data-in="nombre" required></label>
    <datalist id="dl-nombres">${st().clientes.slice(0, 2000).map(c => `<option value="${esc(c.nombre)}"></option>`).join("")}</datalist>`;
}
function abrirConsulta(pref) {
  const a = aj();
  const prods = [...new Set([...a.productos, ...((pref && pref.intereses) || [])])];
  openSheet(`<form class="form" data-form="consulta" novalidate>
    <h2>Me consultaron</h2>
    ${bloqueQuien(pref)}
    <fieldset><legend>¿Qué le interesó?</legend><div class="chips">${chipsCheck("prod", prods, [])}</div>
      <label class="fld otro"><span>Otro producto</span><input name="otro" maxlength="40" placeholder="Por ejemplo, Pava"></label></fieldset>
    ${!pref || !pref.origen ? `<fieldset><legend>¿De dónde vino?</legend><div class="chips">${chipsCheck("origen", a.origenes, [], "radio")}</div></fieldset>` : ""}
    <details class="mas"><summary>Fecha y nota</summary>
      <label class="fld"><span>¿Cuándo?</span>${fechaInput("fecha")}</label>
      <label class="fld"><span>Nota</span><textarea name="detalle" maxlength="1000" rows="3" placeholder="Lo que preguntó, si quiere cuotas…"></textarea></label></details>
    <button class="btn primary big" type="submit">Guardar consulta</button>
  </form>`, { label: "Anotar una consulta" });
}
function abrirVenta(pref) {
  const a = aj();
  const prods = [...new Set([...a.productos, ...((pref && pref.intereses) || [])])];
  openSheet(`<form class="form" data-form="venta" novalidate>
    <h2>Vendí</h2>
    ${bloqueQuien(pref)}
    <fieldset><legend>¿Qué compró?</legend><div class="chips">${chipsCheck("prod", prods, [])}</div>
      <label class="fld otro"><span>Otro producto</span><input name="otro" maxlength="40"></label></fieldset>
    <fieldset><legend>¿Cómo pagó?</legend><div class="chips">${MEDIOS.map(([k, t]) => `<label class="chip-in"><input type="radio" name="medio" value="${k}" data-in="medio"><span>${t}</span></label>`).join("")}</div></fieldset>
    <fieldset class="cuotas" hidden><legend>¿En cuántas cuotas?</legend><div class="chips">${CUOTAS.map(n => `<label class="chip-in"><input type="radio" name="cuotas" value="${n}" data-in="cuotas" ${n === 12 ? "checked" : ""}><span>${n === 1 ? "1 pago" : n}</span></label>`).join("")}
      <label class="chip-in"><input type="radio" name="cuotas" value="otra" data-in="cuotas"><span>Otra</span></label></div>
      <label class="fld otro cuotas-otra" hidden><span>Cantidad de cuotas</span><input name="cuotasOtra" type="number" min="1" max="60" inputmode="numeric"></label></fieldset>
    <label class="fld"><span>Monto <small>(si querés)</small></span><input name="monto" inputmode="decimal" placeholder="$ 350.000" autocomplete="off"></label>
    <label class="fld"><span>¿Cuándo fue?</span>${fechaInput("fecha")}</label>
    <details class="mas"><summary>Agregar una nota</summary>
      <label class="fld"><span>Nota</span><textarea name="detalle" maxlength="1000" rows="3" placeholder="Entrega, color, lo que haga falta"></textarea></label></details>
    <p class="hint">Nunca anotes el número de la tarjeta: con el medio y las cuotas alcanza.</p>
    <button class="btn primary big" type="submit">Guardar venta</button>
  </form>`, { label: "Anotar una venta" });
}
function abrirNota(c) {
  openSheet(`<form class="form" data-form="nota" novalidate>
    <h2>${esc(c.nombre)}</h2><input type="hidden" name="cid" value="${esc(c.id)}">
    <fieldset><legend>¿Qué anotás?</legend><div class="chips">
      <label class="chip-in"><input type="radio" name="tipo" value="mensaje" checked><span>Le escribí o la llamé</span></label>
      <label class="chip-in"><input type="radio" name="tipo" value="nota"><span>Una nota</span></label></div></fieldset>
    <p class="hint">«Le escribí» cuenta como contacto: apaga los avisos de esos días. Una nota no.</p>
    <label class="fld"><span>¿Cuándo?</span>${fechaInput("fecha")}</label>
    <label class="fld"><span>Detalle</span><textarea name="detalle" maxlength="1000" rows="3"></textarea></label>
    <button class="btn primary big" type="submit">Guardar</button>
  </form>`, { label: "Anotar mensaje o nota" });
}
function abrirAnotar() {
  openSheet(`<h2>¿Qué pasó?</h2><div class="opciones">
    <button class="paso" data-act="nueva-consulta"><b>Me consultaron</b><span>Alguien preguntó por una pieza.</span></button>
    <button class="paso" data-act="nueva-venta"><b>Vendí</b><span>Con medio de pago y cuotas. Sirve para ventas viejas.</span></button>
  </div>`, { label: "Anotar" });
}
// Mientras escribe el teléfono o el nombre: ¿ya la tiene?
function buscarExistente(form, desde) {
  const tel = form.querySelector('[name="tel"]'), nom = form.querySelector('[name="nombre"]'), cid = form.querySelector('[name="cid"]'), hint = form.querySelector(".tel-hint");
  if (!tel || !hint) return;
  const n = normalizarTel(tel.value, aj().caracteristica);
  let c = null;
  if (desde === "tel" && n) c = st().clientes.find(x => x.telefono === n);
  if (desde === "nombre") {
    const v = lower(nom.value);
    const m = v ? st().clientes.filter(x => lower(x.nombre) === v) : [];
    if (m.length === 1) { c = m[0]; if (c.telefono && !tel.value) tel.value = formatearTel(c.telefono); }
  }
  if (c) {
    cid.value = c.id;
    if (desde === "tel" && !nom.value) nom.value = c.nombre;
    hint.textContent = `Ya está en tus clientes: ${c.nombre}. Se suma a su historial.`;
    hint.classList.add("ok-msg");
    return;
  }
  cid.value = "";
  hint.classList.remove("ok-msg");
  hint.textContent = !tel.value.trim() ? "Copialo del chat de WhatsApp y tocá Pegar." : n ? `Queda como ${formatearTel(n)}.` : "Revisá el número: así no lo entiende WhatsApp.";
}
function leerQuien(f) {
  const cid = f.cid.value;
  if (cid) { const c = cliente(cid); if (c) return { ...c }; }
  const nombre = (f.nombre ? f.nombre.value : "").trim();
  const rawTel = f.tel ? f.tel.value.trim() : "";
  const telefono = normalizarTel(rawTel, aj().caracteristica);
  if (rawTel && !telefono) throw Object.assign(new Error("bad_tel"), { code: "bad_tel" });
  if (!nombre) throw Object.assign(new Error("falta_nombre"), { code: "falta_nombre" });
  return { nombre, telefono, intereses: [], origen: "", nota: "" };
}
const marcados = (f, name) => [...f.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
function sinTarjeta(...textos) { if (textos.some(t => pareceTarjeta(t))) throw Object.assign(new Error("tarjeta"), { code: "tarjeta" }); }
async function sumarProducto(nuevo) {
  const a = aj();
  if (!nuevo || a.productos.some(p => lower(p) === lower(nuevo)) || a.productos.length >= 40) return;
  await Store.guardarAjustes({ ...a, productos: [...a.productos, nuevo] });
}
const SUBMIT = {
  consulta: safe(async f => {
    const quien = leerQuien(f);
    const otro = f.otro.value.trim();
    const prods = [...marcados(f, "prod"), ...(otro ? [otro] : [])];
    const detalle = f.detalle.value.trim();
    sinTarjeta(detalle, otro);
    const origen = marcados(f, "origen")[0] || quien.origen || "";
    const r = await Store.registrar({ ...quien, intereses: [...(quien.intereses || []), ...prods], origen },
      { tipo: "consulta", fecha: f.fecha.value || hoy(), producto: prods.join(" + "), detalle });
    if (otro) await sumarProducto(otro).catch(() => {});
    closeSheet();
    render();
    toast(r.yaEstaba ? `Sumé la consulta a ${r.cliente.nombre}.` : `Anotada la consulta de ${r.cliente.nombre}. Te aviso en ${aj().dias.seguimiento} días si no compró.`);
  }),
  venta: safe(async f => {
    const quien = leerQuien(f);
    const otro = f.otro.value.trim();
    const prods = [...marcados(f, "prod"), ...(otro ? [otro] : [])];
    const medio = marcados(f, "medio")[0] || "";
    let cuotas = null;
    if (CON_CUOTAS.has(medio)) {
      const c = marcados(f, "cuotas")[0];
      cuotas = c === "otra" ? Number(f.cuotasOtra.value) : Number(c);
      if (!(cuotas >= 1 && cuotas <= 60)) throw Object.assign(new Error("bad_cuotas"), { code: "bad_cuotas" });
    }
    const monto = f.monto.value.trim() ? leerMonto(f.monto.value) : null;
    if (f.monto.value.trim() && monto == null) throw Object.assign(new Error("bad_monto"), { code: "bad_monto" });
    const detalle = f.detalle.value.trim();
    sinTarjeta(detalle, otro, f.monto.value);
    const r = await Store.registrar(quien, { tipo: "venta", fecha: f.fecha.value || hoy(), producto: prods.join(" + "), medio, cuotas, monto, detalle });
    if (otro) await sumarProducto(otro).catch(() => {});
    closeSheet();
    render();
    toast(cuotas >= 2 ? `Anotada la venta. Te aviso en la cuota ${hitos(cuotas)[0]} de ${cuotas}.` : `Anotada la venta a ${r.cliente.nombre}.`);
  }),
  nota: safe(async f => {
    const detalle = f.detalle.value.trim();
    sinTarjeta(detalle);
    const tipo = marcados(f, "tipo")[0] || "nota";
    if (tipo === "nota" && !detalle) throw Object.assign(new Error("Escribí la nota."), { code: "Escribí la nota." });
    await Store.agregarMov({ clienteId: f.cid.value, tipo, fecha: f.fecha.value || hoy(), detalle });
    closeSheet();
    render();
    toast("Anotado.");
  }),
  cliente: safe(async f => {
    const c = cliente(f.cid.value);
    const rawTel = f.tel.value.trim();
    const telefono = normalizarTel(rawTel, aj().caracteristica);
    if (rawTel && !telefono) throw Object.assign(new Error("bad_tel"), { code: "bad_tel" });
    const nota = f.nota.value.trim();
    sinTarjeta(nota, f.otro.value);
    const otro = f.otro.value.trim();
    const dia = f.cdia.value, mes = f.cmes.value;
    if ((dia && !mes) || (!dia && mes)) throw Object.assign(new Error("bad_cumple"), { code: "bad_cumple" });
    const cumple = dia && mes ? `${pad(mes)}-${pad(dia)}` : null;
    if (cumple && !proximoCumple(cumple, hoy())) throw Object.assign(new Error("bad_cumple"), { code: "bad_cumple" });
    await Store.guardarCliente({ id: c.id, nombre: f.nombre.value.trim(), telefono, intereses: [...marcados(f, "prod"), ...(otro ? [otro] : [])],
      origen: marcados(f, "origen")[0] || "", cumple, nota, sinPromos: f.sinPromos.checked });
    closeSheet();
    render();
    toast("Guardado.");
  }),
};
function abrirEditar(c) {
  const a = aj();
  const prods = [...new Set([...a.productos, ...(c.intereses || [])])];
  const [cm, cd] = c.cumple ? c.cumple.split("-").map(Number) : [0, 0];
  openSheet(`<form class="form" data-form="cliente" novalidate>
    <h2>Editar</h2><input type="hidden" name="cid" value="${esc(c.id)}">
    <label class="fld"><span>Nombre</span><input name="nombre" maxlength="80" value="${esc(c.nombre)}" required></label>
    <label class="fld"><span>Teléfono</span><span class="con-btn"><input name="tel" inputmode="tel" value="${esc(c.telefono ? formatearTel(c.telefono) : "")}" data-in="tel-edit">
      ${navigator.clipboard && navigator.clipboard.readText ? `<button type="button" class="btn small" data-act="pegar">Pegar</button>` : ""}</span></label>
    <p class="hint tel-hint" aria-live="polite">${c.telefono ? `Para WhatsApp: ${esc(formatearTel(c.telefono))}` : "Sin teléfono no se le puede escribir desde la app."}</p>
    <fieldset><legend>Le interesa</legend><div class="chips">${chipsCheck("prod", prods, c.intereses)}</div>
      <label class="fld otro"><span>Otro</span><input name="otro" maxlength="40"></label></fieldset>
    <fieldset><legend>De dónde vino</legend><div class="chips">${chipsCheck("origen", [...new Set([...a.origenes, ...(c.origen ? [c.origen] : [])])], c.origen ? [c.origen] : [], "radio")}</div></fieldset>
    <fieldset><legend>Cumple <small>(si lo sabés)</small></legend><div class="fila">
      <label class="fld"><span>Día</span><select name="cdia"><option value=""></option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${cd === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label>
      <label class="fld"><span>Mes</span><select name="cmes"><option value=""></option>${MESES.map((m, i) => `<option value="${i + 1}" ${cm === i + 1 ? "selected" : ""}>${m}</option>`).join("")}</select></label></div></fieldset>
    <label class="fld"><span>Nota</span><textarea name="nota" maxlength="1000" rows="3">${esc(c.nota)}</textarea></label>
    <label class="switch"><input type="checkbox" name="sinPromos" ${c.sinPromos ? "checked" : ""}><span><b>No ofrecerle más</b><small>No aparece en promos ni en avisos de venta.</small></span></label>
    <button class="btn primary big" type="submit">Guardar</button>
  </form>`, { label: "Editar cliente" });
}

// ---------- escribir por WhatsApp desde un aviso ----------
async function anotarEscrito(c, clave, tipo = "mensaje", motivo) {
  const m = await Store.agregarMov({ clienteId: c.id, tipo, fecha: hoy(), motivo: motivo || clave || "" });
  render();
  toast(`Anotado: le escribiste a ${primerNombre(c.nombre)}.`, { label: "Deshacer", fn: async () => { await Store.borrarMov(m.id); render(); toast("Listo, no quedó anotado."); } });
  return m;
}
function mostrarEjemploWa(texto) {
  openSheet(`<h2>Así saldría el mensaje</h2><p class="hint">En el ejemplo no se abre WhatsApp. Con tu cuenta, este botón abre el chat con el mensaje escrito y lo podés cambiar antes de mandarlo.</p>
    <blockquote class="msg grande">${esc(texto)}</blockquote><button class="btn primary big" data-act="sheet-close">Entendido</button>`, { label: "Ejemplo de mensaje" });
}
function abrirPosponer(a) {
  openSheet(`<h2>${esc(a.nombre)}</h2><p class="motivo">${esc(a.titulo)}</p>
    <div class="opciones">
      <button class="opt" data-act="pos" data-clave="${esc(a.clave)}" data-d="3">Recordarme en 3 días</button>
      <button class="opt" data-act="pos" data-clave="${esc(a.clave)}" data-d="7">Recordarme en una semana</button>
      <button class="opt" data-act="pos" data-clave="${esc(a.clave)}" data-d="30">Recordarme en un mes</button>
      <button class="opt" data-act="ya-escribi" data-clave="${esc(a.clave)}" data-id="${esc(a.clienteId)}">Ya le escribí por otro lado</button>
      <button class="opt peligro" data-act="descartar" data-clave="${esc(a.clave)}">No mostrar más este aviso</button>
    </div>`, { label: "Más tarde o descartar" });
}
const avisoPorClave = clave => { const r = avisos(st(), hoy()); return r.activos.find(a => a.clave === clave) || r.proximos.find(a => a.clave === clave); };

// ---------- promos ----------
function vistaPromos() {
  if (S.envio) return vistaEnvio();
  const P = S.promo, a = aj(), h = hoy();
  if (P.texto == null) P.texto = a.plantillas.promo;
  const lista = segmento(st(), P, h);
  const prim = lista[0];
  const prev = prim ? llenar(P.texto, { nombre: primerNombre(prim.cliente.nombre), producto: enFrase(prim.producto) }) : "";
  const intereses = [...new Set([...a.productos, ...st().clientes.flatMap(c => c.intereses || [])])];
  const guardada = leerEnvio();
  return `<header class="top"><h1 class="titulo chico">Promos</h1></header>
    <p class="lead">Elegís a quiénes, escribís el mensaje una vez y la app te los va pasando de a uno para mandarlo desde tu WhatsApp.</p>
    ${guardada ? `<div class="bloque seguir"><p>Te quedó a medias la promo <b>«${esc(guardada.nombre)}»</b>: ${guardada.i} de ${guardada.ids.length}.</p><div class="fila-btns"><button class="btn primary" data-act="envio-seguir">Seguir</button><button class="link" data-act="envio-borrar">Descartarla</button></div></div>` : ""}
    <section class="paso-promo"><h2 class="sub">¿A quiénes?</h2>
      <p class="legend">Les interesa o compraron</p>
      <div class="chips">${intereses.map(i => `<button class="chip${P.intereses.some(x => lower(x) === lower(i)) ? " on" : ""}" aria-pressed="${P.intereses.some(x => lower(x) === lower(i))}" data-act="p-int" data-v="${esc(i)}">${esc(i)}</button>`).join("")}</div>
      <p class="legend">Situación</p>
      <div class="chips">${ESTADOS_PROMO.map(([k, t]) => `<button class="chip${P.estado === k ? " on" : ""}" aria-pressed="${P.estado === k}" data-act="p-est" data-v="${k}">${t}</button>`).join("")}</div>
      <label class="fld"><span>Sin promo en los últimos</span><select data-in="p-dias">${[[0, "No importa"], [15, "15 días"], [30, "30 días"], [60, "60 días"], [90, "90 días"]].map(([v, t]) => `<option value="${v}" ${P.sinPromoDias === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <p class="resultado"><b>${plural(lista.length, "persona", "personas")}</b>${lista.length ? `: ${esc(lista.slice(0, 4).map(x => primerNombre(x.cliente.nombre)).join(", "))}${lista.length > 4 ? " y más" : ""}` : ". Probá con otro filtro."}</p>
      <p class="hint">No aparecen quienes marcaste «No ofrecerle más» ni quienes no tienen teléfono.</p>
    </section>
    <section class="paso-promo"><h2 class="sub">El mensaje</h2>
      <label class="fld"><span>Nombre de la promo <small>(queda en el historial de cada uno)</small></span><input data-in="p-nombre" maxlength="60" value="${esc(P.nombre)}" placeholder="Por ejemplo, Día de la Madre"></label>
      <label class="fld"><span>Texto</span><textarea data-in="p-texto" rows="5" maxlength="700">${esc(P.texto)}</textarea></label>
      <div class="fila-btns"><button class="btn small" data-act="p-var" data-v="{nombre}">+ nombre</button><button class="btn small" data-act="p-var" data-v="{producto}">+ producto</button></div>
      <p class="hint">{nombre} se cambia por el nombre de cada uno y {producto} por lo que le interesó o compró. Lo que pongas entre corchetes, como «[ de {producto}]», se saca si no hay producto.</p>
      ${prev ? `<p class="legend">Así le llega a ${esc(primerNombre(prim.cliente.nombre))}</p><blockquote class="msg grande prev-promo">${esc(prev)}</blockquote>` : ""}
    </section>
    <button class="btn primary big" data-act="envio-empezar" ${lista.length ? "" : "disabled"}>Empezar a mandar${lista.length ? ` (${lista.length})` : ""}</button>
    <p class="hint">Mandar de a uno, desde tu número y a gente que te conoce, es lo que evita que WhatsApp te bloquee. Si son muchos, repartilos en varios días.</p>`;
}
const ENVIO = () => "vigente.envio." + ((Store.auth.user() || {}).id || "ejemplo");
function leerEnvio() { try { const e = JSON.parse(localStorage.getItem(ENVIO()) || "null"); return e && Array.isArray(e.ids) && e.i < e.ids.length ? e : null; } catch (x) { return null; } }
function guardarEnvio() { try { if (S.envio) localStorage.setItem(ENVIO(), JSON.stringify(S.envio)); else localStorage.removeItem(ENVIO()); } catch (x) { /* nada */ } }
function vistaEnvio() {
  const E = S.envio;
  while (E.i < E.ids.length && !cliente(E.ids[E.i])) E.i++;
  if (E.i >= E.ids.length) {
    return `<header class="top"><h1 class="titulo chico">${esc(E.nombre)}</h1></header>
      <section class="vacio"><p class="lead">Listo: le mandaste a ${plural(E.hechos, "persona", "personas")}. Cada envío quedó anotado en su historial.</p>
      <button class="btn primary big" data-act="envio-fin">Terminar</button></section>`;
  }
  const c = cliente(E.ids[E.i]);
  const texto = llenar(E.texto, { nombre: primerNombre(c.nombre), producto: enFrase(E.prods && E.prods[c.id]) });
  return `<header class="top"><button class="icon-btn" data-act="envio-pausa" aria-label="Pausar la promo">${ICON.atras}</button><h1 class="titulo chico">${esc(E.nombre)}</h1></header>
    <p class="progreso"><span>${E.i + 1} de ${E.ids.length}</span><progress max="${E.ids.length}" value="${E.i}"></progress></p>
    <article class="aviso envio">
      <div class="aviso-top">${perilla({ tipo: "persona" })}<div class="aviso-main"><h2>${esc(c.nombre)}</h2><p class="motivo">${esc(formatearTel(c.telefono))}</p></div></div>
      <p class="msg">${esc(texto)}</p>
      <div class="aviso-acts"><a class="btn wa big" href="${esc(linkWa(c.telefono, texto))}" target="_blank" rel="noopener noreferrer" data-act="envio-wa">${ICON.chat}<span>Abrir WhatsApp</span></a></div>
    </article>
    <div class="fila-btns"><button class="btn" data-act="envio-saltar">Saltear</button><button class="link" data-act="envio-pausa">Pausar y seguir después</button></div>`;
}

// ---------- importar ----------
function vistaImportar() {
  const im = S.imp;
  const picker = "contacts" in navigator && "ContactsManager" in window;
  if (!im) {
    return `<header class="top"><a class="icon-btn" href="#/clientes" aria-label="Volver a clientes">${ICON.atras}</a><h1 class="titulo chico">Traer contactos</h1></header>
      <p class="lead">Elegís cuáles. Vigente no cambia ni borra nada de tu agenda, y solo ve los contactos que elijas.</p>
      ${picker ? `<button class="btn primary big" data-act="imp-agenda">${ICON.agenda}<span>Elegir de mis contactos</span></button>` : ""}
      <label class="btn ${picker ? "" : "primary "}big archivo">${ICON.bajar}<span>Subir un archivo de contactos</span><input type="file" accept=".vcf,.csv,text/vcard,text/csv,text/x-vcard" data-in="imp-archivo"></label>
      <details class="bloque"><summary>Cómo sacar el archivo del celular</summary>
        <ol class="lista-texto"><li>Abrí la app <b>Contactos</b>.</li><li>Entrá a <b>Arreglar y administrar</b> (o a los tres puntos, <b>Configuración</b>).</li><li>Tocá <b>Exportar a un archivo</b>: se guarda un <b>.vcf</b> en Descargas.</li><li>Volvé acá y subilo.</li></ol>
        <p class="hint">También sirve un .csv de Google Contactos o de Excel, con una columna de nombre y una de teléfono.</p></details>
      <p class="hint">Si agendás a tus clientas con lo que te preguntaron («Laura bifera»), Vigente lo reconoce y las marca primero.</p>`;
  }
  const q = lower(im.q);
  const vis = im.filas.filter(f => !q || lower(f.nombre).includes(q) || f.telefono.includes(im.q.replace(/\D/g, "") || "~"));
  const n = [...im.marcados].length;
  const sug = im.filas.filter(f => f.sugerido && !f.yaEsta).length;
  return `<header class="top"><button class="icon-btn" data-act="imp-cancelar" aria-label="Cancelar">${ICON.atras}</button><h1 class="titulo chico">Elegí a quiénes</h1></header>
    <p class="lead">${plural(im.filas.length, "contacto con teléfono", "contactos con teléfono")}.${sug ? ` Marqué ${plural(sug, "que tiene", "que tienen")} un producto en el nombre.` : ""}</p>
    <label class="buscar">${ICON.buscar}<input type="search" data-in="imp-q" value="${esc(im.q)}" placeholder="Buscar" aria-label="Buscar contactos"></label>
    <div class="fila-btns"><button class="btn small" data-act="imp-todos">Marcar ${vis.length === im.filas.length ? "todos" : "estos"}</button><button class="btn small" data-act="imp-ninguno">Desmarcar</button></div>
    <ul class="imp">${vis.slice(0, 400).map(f => `<li><label class="imp-row${f.yaEsta ? " ya" : ""}"><input type="checkbox" data-in="imp-check" value="${esc(f.telefono)}" ${im.marcados.has(f.telefono) ? "checked" : ""} ${f.yaEsta ? "disabled" : ""}>
      <span class="cli-txt"><b>${esc(f.nombre)}</b><span>${esc(formatearTel(f.telefono))}${f.yaEsta ? ". Ya está en tus clientes" : ""}</span>
      ${f.intereses.length ? `<span class="cli-chips">${f.intereses.map(i => `<span class="chip quieto">${esc(i)}</span>`).join("")}</span>` : ""}</span></label></li>`).join("")}</ul>
    ${vis.length > 400 ? `<p class="hint">Se muestran 400. Buscá para encontrar al resto.</p>` : ""}
    <div class="pie-fijo"><button class="btn primary big" data-act="imp-ok" ${n ? "" : "disabled"}>Importar ${plural(n, "contacto", "contactos")}</button></div>`;
}
function prepararImport(contactos) {
  const filas = aImportar(contactos, aj(), st().clientes.map(c => c.telefono).filter(Boolean));
  S.imp = { filas, marcados: new Set(filas.filter(f => f.sugerido && !f.yaEsta).map(f => f.telefono)), q: "" };
  if (!filas.length) { S.imp = null; toast("No encontré contactos con teléfono en eso."); }
  render();
}

// ---------- ajustes ----------
const NOMBRES_PLANTILLA = [["seguimiento", "Seguimiento de una consulta"], ["volver", "Volver a ofrecer"], ["postventa", "Postventa"], ["cuota", "A mitad de las cuotas"],
  ["fin", "Terminó de pagar"], ["quieto", "Hace mucho que no hablan"], ["cumple", "Cumpleaños"], ["promo", "Promo (cómo empieza)"]];
function vistaAjustes() {
  const a = aj(), u = Store.auth.user();
  return `<header class="top"><a class="icon-btn" href="#/hoy" aria-label="Volver">${ICON.atras}</a><h1 class="titulo chico">Ajustes</h1></header>
  <form class="form ajustes" data-form="ajustes" novalidate>
    <section><h2 class="sub">Tus productos</h2><p class="hint">Son como tus etiquetas de WhatsApp: aparecen para marcar qué le interesó a cada uno.</p>
      <div class="chips">${a.productos.map(p => `<span class="chip on edit">${esc(p)}<button type="button" data-act="aj-quitar" data-k="productos" data-v="${esc(p)}" aria-label="Quitar ${esc(p)}">${ICON.cerrar}</button></span>`).join("")}</div>
      <span class="con-btn"><input name="nuevoProducto" maxlength="40" placeholder="Agregar un producto" aria-label="Producto nuevo"><button type="button" class="btn small" data-act="aj-sumar" data-k="productos" data-f="nuevoProducto">Agregar</button></span></section>
    <section><h2 class="sub">De dónde vienen las consultas</h2>
      <div class="chips">${a.origenes.map(p => `<span class="chip on edit">${esc(p)}<button type="button" data-act="aj-quitar" data-k="origenes" data-v="${esc(p)}" aria-label="Quitar ${esc(p)}">${ICON.cerrar}</button></span>`).join("")}</div>
      <span class="con-btn"><input name="nuevoOrigen" maxlength="30" placeholder="Agregar un origen" aria-label="Origen nuevo"><button type="button" class="btn small" data-act="aj-sumar" data-k="origenes" data-f="nuevoOrigen">Agregar</button></span></section>
    <section><h2 class="sub">Cuándo te aviso</h2>
      <label class="fld fila-num"><span>Seguimiento de una consulta, a los</span><input name="d-seguimiento" type="number" min="1" max="60" value="${a.dias.seguimiento}" inputmode="numeric"><span>días</span></label>
      <label class="fld fila-num"><span>Volver a ofrecer si no compró, a los</span><input name="d-volver" type="number" min="7" max="180" value="${a.dias.volver}" inputmode="numeric"><span>días</span></label>
      <label class="fld fila-num"><span>Postventa, a los</span><input name="d-postventa" type="number" min="1" max="90" value="${a.dias.postventa}" inputmode="numeric"><span>días</span></label>
      <label class="fld fila-num"><span>Si no hablan hace</span><input name="d-quieto" type="number" min="30" max="365" value="${a.dias.quieto}" inputmode="numeric"><span>días</span></label>
      <p class="hint">Las cuotas avisan solas: a la mitad, a las tres cuartas partes y en la última.</p></section>
    <section><h2 class="sub">Los mensajes</h2><p class="hint">{nombre} se cambia por el nombre y {producto} por lo que le interesó o compró. Lo que va entre corchetes se saca si no hay producto. En WhatsApp lo podés cambiar antes de mandarlo.</p>
      ${NOMBRES_PLANTILLA.map(([k, t]) => `<label class="fld"><span>${t}</span><textarea name="pl-${k}" rows="3" maxlength="700">${esc(a.plantillas[k])}</textarea></label>`).join("")}
      <button type="button" class="link" data-act="aj-original">Volver a los mensajes originales</button></section>
    <section><h2 class="sub">Teléfonos</h2>
      <label class="fld fila-num"><span>Característica si no la escribís</span><input name="caracteristica" inputmode="numeric" maxlength="5" value="${esc(a.caracteristica)}"></label>
      <p class="hint">Con 11, «15 2345-6789» queda como +54 9 11 2345-6789.</p></section>
    <button class="btn primary big" type="submit">Guardar ajustes</button>
  </form>
  <section class="bloque estilos"><h2 class="sub">Estilo de la app</h2><p class="hint">Queda guardado en este celular. Cambia cómo se ve, no lo que tenés cargado.</p>
    ${opcionesEstilo()}</section>
  <section class="bloque"><h2 class="sub">Tus datos</h2><p class="hint">Bajalos cada tanto: es tu copia, y se abren con Excel o Google Sheets.</p>
    <div class="fila-btns"><button class="btn" data-act="bajar-clientes">${ICON.bajar}<span>Clientes</span></button><button class="btn" data-act="bajar-movs">${ICON.bajar}<span>Historial completo</span></button></div></section>
  ${S.install ? `<section class="bloque"><h2 class="sub">En el celular</h2><button class="btn" data-act="instalar">Instalar Vigente</button></section>` : ""}
  <section class="bloque"><h2 class="sub">Tu cuenta</h2>
    <p class="hint">${u && u.demo ? "Estás en el ejemplo." : `Entraste como <b>${esc(u && u.email)}</b>.`}</p>
    <div class="opciones">
      ${u && u.demo ? `<button class="opt" data-act="demo-salir">Salir del ejemplo</button>` : `<button class="opt" data-act="clave">Cambiar la contraseña</button><button class="opt" data-act="salir">Salir</button>`}
      <button class="opt" data-act="privacidad">Cómo se cuidan los datos</button>
      <button class="opt peligro" data-act="borrar-todo">Borrar todos mis datos de Vigente</button>
    </div></section>`;
}
function opcionesEstilo() {
  const actual = document.documentElement.dataset.tema;
  return `<div class="estilos-op" role="radiogroup" aria-label="Estilo de la app">${TEMAS.map(([k, t, d]) => `<button class="estilo-op${actual === k ? " on" : ""}" role="radio" aria-checked="${actual === k}" data-act="tema" data-t="${k}">
    <span class="estilo-muestra" data-tema="${k}" aria-hidden="true"><span class="em-titulo">Hoy</span><span class="em-fila"><span class="em-tag"></span><span class="em-linea"></span></span><span class="em-fila"><span class="em-tag b"></span><span class="em-linea"></span></span><span class="em-boton"></span></span>
    <span class="estilo-txt"><b>${t}</b><span>${d}</span></span></button>`).join("")}</div>`;
}
function bajar(nombre, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function leerFlag(k) { try { return localStorage.getItem("vigente." + k) === "1"; } catch (e) { return false; } }
function ponerFlag(k) { try { localStorage.setItem("vigente." + k, "1"); } catch (e) { /* nada */ } }

// ---------- acciones ----------
const ACT = {
  "sheet-close": () => closeSheet(),
  "toast-undo": safe(async () => { const u = toastUndo; $("#toast").hidden = true; toastUndo = null; if (u) await u.fn(); }),
  reload: () => location.reload(),
  "auth-mode": el => { S.authMode = el.dataset.m; S.authMsg = null; render(); },
  olvide: () => openSheet(`<form class="form" data-form="olvide" novalidate><h2>Recuperar la contraseña</h2>
    <label class="fld"><span>Tu mail</span><input name="email" type="email" autocomplete="email" required autofocus></label>
    <p class="hint">Te mandamos un link para elegir una nueva. Si no llega en unos minutos, mirá en spam o avisale a quien te pasó la app.</p>
    <button class="btn primary big" type="submit">Mandarme el link</button></form>`, { label: "Recuperar la contraseña" }),
  privacidad: () => openSheet(textoPrivacidad(), { label: "Cómo se cuidan los datos" }),
  demo: safe(async () => { Store.startDemo(); await cargar(); go("hoy"); }),
  "demo-salir": () => { Store.stopDemo(); S.ready = false; S.envio = null; render(); },
  salir: safe(async () => { await Store.auth.signOut(); S.ready = false; S.envio = null; render(); }),
  anotar: () => abrirAnotar(),
  "nueva-consulta": el => { const c = el.dataset.id && cliente(el.dataset.id); abrirConsulta(c || null); },
  "nueva-venta": el => { const c = el.dataset.id && cliente(el.dataset.id); abrirVenta(c || null); },
  "nueva-nota": el => { const c = cliente(el.dataset.id); if (c) abrirNota(c); },
  ficha: el => go("c/" + encodeURIComponent(el.dataset.id)),
  editar: el => { const c = cliente(el.dataset.id); if (c) abrirEditar(c); },
  pegar: safe(async el => {
    const inp = el.closest(".con-btn").querySelector("input");
    try { inp.value = (await navigator.clipboard.readText()).trim().slice(0, 40); } catch (e) { toast("No pude leer lo copiado. Mantené apretado el campo y elegí Pegar."); return; }
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }),
  escribir: (el, e) => {
    const a = avisoPorClave(el.dataset.clave), c = cliente(el.dataset.id);
    if (!c) return;
    if (Store.demo) { e.preventDefault(); if (a) mostrarEjemploWa(a.mensaje); }
    safe(() => anotarEscrito(c, el.dataset.clave))();
  },
  "escribir-libre": (el, e) => {
    const c = cliente(el.dataset.id);
    if (!c) return;
    if (Store.demo) { e.preventDefault(); mostrarEjemploWa(llenar("¡Hola {nombre}!", { nombre: primerNombre(c.nombre) })); }
    safe(() => anotarEscrito(c, ""))();
  },
  posponer: el => { const a = avisoPorClave(el.dataset.clave); if (a) abrirPosponer(a); },
  pos: safe(async el => {
    const d = Number(el.dataset.d);
    await Store.marcarAviso(el.dataset.clave, "pospuesto", sumarDias(hoy(), d));
    closeSheet(); render();
    toast(d === 3 ? "Te lo recuerdo en 3 días." : d === 7 ? "Te lo recuerdo en una semana." : "Te lo recuerdo en un mes.", { label: "Deshacer", fn: async () => { await Store.quitarAviso(el.dataset.clave); render(); } });
  }),
  "ya-escribi": safe(async el => { const c = cliente(el.dataset.id); closeSheet(); if (c) await anotarEscrito(c, el.dataset.clave); }),
  descartar: safe(async el => {
    const clave = el.dataset.clave;
    await Store.marcarAviso(clave, "descartado", null);
    closeSheet(); render();
    toast("Listo, ese aviso no aparece más.", { label: "Deshacer", fn: async () => { await Store.quitarAviso(clave); render(); } });
  }),
  filtro: el => { S.filtro = el.dataset.f; S.limite = 80; render(); },
  "ver-mas": () => { S.limite += 80; render(); },
  "sin-promos": safe(async el => {
    const c = cliente(el.dataset.id);
    await Store.guardarCliente({ ...c, sinPromos: el.checked });
    render();
    toast(el.checked ? `${primerNombre(c.nombre)} no va a aparecer en promos ni en avisos de venta.` : `${primerNombre(c.nombre)} vuelve a aparecer en promos.`);
  }),
  "mov-menu": el => {
    const m = st().movimientos.find(x => x.id === el.dataset.id);
    if (!m) return;
    openSheet(`<h2>${esc(TIPOS[m.tipo])} del ${esc(fechaCorta(m.fecha, hoy()))}</h2>${m.producto ? `<p class="motivo">${esc(m.producto)}</p>` : ""}
      <div class="opciones"><button class="opt peligro" data-act="mov-borrar" data-id="${esc(m.id)}">Borrar este movimiento</button></div>`, { label: "Movimiento" });
  },
  "mov-borrar": safe(async el => { await Store.borrarMov(el.dataset.id); closeSheet(); render(); toast("Borrado."); }),
  "borrar-cliente": el => {
    const c = cliente(el.dataset.id);
    openSheet(`<h2>¿Borrar a ${esc(c.nombre)}?</h2><p class="lead">Se borra con todo su historial. No se puede deshacer.</p>
      <div class="opciones"><button class="opt peligro" data-act="borrar-cliente-ok" data-id="${esc(c.id)}">Sí, borrar</button><button class="opt" data-act="sheet-close">No, dejarla</button></div>`, { label: "Borrar cliente" });
  },
  "borrar-cliente-ok": safe(async el => { const c = cliente(el.dataset.id); await Store.borrarCliente(el.dataset.id); hideSheet(); go("clientes"); toast(`Borré a ${c ? c.nombre : "esa persona"}.`); }),
  // promos
  "p-int": el => { const v = el.dataset.v, P = S.promo; P.intereses = P.intereses.some(x => lower(x) === lower(v)) ? P.intereses.filter(x => lower(x) !== lower(v)) : [...P.intereses, v]; render(); },
  "p-est": el => { S.promo.estado = el.dataset.v; render(); },
  "p-var": el => {
    const ta = document.querySelector('[data-in="p-texto"]');
    const i = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, i) + el.dataset.v + ta.value.slice(ta.selectionEnd ?? i);
    S.promo.texto = ta.value;
    render();
  },
  "envio-empezar": () => {
    const P = S.promo;
    const lista = segmento(st(), P, hoy());
    if (!lista.length) return;
    if (pareceTarjeta(P.texto)) { toast(errText({ code: "tarjeta" })); return; }
    const nombre = (P.nombre || "").trim() || `Promo del ${fechaCorta(hoy(), hoy())}`;
    S.envio = { nombre: nombre.slice(0, 60), texto: P.texto, ids: lista.map(x => x.cliente.id), prods: Object.fromEntries(lista.map(x => [x.cliente.id, x.producto])), i: 0, hechos: 0 };
    guardarEnvio(); render(); window.scrollTo(0, 0);
  },
  "envio-seguir": () => { S.envio = leerEnvio(); render(); },
  "envio-borrar": () => { S.envio = null; guardarEnvio(); render(); },
  "envio-wa": (el, e) => {
    const E = S.envio, c = cliente(E.ids[E.i]);
    if (Store.demo) { e.preventDefault(); mostrarEjemploWa(llenar(E.texto, { nombre: primerNombre(c.nombre), producto: enFrase(E.prods && E.prods[c.id]) })); }
    safe(async () => {
      await Store.agregarMov({ clienteId: c.id, tipo: "promo", fecha: hoy(), motivo: E.nombre, producto: (E.prods && E.prods[c.id]) || "" });
      E.i++; E.hechos++; guardarEnvio();
      setTimeout(render, 400); // que se vea el cambio al volver de WhatsApp
    })();
  },
  "envio-saltar": () => { S.envio.i++; guardarEnvio(); render(); },
  "envio-pausa": () => { S.envio = null; render(); toast("Quedó guardada: la seguís desde Promos."); },
  "envio-fin": () => { S.envio = null; guardarEnvio(); render(); },
  // importar
  "imp-agenda": safe(async () => {
    let lista;
    try { lista = await navigator.contacts.select(["name", "tel"], { multiple: true }); } catch (e) { return; }
    prepararImport((lista || []).map(c => ({ nombre: (c.name || [])[0] || "", telefonos: c.tel || [] })));
  }),
  "imp-todos": () => { const q = lower(S.imp.q); S.imp.filas.filter(f => !f.yaEsta && (!q || lower(f.nombre).includes(q))).forEach(f => S.imp.marcados.add(f.telefono)); render(); },
  "imp-ninguno": () => { S.imp.marcados.clear(); render(); },
  "imp-cancelar": () => { S.imp = null; render(); },
  "imp-ok": safe(async () => {
    const elegidos = S.imp.filas.filter(f => S.imp.marcados.has(f.telefono) && !f.yaEsta).map(f => ({ nombre: f.nombre, telefono: f.telefono, intereses: f.intereses }));
    const r = await Store.importar(elegidos);
    S.imp = null;
    go("clientes");
    toast(`Importé ${plural(r.creados.length, "contacto", "contactos")}${r.repetidos ? ` (${r.repetidos} ya estaban)` : ""}.`);
  }),
  // ajustes
  "aj-quitar": el => { el.closest(".chip").remove(); ajustesSucios = true; },
  "aj-sumar": el => {
    const inp = document.querySelector(`[name="${el.dataset.f}"]`);
    const v = inp.value.trim();
    if (!v) return;
    const box = el.closest("section").querySelector(".chips");
    if ([...box.querySelectorAll(".chip")].some(x => lower(x.textContent) === lower(v))) { inp.value = ""; return; }
    box.insertAdjacentHTML("beforeend", `<span class="chip on edit">${esc(v)}<button type="button" data-act="aj-quitar" data-k="${esc(el.dataset.k)}" data-v="${esc(v)}" aria-label="Quitar ${esc(v)}">${ICON.cerrar}</button></span>`);
    inp.value = "";
    ajustesSucios = true;
  },
  "aj-original": () => { for (const [k] of NOMBRES_PLANTILLA) { const t = document.querySelector(`[name="pl-${k}"]`); if (t) t.value = DEFAULTS.plantillas[k]; } toast("Puse los originales. Tocá Guardar ajustes."); },
  "tema-ok": () => { ponerFlag("tema-elegido"); render(); },
  tema: el => {
    const t = el.dataset.t;
    ponerFlag("tema-elegido");
    try { localStorage.setItem("vigente.tema", t); } catch (e) { /* sin almacenamiento: dura hasta cerrar */ }
    aplicarTema(t);
    render();
    toast(`Estilo ${TEMAS.find(x => x[0] === t)[1]}.`);
  },
  "bajar-clientes": () => bajar(`vigente-clientes-${hoy()}.csv`, csvClientes(st(), hoy())),
  "bajar-movs": () => bajar(`vigente-historial-${hoy()}.csv`, csvMovimientos(st())),
  instalar: async () => { const p = S.install; if (!p) return; S.install = null; p.prompt(); try { await p.userChoice; } catch (e) { /* nada */ } render(); },
  "instalar-no": () => { ponerFlag("instalar-no"); render(); },
  clave: () => openSheet(`<form class="form" data-form="clave" novalidate><h2>Contraseña nueva</h2>
    <label class="fld"><span>Contraseña nueva</span><input name="pass" type="password" minlength="8" autocomplete="new-password" required autofocus></label>
    <p class="hint">Al menos 8 caracteres. Cambia también en las otras apps de esta cuenta.</p><button class="btn primary big" type="submit">Cambiar</button></form>`, { label: "Cambiar la contraseña" }),
  "borrar-todo": () => {
    const n = st().clientes.length;
    openSheet(`<form class="form" data-form="borrar-todo" novalidate><h2>¿Borrar todo?</h2>
      <p class="lead">Se borran tus ${plural(n, "cliente", "clientes")}, el historial, los avisos y los ajustes de Vigente. No se puede deshacer. La cuenta queda (es la misma de las otras apps).</p>
      <p class="hint">Antes, si querés, bajá una copia desde «Tus datos».</p>
      <label class="fld"><span>Para confirmar, escribí BORRAR</span><input name="ok" autocomplete="off" autocapitalize="characters" required></label>
      <button class="btn peligro big" type="submit">Borrar todo</button></form>`, { label: "Borrar todos mis datos" });
  },
};
let ajustesSucios = false;
Object.assign(SUBMIT, {
  login: async f => {
    const email = f.email.value.trim(), pass = f.pass.value;
    S.authMsg = null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { S.authMsg = { text: "Revisá el mail: parece que está mal escrito." }; render(); return; }
    if (pass.length < (S.authMode === "signup" ? 8 : 6)) { S.authMsg = { text: "La contraseña tiene que tener al menos 8 caracteres." }; render(); return; }
    const btn = f.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = S.authMode === "signup" ? "Creando…" : "Entrando…";
    try {
      if (S.authMode === "signup") {
        const r = await Store.auth.signUp(email, pass);
        if (r.needsConfirmation) { S.authMsg = { ok: true, text: "Te mandamos un mail para confirmar la cuenta. Abrí el link y después entrá acá con tu mail y contraseña." }; S.authMode = "login"; render(); return; }
      } else await Store.auth.signIn(email, pass);
      // el aviso de sesión nueva (Store.auth.subscribe, abajo) trae los datos
      if (location.hash !== "#/hoy") location.hash = "#/hoy";
    } catch (e) { S.authMsg = { text: e.message }; render(); }
  },
  olvide: safe(async f => {
    const email = f.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Revisá el mail: parece que está mal escrito.");
    await Store.auth.reset(email);
    closeSheet();
    toast("Listo. Si ese mail tiene cuenta, te llega el link en unos minutos.");
  }),
  clave: safe(async f => {
    if (f.pass.value.length < 8) throw new Error("La contraseña tiene que tener al menos 8 caracteres.");
    await Store.auth.updatePassword(f.pass.value);
    closeSheet();
    toast("Contraseña cambiada.");
  }),
  "borrar-todo": safe(async f => {
    if (f.ok.value.trim().toUpperCase() !== "BORRAR") throw new Error("Escribí BORRAR para confirmar.");
    await Store.borrarTodo();
    hideSheet(); S.envio = null; guardarEnvio();
    go("hoy");
    toast("Borré todos tus datos de Vigente.");
  }),
  ajustes: safe(async f => {
    const lee = k => [...f.querySelectorAll(`.chip.edit button[data-k="${k}"]`)].map(b => b.dataset.v);
    const plantillas = {};
    for (const [k] of NOMBRES_PLANTILLA) {
      const v = f[`pl-${k}`].value.trim();
      if (pareceTarjeta(v)) throw Object.assign(new Error("tarjeta"), { code: "tarjeta" });
      if (v && v !== DEFAULTS.plantillas[k]) plantillas[k] = v;
    }
    const num = (k, lo, hi) => { const n = Number(f[`d-${k}`].value); if (!(n >= lo && n <= hi)) throw new Error(`Revisá los días: van de ${lo} a ${hi}.`); return n; };
    const dias = { seguimiento: num("seguimiento", 1, 60), volver: num("volver", 7, 180), postventa: num("postventa", 1, 90), quieto: num("quieto", 30, 365) };
    if (dias.volver <= dias.seguimiento) throw new Error("«Volver a ofrecer» tiene que ser después del seguimiento.");
    const productos = lee("productos"), origenes = lee("origenes");
    if (!productos.length) throw new Error("Dejá al menos un producto.");
    const car = f.caracteristica.value.replace(/\D/g, "").replace(/^0+/, "");
    if (!/^\d{2,4}$/.test(car)) throw new Error("La característica tiene entre 2 y 4 números, por ejemplo 11 o 351.");
    await Store.guardarAjustes({ productos, origenes: origenes.length ? origenes : DEFAULTS.origenes, caracteristica: car, dias, plantillas });
    ajustesSucios = false;
    render();
    toast("Ajustes guardados.");
  }),
});

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.tagName === "INPUT") { fn(el, e); return; }
  if (el.tagName !== "A") e.preventDefault();
  fn(el, e);
});
document.addEventListener("submit", e => {
  const f = e.target, fn = SUBMIT[f.dataset.form];
  if (!fn) return;
  e.preventDefault();
  const box = f.closest("#sheet") && $("#sheet .form-err");
  if (box) box.hidden = true;
  fn(f);
});
let tBuscar = null;
document.addEventListener("input", e => {
  const el = e.target, k = el.dataset && el.dataset.in;
  if (!k) return;
  if (k === "buscar") { clearTimeout(tBuscar); tBuscar = setTimeout(() => { S.q = el.value; S.limite = 80; const pos = el.selectionStart; render(); const n = $('[data-in="buscar"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 160); }
  else if (k === "tel" || k === "nombre") buscarExistente(el.form, k);
  else if (k === "tel-edit") { const h = el.form.querySelector(".tel-hint"); const n = normalizarTel(el.value, aj().caracteristica); h.textContent = !el.value.trim() ? "Sin teléfono no se le puede escribir desde la app." : n ? `Para WhatsApp: ${formatearTel(n)}` : "Revisá el número: así no lo entiende WhatsApp."; }
  else if (k === "medio") { const fs = el.form.querySelector(".cuotas"); fs.hidden = !CON_CUOTAS.has(el.value); }
  else if (k === "cuotas") { const o = el.form.querySelector(".cuotas-otra"); o.hidden = el.value !== "otra"; if (!o.hidden) o.querySelector("input").focus(); }
  else if (k === "p-texto") { S.promo.texto = el.value; const prev = $(".prev-promo"); const l = segmento(st(), S.promo, hoy()); if (prev && l[0]) prev.textContent = llenar(el.value, { nombre: primerNombre(l[0].cliente.nombre), producto: enFrase(l[0].producto) }); }
  else if (k === "p-nombre") S.promo.nombre = el.value;
  else if (k === "imp-q") { clearTimeout(tBuscar); tBuscar = setTimeout(() => { S.imp.q = el.value; const pos = el.selectionStart; render(); const n = $('[data-in="imp-q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 200); }
});
document.addEventListener("change", e => {
  const el = e.target, k = el.dataset && el.dataset.in;
  if (!k) return;
  if (k === "p-dias") { S.promo.sinPromoDias = Number(el.value); render(); }
  else if (k === "imp-check") { if (el.checked) S.imp.marcados.add(el.value); else S.imp.marcados.delete(el.value); const b = $('[data-act="imp-ok"]'); const n = S.imp.marcados.size; if (b) { b.disabled = !n; b.textContent = `Importar ${plural(n, "contacto", "contactos")}`; } }
  else if (k === "imp-archivo") {
    const file = el.files && el.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast("El archivo es muy grande (más de 15 MB)."); return; }
    file.text().then(t => {
      const lista = /BEGIN:VCARD/i.test(t) ? parsearVCF(t) : parsearCSV(t);
      prepararImport(lista);
    }).catch(() => toast("No pude leer ese archivo."));
  }
});
// Si un estilo todavía no tiene ilustración, la imagen se oculta (sin atributos onerror: la CSP no los deja).
document.addEventListener("error", e => { const t = e.target; if (t && t.matches && t.matches("img[data-ilustra]")) t.hidden = true; }, true);
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); S.install = e; if (S.route === "hoy" || S.route === "ajustes") render(); });
window.addEventListener("beforeunload", e => { if (ajustesSucios && S.route === "ajustes") { e.preventDefault(); e.returnValue = ""; } });

async function cargar() {
  S.ready = false; S.loadErr = null;
  render();
  try { await Store.load(); S.ready = true; }
  catch (e) {
    if (e.code === "no_auth") { await Store.auth.signOut(); }
    else S.loadErr = e;
  }
  render();
}
// Al volver a la app (por ejemplo, después de mandar un WhatsApp), la fecha puede haber cambiado: se vuelve a dibujar.
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.ready && !sheetOn) render(); });

(async function init() {
  leerRuta();
  S.mode = await Store.init();
  // Fuera del aviso de Supabase (setTimeout): llamar a la base adentro del aviso puede trabar la sesión.
  Store.auth.subscribe(ev => setTimeout(() => {
    if (ev === "recovery") { ACT.clave(); return; }
    S.ready = false;
    if (Store.auth.user()) cargar(); else render();
  }, 0));
  if (S.mode !== "offline" && Store.auth.user()) await cargar(); else render();
  const q = new URLSearchParams(location.search);
  if (S.ready && q.get("anotar")) {
    history.replaceState({}, "", location.pathname + location.hash);
    if (q.get("anotar") === "venta") abrirVenta(null); else abrirConsulta(null);
  }
  if ("serviceWorker" in navigator && S.mode === "db") navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
