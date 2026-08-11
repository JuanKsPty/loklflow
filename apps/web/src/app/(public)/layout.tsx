/**
 * El grupo de rutas que abre un cliente desde el QR de su mesa.
 *
 * **Aquí NO se llama a `getServerUser()`, y es deliberado.** Todos los demás layouts de la
 * aplicación lo hacen y redirigen a `/login` si no hay sesión: `(dashboard)`, `waiter`, `kitchen`,
 * `pos` y hasta `(print)`. Quien lea este archivo buscando la comprobación que falta va a querer
 * añadirla, y añadirla rompería la única parte del producto cuyo requisito es funcionar **sin**
 * sesión. Este comentario existe para ese momento.
 *
 * Tampoco monta `SocketProvider`: el gateway de tiempo real rechaza cualquier handshake sin
 * `access_token`, así que un cliente solo conseguiría que `LogThrottle` recogiera sus rechazos.
 * El seguimiento del pedido se hace por sondeo.
 *
 * Ni `OfflineProvider`: la cola sin conexión es del personal. Un cliente sin red no tiene nada que
 * diferir —su único acto de escritura es el pedido, y un pedido a ciegas no sirve a nadie— así que
 * lo correcto es decírselo, no guardárselo.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    // `min-h-dvh` y no `vh`: en un teléfono la barra del navegador se retrae y `vh` deja un hueco
    // que empuja la barra del carrito fuera de la pantalla.
    <div className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
