// =================================================================
//                      IMPORTS Y CONFIGURACIÓN INICIAL
// =================================================================
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
    DisconnectReason,
    useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const qrcode = require("qrcode");
const { webcrypto } = require("node:crypto");
global.crypto = webcrypto;

const app = express();
app.use(express.json());

// El puerto se obtiene de las variables de entorno, ideal para Railway, con un fallback a 3000 para local.
const port = process.env.PORT || 3000;

// --- LÓGICA DE RUTAS PERSISTENTES ---
// Determina dónde se guardarán los datos de la sesión.
// Si la variable de entorno PERSISTENT_DATA_PATH existe (en Railway), úsala.
// Si no, usa '.' (la carpeta actual), ideal para el desarrollo local.
const persistentDataPath = process.env.PERSISTENT_DATA_PATH || '.';
const authStatePath = `${persistentDataPath}/auth_info_baileys`;
console.log(`Guardando datos de sesión en: ${authStatePath}`);
// --- FIN DE LÓGICA DE RUTAS ---

let sock;
let qrCodeString = null;

// =================================================================
//                      ENDPOINT PARA MOSTRAR EL QR
// =================================================================
app.get('/qr', async (req, res) => {
    if (qrCodeString) {
        try {
            // Genera el QR como una imagen en formato DataURL
            const qrDataURL = await qrcode.toDataURL(qrCodeString);
            // Envía una página HTML simple con la imagen del QR
            res.send(`
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; font-family: sans-serif;">
                    <div style="text-align: center; padding: 20px; background-color: white; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        <h1>Escanea para conectar tu WhatsApp</h1>
                        <p>Abre WhatsApp en tu teléfono, ve a Dispositivos Vinculados y escanea el código.</p>
                        <img src="${qrDataURL}" alt="Código QR de WhatsApp" style="width: 400px; height: 400px; margin-top: 20px;">
                    </div>
                </body>
            `);
        } catch (err) {
            console.error('Error al generar QR para la web', err);
            res.status(500).send('Error al generar el código QR');
        }
    } else {
        res.status(404).send('No hay un código QR disponible. Reinicia el proceso de autenticación.');
    }
});

// =================================================================
//                      FUNCIÓN PRINCIPAL DE CONEXIÓN
// =================================================================
async function connectToWhatsApp() {
    // Usa la ruta de autenticación dinámica
    const { state, saveCreds } = await useMultiFileAuthState(authStatePath);

    sock = makeWASocket({
        logger: pino({ level: "info" }), // Nivel de log 'info' para producción
        auth: state,
        browser: ["Chrome", "Desktop", "122.0.0"],
        // Requerido para evitar problemas con ciertas JIDs en producción
        shouldIgnoreJid: jid => jid.includes('@broadcast'), 
    });

    // Listener para los eventos de conexión
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeString = qr;
            console.log('CÓDIGO QR RECIBIDO. Accede al endpoint /qr para escanear.');
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(
                "Conexión cerrada debido a ",
                lastDisconnect.error,
                ", reconectando: ",
                shouldReconnect
            );
            // Lógica de reconexión robusta para producción
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === "open") {
            qrCodeString = null; // Limpiamos el QR una vez que la conexión es exitosa
            console.log("¡CONEXIÓN ABIERTA Y EXITOSA! EL BOT ESTÁ LISTO.");
        }
    });

    // Listener para guardar las credenciales actualizadas
    sock.ev.on("creds.update", saveCreds);
}

// =================================================================
//                      ENDPOINT PARA ENVIAR MENSAJES
// =================================================================
app.post("/send-message", async (req, res) => {
    const { number, message } = req.body;

    // Validación de la conexión del socket
    if (!sock || !sock.user) {
        return res
            .status(500)
            .json({ status: "error", message: "El cliente de WhatsApp no está conectado o listo." });
    }

    // Validación de los parámetros de entrada
    if (!number || !message) {
        return res
            .status(400)
            .json({ status: "error", message: "El número y el mensaje son requeridos." });
    }

    try {
        // Formatea el JID (identificador de WhatsApp) correctamente
        const jid = number.includes("@s.whatsapp.net")
            ? number
            : `${number}@s.whatsapp.net`;
        
        // Envía el mensaje
        await sock.sendMessage(jid, { text: message });
        
        res.status(200).json({ status: "success", message: "Mensaje enviado." });
    } catch (error) {
        console.error("Error en /send-message:", error);
        res.status(500).json({ status: "error", message: "Error al enviar el mensaje." });
    }
});

// =================================================================
//                      INICIO DEL SERVIDOR
// =================================================================
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
    console.log('Cuando necesites autenticar, el QR estará disponible en el endpoint /qr');
    connectToWhatsApp();
});