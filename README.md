# Vigente

**A quién escribirle hoy, y qué decirle.** Para emprendedoras que venden por WhatsApp (empezó con Naty, que vende piezas de cocina de venta directa): anotan cada consulta y cada venta en segundos, y la app les arma la lista del día con el mensaje listo para mandar desde su WhatsApp.

1. **Hoy:** a quién escribirle y por qué. El seguimiento de una consulta que no compró, la postventa, la mitad de las cuotas («va por la cuota 6 de 12»), cuando termina de pagar, el cumple y a quien hace meses que no le habla. Un botón abre WhatsApp con el mensaje escrito; se puede posponer o descartar.
2. **Anotar:** «Me consultaron» (teléfono pegado del chat, nombre, qué le interesó y de dónde vino) o «Vendí» (qué, cómo pagó, cuotas, monto opcional y fecha, también para ventas viejas del cuaderno).
3. **Clientes:** buscar y filtrar, la ficha con su historial, editar, «No ofrecerle más».
4. **Promos:** elegir a quiénes (por producto, si compró, cuotas en curso, sin promo en los últimos días), escribir el mensaje una vez y mandarlo de a uno desde el propio número.
5. **Importar contactos:** de la agenda (Chrome en Android) o de un archivo .vcf/.csv. Si el contacto se llama «Laura bifera», sugiere el interés «Bifera».
6. **Números del mes:** consultas, ventas, cuotas y de dónde vienen las ventas.
7. **Ajustes:** productos, orígenes, días de cada aviso, textos de los mensajes, característica telefónica, descargar los datos, borrar todo.

Por qué está hecha así: `docs/decisiones.md`.

## Ponerla online

Usa el mismo proyecto de **Supabase** que Tachán, La Vaquita, Partila y El Fijo, con tablas propias (`vg_…`), y una cuenta de **Vercel**.

### 1. Tablas en Supabase

1. Supabase → **SQL Editor → New query**.
2. Pegá **todo** `supabase/vigente.sql` y tocá **Run**. Tiene que decir *Success*. Se puede correr más de una vez.

Crea `vg_clientes`, `vg_movimientos`, `vg_avisos`, `vg_ajustes` y las funciones `vg_…`. No toca nada de las otras apps.

### 2. La cuenta (mail y contraseña)

Es la misma cuenta de Supabase que usan Tachán y La Vaquita: quien ya tiene usuario entra con el mismo mail y contraseña.

- En **Authentication → URL Configuration → Redirect URLs** agregá `https://<la-dirección-de-vigente>/**`. Sin eso, los links de «Me olvidé la contraseña» y de confirmación llevan a la dirección principal del proyecto (Tachán).
- Si **Confirm email** está prendido, a cada cuenta nueva le llega un mail para confirmar; la app lo avisa.
- El servicio de mails que trae Supabase solo manda a los miembros del equipo y hasta 2 por hora. Para que «Me olvidé la contraseña» le llegue a cualquiera hace falta un servicio de mails propio (por ejemplo Resend) en **Authentication → Emails → SMTP Settings**.

### 3. Vercel

Importar el repositorio. `vercel.json` ya trae la configuración (sin instalar nada, `node scripts/build-web.mjs`, CSP y encabezados de seguridad). Cada push a `main` se publica solo.

## Cómo está hecha

| Archivo | Qué es |
|---|---|
| `src/logic.js` | Reglas sin pantallas: avisos (cuotas, seguimiento, postventa, cumple…), teléfonos argentinos, plantillas, promos, números del mes, leer .vcf y .csv, armar el .csv para descargar. Se prueba con `node --test`. |
| `src/store.js` | La cuenta (Supabase Auth) y las funciones `vg_`. El ejemplo («Probar con un ejemplo») guarda todo en el navegador. |
| `src/app.js` | Pantallas (JavaScript sin frameworks). |
| `src/styles.css` | Estilos, con modo oscuro. |
| `supabase/vigente.sql` | Tablas, permisos y funciones. |
| `scripts/build-web.mjs` | Arma `dist/` para Vercel (`--demo`: sin base). |
| `scripts/brand/render.mjs` | Genera los íconos y `og.png`. |

### Seguridad y privacidad

- Cada emprendedora ve solo sus clientes: las funciones toman la dueña de la sesión (`auth.uid()`), nunca de lo que manda el celular. Probado con dos cuentas en `supabase/test/test_vigente.sql`.
- Las tablas no se leen ni se escriben directo (RLS activado y sin permisos para `anon` ni `authenticated`).
- Nunca se guarda un número de tarjeta: la app y la base rechazan textos con algo que parece una (15 a 19 dígitos que pasan Luhn).
- Topes: 5.000 clientes por cuenta, 500 movimientos por cliente, textos con largo máximo, fechas y montos con rango.
- El .csv que se descarga neutraliza fórmulas (lo que empieza con `=`, `+`, `-` o `@`).
- Sin rastreadores. CSP estricta, sin estilos ni scripts en línea.

### Probar

```bash
npm test                                             # lógica
node scripts/build-web.mjs --demo && npx serve dist  # verla sin base
psql -f supabase/test/supabase_stub.sql -f supabase/vigente.sql -f supabase/test/test_vigente.sql
```

### Límites conocidos

- No lee las etiquetas ni los chats de WhatsApp Business: ninguna app de afuera puede.
- No manda mensajes sola: cada uno sale de su WhatsApp, de a uno (a propósito, para no arriesgar un bloqueo).
- Las cuotas son aproximadas: la cuota *k* se cuenta *k* meses después de la compra.
- «Elegir de mis contactos» funciona en Chrome para Android. En iPhone, se importa con el archivo.
- No avisa con notificaciones: hay que abrir la app. Instalada en la pantalla de inicio queda a un toque.
