# API de WhatsApp para n8n

Este proyecto expone una API REST ligera y escalable, basada en la librería [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys), y empaquetada con Docker para un despliegue sencillo. Es la solución ideal para ser consumida desde n8n, u otras aplicaciones, y enviar mensajes de WhatsApp de forma automatizada.

## 🚀 Características Principales

Esta implementación se beneficia de las potentes características de la librería Baileys:

- **Multi-Device Oficial**: Se registra como un dispositivo vinculado (cliente secundario), permitiendo que tu teléfono principal funcione de forma independiente y sin necesidad de estar siempre conectado a internet.
- **WebSocket Nativo**: Establece una conexión directa y eficiente con los servidores de WhatsApp, lo que garantiza un bajo consumo de recursos (CPU/memoria) al no depender de un navegador automatizado como Puppeteer.
- **Inicio y Reconexión Veloces**: La conexión se establece en cuestión de segundos. Además, el sistema gestiona automáticamente las desconexiones para mantener el servicio siempre activo (`connection.update`).
- **Persistencia Automática**: Utiliza `useMultiFileAuthState` para guardar las credenciales de la sesión en archivos JSON. Esto permite que la API se reconecte automáticamente tras reinicios sin necesidad de volver a escanear el QR.
- **Alta Resiliencia**: Al comunicarse directamente con la API de WebSockets de WhatsApp, es más estable y menos propenso a fallar por cambios en la interfaz gráfica de WhatsApp Web.
- **Endpoints REST para lo Esencial**: Nuestra implementación provee los endpoints necesarios para enviar mensajes y gestionar la autenticación de la sesión vía QR de forma sencilla.
- **Soporte Multimedia Extensible**: Baileys soporta el envío de imágenes, audio, video, documentos, etc. Aunque nuestra API base solo implementa el envío de texto, puede extenderse fácilmente para incluir estas funcionalidades.

### 📡 API REST (Actual)

| Método | Ruta            | Descripción                          |
| ------ | --------------- | ------------------------------------ |
| `POST` | `/send-message` | Envía texto a un número o grupo.     |
| `GET`  | `/qr-code`      | QR en base64 para autenticar sesión. |
| `GET`  | `/session`      | Estado de la conexión.               |

(Podés extender `src/index.js` para soportar archivos, stickers, audio, etc.)

## ⚙️ Puesta en Marcha y Uso

A continuación se detallan dos métodos de despliegue: uno para correr la API en tu propia computadora con Windows y otro para desplegarla en la nube con Railway.

---

### Opción 1: Ejecución en tu Computadora (Windows)

Ideal para pruebas, desarrollo o si prefieres gestionar el servicio tú mismo.

#### **Requisitos**

- Tener **Docker Desktop** instalado y corriendo en Windows.

#### **Paso a Paso**

1.  **Obtener los Archivos del Proyecto**

    - Descarga este proyecto como un archivo ZIP desde GitHub.
    - Descomprímelo en una carpeta de fácil acceso, por ejemplo: `C:\whatsapp-api`.

2.  **Abrir Windows PowerShell**

    - Ve a la carpeta que creaste, haz `Shift + Clic Derecho` en un espacio en blanco y selecciona "Abrir ventana de PowerShell aquí".

3.  **Construir y Arrancar el Servicio**

    - En la ventana de PowerShell, escribe el siguiente comando y presiona `Enter`. La primera vez, este proceso descargará y configurará todo lo necesario, lo cual puede tardar varios minutos.
      ```powershell
      docker-compose up --build
      ```
    - Verás mucho texto aparecer en la pantalla. Esto es el log en tiempo real de la aplicación.

4.  **Vincular tu WhatsApp (Solo la primera vez)**

    - Espera a que en los logs aparezca el mensaje:
      `CÓDIGO QR RECIBIDO. Accede al endpoint /qr para escanear.`
    - Abre tu navegador de internet (Chrome, Firefox, etc.) y ve a esta dirección: **`http://localhost:3001/qr`**
    - En la página verás un código QR. Escanéalo con tu celular usando la app de WhatsApp (`Ajustes > Dispositivos Vinculados > Vincular un dispositivo`).
    - Una vez escaneado, vuelve a la ventana de PowerShell y espera el mensaje de confirmación: **`¡CONEXIÓN ABIERTA Y EXITOSA! EL BOT ESTÁ LISTO.`**

5.  **Dejar Corriendo en Segundo Plano**

    - Ahora que ya está funcionando, presiona `Ctrl+C` en PowerShell para detener los logs.
    - Para que la API se quede corriendo de forma permanente y se inicie con tu PC, ejecuta este último comando:
      ```powershell
      docker-compose up -d
      ```

---

### Opción 2: Despliegue en la Nube (Railway)

Ideal para un entorno de producción estable, accesible desde cualquier lugar y que no depende de tu computadora.

#### **Requisitos**

- Una cuenta de **GitHub**.
- Una cuenta en **Railway.app**.

#### **Paso a Paso**

1.  **Preparar el Repositorio**

    - Sube todos los archivos del proyecto (`app.js`, `package.json`, `package-lock.json`, `Dockerfile`, `docker-compose.yml`) a un nuevo repositorio en tu cuenta de GitHub.

2.  **Crear el Servicio en Railway**

    - Inicia sesión en Railway y crea un nuevo proyecto.
    - Elige "Deploy from GitHub repo" y selecciona el repositorio que acabas de crear.

3.  **Configurar las Variables y el Volumen**

    - Una vez creado el servicio en Railway, ve a la pestaña **"Variables"**.
    - Añade una nueva variable:
      - **Nombre:** `PERSISTENT_DATA_PATH`
      - **Valor:** `/persistent_data`
    - Ahora, ve a la pestaña **"Volumes"**.
    - Crea un nuevo volumen y **móntalo** (Mount) en la ruta: `/persistent_data`.

4.  **Autenticar la Sesión**

    - Railway se desplegará automáticamente con estos cambios. Revisa los logs de despliegue.
    - Para autenticar, abre tu navegador y ve a la URL pública que Railway le asignó a tu servicio (ej: `https://mi-bot.up.railway.app`), añadiendo `/qr` al final.
    - **Ejemplo:** `https://mi-bot-baileys-production.up.railway.app/qr`
    - Escanea el QR que aparece en la página con tu teléfono. La sesión se guardará en el volumen persistente y sobrevivirá a futuros despliegues.

---

### 📤 Integración con n8n

Para enviar un mensaje desde un workflow de n8n, usa el nodo **HTTP Request**:

- **URL**:
  - Si n8n y la API corren en Docker en la misma PC: `http://host.docker.internal:3001/send-message`
  - Si la API está en Railway: `https://<tu-app>.up.railway.app/send-message`
- **Method**: `POST`
- **Body Content Type**: `JSON`
- **Body**:
  ```json
  {
    "number": "5491122334455",
    "message": "Mensaje desde mi workflow de n8n!"
  }
  ```

**Ejemplo **`curl`**:**

```bash
curl -X POST http://localhost:3001/send-message \
  -H "Content-Type: application/json" \
  -d '{"number":"5491122334455","message":"Hola desde la API!"}'
```

---
