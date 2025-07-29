## API de WhatsApp con Baileys para n8n

Este proyecto expone una API REST ligera y escalable, basada en la librería [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys), empaquetada en Docker Compose. Ideal para consumirla desde n8n u otras aplicaciones y enviar mensajes de WhatsApp de forma automatizada.

---

### 🚀 Características principales

- **Multi-Device oficial**: registra clientes secundarios sin depender del teléfono principal.
- **WebSocket nativo**: conexión directa a WhatsApp sin navegador.
- **Evolution API**: wrapper RESTful sobre Baileys, sin licencias de pago.
- **Inicio y reconexión veloces**: segundos de arranque.
- **Persistencia automática**: credenciales en JSON (`useMultiFileAuthState`).
- **Ligero en recursos**: bajo consumo de CPU/memoria.
- **Alta resiliencia**: estable ante cambios en la interfaz web.
- **Endpoints REST**: enviar mensajes, obtener QR y estado.
- **Reconexion automática**: manejo de eventos `connection.update`.
- **Soporte multimedia**: texto, imágenes, audio, video, documentos, grupos, contactos, ubicación y enlaces.

---

### 📋 Requisitos previos

- **Docker** (v20+)
- **Docker Compose**

---

### ⚙️ Instalación rápida

1. Clona o copia los archivos (`app.js`, `package.json`, `Dockerfile`, `docker-compose.yml`).
2. Crea carpeta de sesión:
   ```bash
   mkdir auth_info_baileys
   ```
3. Arranca el servicio:
   ```bash
   docker-compose up -d
   ```
4. Escanea el QR (solo primera vez):
   ```bash
   docker-compose logs -f
   ```
   Escanea con WhatsApp; al ver `Conexión abierta!`, detén logs con `Ctrl+C`.

---

### 📡 API REST

| Método | Ruta            | Descripción                          |
| ------ | --------------- | ------------------------------------ |
| `POST` | `/send-message` | Envía texto a un número o grupo.     |
| `GET`  | `/qr-code`      | QR en base64 para autenticar sesión. |
| `GET`  | `/session`      | Estado de la conexión.               |

(Podés extender `src/index.js` para soportar archivos, stickers, audio, etc.)

**Ejemplo **`curl`**:**

```bash
curl -X POST http://localhost:3001/send-message \
  -H "Content-Type: application/json" \
  -d '{"number":"5491122334455","message":"Hola desde la API!"}'
```

---

### 📤 Integración en n8n

Para enviar un mensaje desde n8n, usa el nodo **HTTP Request**:

- **URL**: `http://host.docker.internal:3001/send-message`
- **Método**: `POST`
- **Body (JSON)**:
  ```json
  {
    "number": "5491122334455",
    "message": "Hola desde la API!"
  }
  ```

---

### 🔧 Configuración avanzada

- **Puerto**: define `PORT` en `docker-compose.yml`.
- **Volúmenes cifrados**: protege `auth_info_baileys/`.
- **Red interna**: restringe acceso al API.
- **Proxy & rate limit**: Nginx o Traefik.

---

### 🔄 Errores y reconexiones

```js
sock.ev.on('connection.update', update => {
  if (update.connection === 'close') {
    console.error('Desconectado:', update.lastDisconnect?.error);
  }
});
```

- Para nuevo login: borra `auth_info_baileys/` y reinicia.

---

### 📈 Escalabilidad

- Instancias paralelas con carpetas `auth_info_baileys_X`.
- Balanceo: load balancer o DNS round-robin.
- Backups periódicos de sesiones.

---

### 🌐 Comunidad

- ⭐ \~6 100 estrellas en GitHub.
- Documentación en mejora continua.

---

### 🎯 Comandos útiles

```bash
# Logs en tiempo real
docker-compose logs -f

# Detener y limpiar
docker-compose down

# Pausar
docker-compose stop

# Reanudar
docker-compose start
```

---
