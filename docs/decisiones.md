# Vigente: decisiones y pruebas (19/10/2026)

Nombre provisorio. Sale de cómo lo dijo Naty: «mantenerme vigente». No usa el nombre, el logo ni los colores de Essen: la app es de la emprendedora, no de la marca, y así la pueden usar las de otras marcas.

## Qué problema resuelve

Naty vende piezas de cocina de venta directa. Le escriben por WhatsApp Business personas que vieron su publicidad paga, y ella etiqueta cada chat con lo que le preguntaron («cacerola 24», «bifera»). Lo que no tiene es **cuándo volver a escribirle a cada una**: la que consultó y no compró, la que va por la mitad de las cuotas, la que compró hace un mes.

**La competencia no es otra app: son las etiquetas de WhatsApp Business y un Excel.** Las etiquetas no guardan fechas, ni cuotas, ni cuándo se le mandó la última promo, y WhatsApp Business permite hasta 20 por cuenta. Ninguna app de afuera las puede leer.

**Para quién:** la emprendedora que vende sola desde el celular Android (Naty) y, después, otras emprendedoras («una herramienta copada para las demás»). Cada una con su cuenta.

## La idea central: arrancar por «Hoy», no por la base de datos

Lo que le aconsejan («armá una base de datos») es la parte que más trabajo pide y la que menos devuelve el primer día. Si carga 200 contactos y la app no le dice nada nuevo, vuelve a las etiquetas.

Por eso la pantalla principal es **Hoy: a quién escribirle y por qué**, con el mensaje ya escrito y un botón que abre WhatsApp. La base se arma sola a medida que registra consultas y ventas (20 segundos cada una).

## Los avisos (las reglas están en `src/logic.js` y tienen pruebas)

Un solo aviso por persona a la vez (el más importante), para que «Hoy» no se llene. Un aviso se da por hecho cuando hay cualquier contacto con esa persona desde el día del aviso (un mensaje, una promo, una consulta o una venta; una nota no cuenta). Los de venta, además, si le escribió en las 2 semanas anteriores. Se puede posponer (3 días, una semana, un mes), marcar «Ya le escribí por otro lado» o descartar.

## La perilla

Cada persona tiene una perilla, como la de una hornalla o un timer de cocina: con cuotas, un segmento por cuota y las pagadas en azafrán (la cuota actual en el centro). Es lo único con color fuerte de la app, además del botón de WhatsApp en verde albahaca. El ícono es la misma perilla: 6 de 12.

| Aviso | Cuándo aparece | Por cuánto | Ejemplo |
|---|---|---|---|
| Cumple | El día (el anterior aparece en «Próximos») | 1 día | «Hoy cumple años» |
| Seguimiento de consulta | 3 días después de una consulta sin venta | hasta el día 30 | «Consultó por la bifera hace 3 días» |
| Postventa | 10 días después de una venta | 30 días | «Compró hace 10 días: preguntale cómo le va» |
| Cuotas | Al llegar a la mitad, a las tres cuartas partes y a la última cuota | 30 días cada una | «Va por la cuota 6 de 12» |
| Volver a ofrecer | 30 días después de una consulta sin venta | 30 días | «Consultó hace un mes y no compró» |
| Sin contacto | 90 días sin ningún movimiento, solo si alguna vez compró | hasta que haya contacto | «Hace 3 meses que no hablan» |

- **Cuotas:** la cuota *k* se cuenta a *k* meses de la fecha de compra (la primera llega con el resumen siguiente). Es aproximado y la app lo dice («cuota 6 de 12, aprox.»). Con 12 cuotas avisa en la 6, la 9 y la 12, como lo contó Naty. Con 18, en la 9, la 14 y la 18. Con 3, en la 2 y la 3.
- **Los días se cambian en Ajustes** (seguimiento, volver a ofrecer, postventa, sin contacto).
- **«No ofrecerle más»:** la persona sale de los avisos de venta (seguimiento, cuotas, volver a ofrecer, sin contacto) y de las promos. Siguen el cumple y la postventa, que no son para vender. Es la forma de respetar al que pidió que no le escriban.
- Los contactos importados que nunca tuvieron una consulta ni una venta no generan avisos: si no, a los 90 días aparecerían todos juntos. Se les llega con una promo.

## Mandar mensajes: siempre desde su WhatsApp, de a uno

- Cada botón abre `wa.me` con el mensaje escrito. Naty lo puede cambiar en WhatsApp antes de mandarlo.
- **No hay envío automático ni masivo.** Mandar muchos mensajes iguales desde un número común es lo que hace que WhatsApp lo bloquee, y la API oficial es paga y pide plantillas aprobadas.
- **Promos:** se elige a quién (por producto, si compró o no, cuotas en curso, sin promo en los últimos N días), se escribe el mensaje con `{nombre}` y `{producto}`, y la app la lleva de a una persona: «Abrir WhatsApp», volver, la siguiente. Cada envío queda anotado con el nombre de la promo, así sabe a quién le mandó qué y cuándo.
- Al abrir WhatsApp, la app anota el contacto y ofrece «Deshacer» por si al final no lo mandó.

## Cargar datos sin que pese

- **Nueva consulta:** nombre, teléfono (con botón «Pegar»: el número se copia del chat de WhatsApp), producto o productos (los suyos, como sus etiquetas), de dónde vino (publicidad, Instagram, recomendación, feria, otro) y una nota. Si el teléfono ya está, suma la consulta a esa persona.
- **Nueva venta:** producto, fecha, medio de pago (crédito, débito, efectivo, transferencia, Mercado Pago), cuotas (si es crédito) y monto, que es opcional.
- **Importar contactos:** en Android, Chrome deja elegir contactos de la agenda (se elige cuáles, la app no ve el resto). También acepta el archivo que exporta la app Contactos (.vcf) o un .csv. **Si el contacto se llama «Laura bifera», sugiere el interés «Bifera» y lo marca para importar**: así suele agendar Naty a sus clientas.
- **Teléfonos argentinos:** se entienden «011 15-2345-6789», «+54 9 11 2345 6789», «2345-6789» (con la característica de Ajustes, 11 por defecto) y se guardan como `5491123456789`, que es lo que pide WhatsApp. La ficha muestra el número armado para que se pueda corregir.
- Lo que la app no puede hacer: leer las etiquetas ni los chats de WhatsApp Business. Ninguna app de afuera puede.

## Números del mes

Consultas, ventas, cuántas en cuotas y **de dónde vienen las ventas** (publicidad, Instagram, recomendación…). Naty paga publicidad: saber cuántas consultas de la publicidad terminan en venta es lo que le dice si le conviene.

## Seguridad y privacidad

Son datos personales de terceros (nombre, teléfono, qué compró y cómo pagó). Decisiones:

- **Cuenta con mail y contraseña** (Supabase Auth, la misma de Tachán y La Vaquita). Cada emprendedora ve solo sus clientes: se verifica en la base con la sesión, no en la pantalla.
- **Las tablas no se pueden leer ni escribir directo** (RLS activado y sin permisos para `anon` ni `authenticated`). Todo pasa por funciones `vg_` que toman el dueño de la sesión (`auth.uid()`), nunca de lo que manda el celular.
- **Nunca se guarda un número de tarjeta.** La venta solo pide medio y cuotas. Si en una nota aparece algo que parece una tarjeta (de 15 a 19 dígitos que pasan la verificación de Luhn), la app no lo guarda y la base lo rechaza también.
- **Topes:** 5.000 clientes por cuenta, 500 movimientos por cliente, textos con largo máximo, fechas y montos con rango. Cada dato se valida en la base.
- **Sin rastreadores ni servicios de terceros**: solo Supabase y las fuentes de Google. CSP estricta en `vercel.json`, todo lo que escribe el usuario se muestra escapado.
- **Sus datos son suyos:** «Descargar mis datos» baja un .csv con todo (sirve de copia y para llevárselos). «Borrar todos mis datos» borra lo de Vigente y deja la cuenta, que es compartida con las otras apps.
- **«No ofrecerle más»** también es privacidad: la Ley 25.326 de datos personales prevé que quien recibe publicidad pueda pedir que lo saquen de la base. *[Probable: revisarlo con alguien que sepa si la app se ofrece a otras emprendedoras.]*

## Consejo con la IA local (gemma4:26b, lote `consejo-vigente`)

Cuatro personajes leyeron la descripción de la app antes de construirla. Las respuestas se revisaron a mano; las cuatro fueron coherentes con su personaje.

- **Vendedora (Naty):** usaría «Hoy» todos los días. La dejaría si cargar le lleva más de 20 segundos o siente que trabaja doble. *Por eso «Me consultaron» pide solo teléfono (con «Pegar»), nombre y un toque en el producto; la fecha y la nota quedan plegadas.*
- **Otra emprendedora (58 años, cuaderno):** «Números del mes» le parece un lío; importar contactos le da miedo («borrar a alguien sin querer»); le falta pasar el cuaderno. *Los números quedan plegados al final de «Hoy». Importar dice que no cambia ni borra nada de la agenda. «Vendí» acepta fechas viejas para cargar el cuaderno. Letra Atkinson Hyperlegible y botones de 48 px o más.*
- **Escéptica:** miedo a perder los datos y a que WhatsApp bloquee el número. *Los datos viven en la base, no en el celular, y se pueden bajar en .csv. Los mensajes salen de a uno desde su WhatsApp y la app lo explica en Promos.*
- **Clienta (compró en 12 cuotas):** le parece bien la postventa y un mensaje por mes; las promos seguidas la harían bloquear. *Se sumó un respiro: los avisos de venta no aparecen si le escribió en las 2 semanas anteriores, y Promos excluye por defecto a quien recibió una en los últimos 30 días.*

## Qué se reusó

- **De El Fijo (Pechera) y Partila:** la estructura (JavaScript sin frameworks, `build-web.mjs` con nombres por contenido, CSP en `vercel.json`, íconos generados con código), el estilo de pantallas con `data-act` y el aviso con «Deshacer».
- **De Tachán:** el ingreso con mail y contraseña y los mensajes de error en castellano.
- **El mismo proyecto de Supabase**, con tablas propias `vg_` que no tocan las otras apps.

## Cómo se valida en una semana

Naty la usa una semana con sus consultas reales. Funciona si:

1. Registra al menos 10 consultas o ventas sin que se lo recuerden.
2. Abre «Hoy» al menos 4 de los 7 días.
3. Manda al menos 5 mensajes desde un aviso, y al menos uno termina en respuesta o en venta.
4. Dice que no volvería a manejarse solo con las etiquetas.

Si no carga datos, el problema es la carga (ver qué paso le pesa). Si carga pero no abre «Hoy», los avisos no le dicen nada nuevo (ajustar los días o los textos).
