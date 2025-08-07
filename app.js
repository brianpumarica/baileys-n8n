// =================================================================
//                              IMPORTS
// =================================================================
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
    DisconnectReason,
    useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const qrcode = require("qrcode");

// Polyfill para la API de Crypto, requerida por Baileys
const { webcrypto } = require("node:crypto");
global.crypto = webcrypto;


// =================================================================
//                      CONFIGURACIÓN INICIAL
// =================================================================
const app = express();
app.use(express.json());

// El puerto se obtiene de las variables de entorno, con un fallback a 3000 para local.
const port = process.env.PORT || 3000;

// Ruta persistente para guardar la sesión de autenticación.
const authStatePath = process.env.PERSISTENT_DATA_PATH ? `${process.env.PERSISTENT_DATA_PATH}/auth_info_baileys` : 'auth_info_baileys';

let sock;
let qrCodeString = null;


// =================================================================
//                  LÓGICA PRINCIPAL DEL BOT DE WHATSAPP
// =================================================================

/**
 * Inicia la conexión con WhatsApp, configura los listeners de eventos y maneja la reconexión.
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(authStatePath);

    sock = makeWASocket({
        logger: pino({ level: "silent" }), // 'info' para ver más detalles, 'silent' para producción
        auth: state,
        browser: ["N8N-Baileys", "Chrome", "1.0.0"], // Browser personalizado
        shouldIgnoreJid: jid => typeof jid === 'string' && jid.includes('@broadcast'),// Ignorar listas de difusión
    });

    // Pasamos saveCreds a la función que configura los listeners
    setupEventListeners(saveCreds);
}

/**
 * Configura todos los listeners de eventos para el socket de Baileys.
 * @param {Function} saveCreds - La función para guardar las credenciales de autenticación.
 */
function setupEventListeners(saveCreds) {
    // Evento de actualización de la conexión
    sock.ev.on("connection.update", handleConnectionUpdate);

    // Evento de actualización de credenciales
    sock.ev.on("creds.update", saveCreds);

    // Evento de recepción de mensajes
    sock.ev.on("messages.upsert", handleMessagesUpsert);
}

/**
 * Maneja las actualizaciones del estado de la conexión (conectado, desconectado, QR).
 * @param {object} update - El objeto de actualización de la conexión.
 */
async function handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        qrCodeString = qr;
        console.log('CÓDIGO QR RECIBIDO. Accede al endpoint /qr para escanear.');
    }

    if (connection === "close") {
        const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`Conexión cerrada. Razón: ${lastDisconnect.error?.message}. Reconectando: ${shouldReconnect}`);
        if (shouldReconnect) {
            connectToWhatsApp();
        }
    } else if (connection === "open") {
        qrCodeString = null;
        console.log("¡CONEXIÓN ABIERTA Y EXITOSA! El bot está listo.");
    }
}

/**
 * Procesa los mensajes entrantes para registrar información útil.
 * @param {object} m - El objeto que contiene los mensajes.
 */
async function handleMessagesUpsert(m) {
    m.messages.forEach(msg => {        
        if (!msg.message || msg.key.fromMe) {
            return;
        }

        const from = msg.key.remoteJid;
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const type = from.endsWith('@g.us') ? 'GRUPO' : 'USUARIO';

        console.log(`Nuevo mensaje del ${type} (${from}): "${messageContent}"`);
    });
}


// =================================================================
//                         ENDPOINTS DE LA API
// =================================================================

/**
 * Endpoint para mostrar el código QR de autenticación.
 */
app.get('/qr', async (req, res) => {
    if (qrCodeString) {
        try {
            const qrDataURL = await qrcode.toDataURL(qrCodeString);
            res.send(`
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; font-family: sans-serif;">
                    <div style="text-align: center; padding: 40px; background-color: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <h1>Escanea para conectar tu WhatsApp</h1>
                        <p>Abre WhatsApp, ve a Dispositivos Vinculados y escanea el código.</p>
                        <img src="${qrDataURL}" alt="Código QR de WhatsApp" style="width: 350px; height: 350px; margin-top: 25px;">
                    </div>
                </body>
            `);
        } catch (err) {
            console.error('Error al generar QR para la web', err);
            res.status(500).send('Error al generar el código QR');
        }
    } else {
        res.status(404).send('El código QR no está disponible. Es posible que ya estés conectado.');
    }
});

/**
 * Endpoint para enviar un mensaje a un usuario o grupo.
 */
app.post("/send-message", async (req, res) => {
    const { recipient, message } = req.body;

    if (!sock || !sock.user) {
        return res.status(500).json({ status: "error", message: "El cliente de WhatsApp no está conectado." });
    }
    if (!recipient || !message) {
        return res.status(400).json({ status: "error", message: "Los campos 'recipient' y 'message' son requeridos." });
    }

    try {
        const jid = recipient.endsWith('@g.us')
            ? recipient
            : `${recipient.replace(/\D/g, '')}@s.whatsapp.net`;

        console.log(`Intentando enviar mensaje a JID: ${jid}`);
        await sock.sendMessage(jid, { text: message });
        
        res.status(200).json({ status: "success", message: `Mensaje enviado a ${jid}` });
    } catch (error) {
        console.error("Error detallado en /send-message:", error);
        res.status(500).json({ status: "error", message: "Error interno al enviar el mensaje.", details: error.message });
    }
});


// =================================================================
//                       INICIO DEL SERVIDOR
// =================================================================
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
    console.log(`Ruta de sesión: ${authStatePath}`);
    console.log('Iniciando conexión con WhatsApp...');
    connectToWhatsApp();
});
