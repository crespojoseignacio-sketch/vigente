// ---------- Vigente: datos ----------
// Con Supabase: la cuenta (mail y contraseña) y las funciones vg_ de supabase/vigente.sql, que solo devuelven lo de la sesión.
// Sin Supabase, o con «Probar con un ejemplo»: todo queda en este navegador, con las mismas reglas básicas.
const Store = (() => {
  const cfg = window.VIGENTE_CONFIG || {};
  const DEMO = "vigente.ejemplo.v1";
  let sb = null;
  let session = null;
  let demo = false;
  let state = null; // {clientes, movimientos, avisos, ajustes}
  const authListeners = new Set();

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const drop = k => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const err = c => Object.assign(new Error(c), { code: c });

  function withTimeout(p, ms) {
    let t;
    return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(err("timeout")), ms); })]).finally(() => clearTimeout(t));
  }
  async function rpc(fn, args) {
    if (demo || !sb) return demoRpc(fn, args || {});
    const { data, error } = await withTimeout(sb.rpc(fn, args || {}), 20000);
    if (error) {
      const m = String(error.message || error.code || "rpc");
      const code = /failed to fetch|network|load failed/i.test(m) ? "offline"
        : /jwt expired|invalid jwt|no_auth/i.test(m) ? "no_auth"
        : /permission denied|could not find the function|schema cache/i.test(m) ? "sin_base" : m;
      throw err(code);
    }
    return data;
  }

  // ---------- cuenta ----------
  function friendly(error) {
    const msg = String((error && error.message) || error || "");
    const code = (error && error.code) || "";
    const t = msg + " " + code;
    if (/invalid login credentials|invalid_credentials/i.test(t)) return err("El mail o la contraseña no son correctos.");
    if (/already (been )?registered|user_already_exists/i.test(t)) return err("Ya hay una cuenta con ese mail. Entrá con tu contraseña.");
    if (/email not confirmed|email_not_confirmed/i.test(t)) return err("Todavía no confirmaste tu mail. Buscá el mail de confirmación (mirá también en spam).");
    if (/weak|pwned|leaked|easy to guess/i.test(t)) return err("Esa contraseña es muy fácil de adivinar. Elegí otra.");
    if (/at least \d+ characters/i.test(t)) return err("La contraseña tiene que tener al menos 8 caracteres.");
    if (/different from the old|same_password/i.test(t)) return err("La contraseña nueva tiene que ser distinta de la anterior.");
    if (/signups? (not allowed|disabled)|signup_disabled/i.test(t)) return err("Por ahora no se pueden crear cuentas nuevas.");
    if (/rate limit|too many|security purposes|over_email_send_rate_limit/i.test(t)) return err("Hiciste varios intentos seguidos. Esperá un minuto y probá de nuevo.");
    if (/invalid.*email|email.*invalid|validation_failed/i.test(t)) return err("Revisá el mail: parece que está mal escrito.");
    if (/failed to fetch|network|load failed/i.test(t)) return err("No hay conexión. Revisá internet y probá de nuevo.");
    return err(msg || "Algo no salió bien. Probá de nuevo.");
  }
  async function run(p) {
    let res;
    try { res = await withTimeout(p, 20000); } catch (e) { throw friendly(e); }
    if (res.error) throw friendly(res.error);
    return res.data;
  }
  const auth = {
    user: () => (demo ? { email: "ejemplo", demo: true } : session && session.user ? { id: session.user.id, email: session.user.email } : null),
    subscribe(cb) { authListeners.add(cb); return () => authListeners.delete(cb); },
    async signUp(email, password) {
      const data = await run(sb.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: location.origin + "/" } }));
      return { needsConfirmation: !data.session };
    },
    async signIn(email, password) { await run(sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })); },
    async reset(email) { await run(sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + "/?nueva-clave=1" })); },
    async updatePassword(password) { await run(sb.auth.updateUser({ password })); },
    async signOut() {
      state = null;
      if (demo) { stopDemo(); return; }
      if (sb) await sb.auth.signOut().catch(() => {});
      session = null;
      authListeners.forEach(l => l());
    },
  };

  async function init() {
    demo = !!read(DEMO, null) || !cfg.supabaseUrl;
    if (cfg.supabaseUrl && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "vigente.sesion" },
      });
      try { session = (await sb.auth.getSession()).data.session; } catch (e) { session = null; }
      sb.auth.onAuthStateChange((ev, s) => {
        const changed = (s && s.user && s.user.id) !== (session && session.user && session.user.id);
        session = s;
        if (ev === "PASSWORD_RECOVERY") authListeners.forEach(l => l("recovery"));
        else if (changed) { state = null; authListeners.forEach(l => l()); }
      });
    } else if (cfg.supabaseUrl) {
      return "offline"; // no cargó la librería de Supabase (sin internet)
    }
    return demo ? "demo" : "db";
  }

  // ---------- estado ----------
  async function load() {
    const s = await rpc("vg_estado");
    state = { clientes: s.clientes || [], movimientos: s.movimientos || [], avisos: s.avisos || [], ajustes: s.ajustes || {} };
    return state;
  }
  const putCliente = c => { const i = state.clientes.findIndex(x => x.id === c.id); if (i >= 0) state.clientes[i] = c; else state.clientes.push(c); };
  const api = {
    async registrar(cliente, movimiento) {
      const r = await rpc("vg_registrar", { p: { cliente, movimiento } });
      putCliente(r.cliente);
      state.movimientos.push(r.movimiento);
      return r;
    },
    async guardarCliente(c) { const r = await rpc("vg_cliente_guardar", { p: c }); putCliente(r); return r; },
    async borrarCliente(id) {
      await rpc("vg_cliente_borrar", { p_id: id });
      state.clientes = state.clientes.filter(c => c.id !== id);
      state.movimientos = state.movimientos.filter(m => m.clienteId !== id);
    },
    async importar(lista) {
      let creados = [], repetidos = 0;
      for (let i = 0; i < lista.length; i += 500) {
        const r = await rpc("vg_clientes_importar", { p: lista.slice(i, i + 500) });
        creados = creados.concat(r.creados || []);
        repetidos += r.repetidos || 0;
        (r.creados || []).forEach(putCliente);
      }
      return { creados, repetidos };
    },
    async agregarMov(m) { const r = await rpc("vg_mov_agregar", { p: m }); state.movimientos.push(r); return r; },
    async borrarMov(id) { await rpc("vg_mov_borrar", { p_id: id }); state.movimientos = state.movimientos.filter(m => m.id !== id); },
    async marcarAviso(clave, estado, hasta) {
      const r = await rpc("vg_aviso_marcar", { p_clave: clave, p_estado: estado, p_hasta: hasta || null });
      state.avisos = state.avisos.filter(a => a.clave !== clave).concat([r]);
      return r;
    },
    async quitarAviso(clave) { await rpc("vg_aviso_quitar", { p_clave: clave }); state.avisos = state.avisos.filter(a => a.clave !== clave); },
    async guardarAjustes(a) { const r = await rpc("vg_ajustes_guardar", { p: a }); state.ajustes = r; return r; },
    async borrarTodo() { await rpc("vg_borrar_todo"); state = { clientes: [], movimientos: [], avisos: [], ajustes: {} }; },
  };

  // ---------- ejemplo (todo en este navegador) ----------
  function startDemo() { save(DEMO, ejemplo()); demo = true; state = null; }
  function stopDemo() { drop(DEMO); demo = !cfg.supabaseUrl; state = null; authListeners.forEach(l => l()); }
  function ejemplo() {
    const hoy = hoyISO();
    const d = n => sumarDias(hoy, n);
    const m = n => sumarMeses(hoy, n);
    const cs = [], ms = [];
    let tel = 0;
    // números que no existen (abonado que empieza con 0), para que nadie le escriba a un desconocido
    const c = (nombre, extra = {}) => { const x = { id: uid(), nombre, telefono: "54911000000" + pad(++tel), intereses: [], origen: "", cumple: null, nota: "", sinPromos: false, creado: new Date().toISOString(), ...extra }; cs.push(x); return x; };
    const mv = (cl, tipo, fecha, extra = {}) => ms.push({ id: uid(), clienteId: cl.id, tipo, fecha, producto: "", medio: "", cuotas: null, monto: null, detalle: "", motivo: "", creado: fecha + "T12:00:00Z", ...extra });
    const laura = c("Laura Pérez", { intereses: ["Bifera"], origen: "Publicidad" });
    mv(laura, "consulta", d(-3), { producto: "Bifera", detalle: "Vio la publicidad de Instagram. Preguntó por cuotas." });
    const marta = c("Marta Gómez", { intereses: ["Cacerola 24"], origen: "Recomendación" });
    mv(marta, "consulta", sumarDias(m(-6), -6), { producto: "Cacerola 24" });
    mv(marta, "venta", sumarDias(m(-6), -2), { producto: "Cacerola 24", medio: "credito", cuotas: 12, monto: 489000 });
    mv(marta, "mensaje", sumarDias(m(-6), 9), { motivo: "postventa" });
    const sofia = c("Sofía Ruiz", { origen: "Instagram" });
    mv(sofia, "venta", d(-10), { producto: "Sartén", medio: "debito", monto: 165000 });
    const ana = c("Ana López", { cumple: d(1).slice(5), origen: "Feria o reunión" });
    mv(ana, "venta", m(-2), { producto: "Wok", medio: "efectivo", monto: 210000 });
    mv(ana, "mensaje", sumarDias(m(-2), 12));
    const carla = c("Carla Díaz", { origen: "Publicidad" });
    mv(carla, "venta", m(-5), { producto: "Combo", medio: "transferencia", monto: 720000 });
    const juli = c("Julieta Sosa", { intereses: ["Wok"], origen: "Publicidad" });
    mv(juli, "consulta", d(-31), { producto: "Wok" });
    mv(juli, "mensaje", d(-27));
    const paula = c("Paula Ferreyra", { intereses: ["Cacerola 20"], origen: "Facebook" });
    mv(paula, "consulta", d(-2), { producto: "Cacerola 20" });
    const romi = c("Romina Castro", { intereses: ["Bifera"], origen: "Recomendación" });
    mv(romi, "venta", m(-3), { producto: "Bifera", medio: "credito", cuotas: 18, monto: 395000 });
    mv(romi, "mensaje", sumarDias(m(-3), 11));
    c("Graciela Torres");
    const elena = c("Elena Martín", { intereses: ["Sartén"], sinPromos: true, nota: "Pidió que no le manden promos." });
    mv(elena, "consulta", d(-5), { producto: "Sartén" });
    return { clientes: cs, movimientos: ms, avisos: [], ajustes: {} };
  }
  function demoRpc(fn, a) {
    const db = read(DEMO, null) || { clientes: [], movimientos: [], avisos: [], ajustes: {} };
    const commit = () => save(DEMO, db);
    const clean = (s, max, campo) => {
      const v = String(s == null ? "" : s).trim();
      if (v.length > max) throw err("largo:" + campo);
      if (pareceTarjeta(v)) throw err("tarjeta");
      return v;
    };
    const lista = v => { const out = []; for (const x of v || []) { const t = clean(x, 40, "etiqueta"); if (t && !out.some(y => y.toLowerCase() === t.toLowerCase())) out.push(t); } return out; };
    const upsert = (p, porTel) => {
      const nombre = clean(p.nombre, 80, "nombre");
      if (!nombre) throw err("falta_nombre");
      const telefono = String(p.telefono || "").replace(/\D/g, "");
      if (telefono && (telefono.length < 6 || telefono.length > 15)) throw err("bad_tel");
      const row = { nombre, telefono, intereses: lista(p.intereses), origen: clean(p.origen, 30, "origen"), cumple: p.cumple || null, nota: clean(p.nota, 1000, "nota"), sinPromos: !!p.sinPromos };
      if (p.id) {
        const c = db.clientes.find(x => x.id === p.id);
        if (!c) throw err("no_existe");
        if (telefono && db.clientes.some(x => x.id !== p.id && x.telefono === telefono)) throw err("tel_repetido");
        Object.assign(c, row);
        return c;
      }
      const ya = telefono && db.clientes.find(x => x.telefono === telefono);
      if (ya && porTel) {
        ya.intereses = lista(ya.intereses.concat(row.intereses));
        if (!ya.origen) ya.origen = row.origen;
        if (!ya.cumple) ya.cumple = row.cumple;
        if (!ya.nota) ya.nota = row.nota;
        return ya;
      }
      if (ya) throw err("tel_repetido");
      const c = { id: uid(), ...row, creado: new Date().toISOString() };
      db.clientes.push(c);
      return c;
    };
    const mov = (cid, p) => {
      if (!db.clientes.some(c => c.id === cid)) throw err("no_existe");
      if (!TIPOS[p.tipo]) throw err("bad_tipo");
      const fecha = p.fecha || hoyISO();
      if (!okISO(fecha) || fecha > sumarDias(hoyISO(), 2)) throw err("bad_fecha");
      const venta = p.tipo === "venta";
      const medio = venta ? p.medio || "" : "";
      const m = { id: uid(), clienteId: cid, tipo: p.tipo, fecha, producto: clean(p.producto, 120, "producto"), medio,
        cuotas: venta && CON_CUOTAS.has(medio) && p.cuotas ? Number(p.cuotas) : null, monto: venta && p.monto != null && p.monto !== "" ? Number(p.monto) : null,
        detalle: clean(p.detalle, 1000, "detalle"), motivo: clean(p.motivo, 80, "motivo"), creado: new Date().toISOString() };
      db.movimientos.push(m);
      return m;
    };
    let r;
    switch (fn) {
      case "vg_estado": r = db; break;
      case "vg_registrar": {
        const tel = String(a.p.cliente.telefono || "").replace(/\D/g, "");
        const ya = !a.p.cliente.id && !!tel && db.clientes.some(c => c.telefono === tel);
        const c = upsert(a.p.cliente, true);
        r = { cliente: c, movimiento: mov(c.id, a.p.movimiento), yaEstaba: ya };
        break;
      }
      case "vg_cliente_guardar": r = upsert(a.p, false); break;
      case "vg_cliente_borrar":
        if (!db.clientes.some(c => c.id === a.p_id)) throw err("no_existe");
        db.clientes = db.clientes.filter(c => c.id !== a.p_id);
        db.movimientos = db.movimientos.filter(m => m.clienteId !== a.p_id);
        break;
      case "vg_clientes_importar": {
        const creados = []; let repetidos = 0;
        for (const e of a.p) {
          const tel = String(e.telefono || "").replace(/\D/g, "");
          if (tel && db.clientes.some(c => c.telefono === tel)) { repetidos++; continue; }
          creados.push(upsert({ ...e, id: null, sinPromos: false }, false));
        }
        r = { creados, repetidos };
        break;
      }
      case "vg_mov_agregar": r = mov(a.p.clienteId, a.p); break;
      case "vg_mov_borrar": db.movimientos = db.movimientos.filter(m => m.id !== a.p_id); break;
      case "vg_aviso_marcar":
        r = { clave: a.p_clave, estado: a.p_estado, hasta: a.p_estado === "pospuesto" ? a.p_hasta : null };
        db.avisos = db.avisos.filter(x => x.clave !== a.p_clave).concat([r]);
        break;
      case "vg_aviso_quitar": db.avisos = db.avisos.filter(x => x.clave !== a.p_clave); break;
      case "vg_ajustes_guardar":
        r = { productos: lista(a.p.productos), origenes: lista(a.p.origenes), caracteristica: a.p.caracteristica, dias: a.p.dias || {}, plantillas: a.p.plantillas || {} };
        db.ajustes = r;
        break;
      case "vg_borrar_todo": db.clientes = []; db.movimientos = []; db.avisos = []; db.ajustes = {}; break;
      default: throw err("bad_fn");
    }
    commit();
    return Promise.resolve(r === undefined ? null : JSON.parse(JSON.stringify(r)));
  }

  return {
    init, load, auth, rpc,
    get state() { return state; },
    get demo() { return demo; },
    get online() { return !!sb; },
    startDemo, stopDemo,
    ...api,
  };
})();
