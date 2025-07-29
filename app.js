const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { webcrypto } = require('node:crypto');
global.crypto = webcrypto;

const app = express();
app.use(express.json());
const port = 3000;

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({
        logger: pino({ level: 'debug' }),
        auth: state,
        // AÑADE ESTA LÍNEA PARA SIMULAR UN NAVEGADOR VÁLIDO
        browser: ['Chrome', 'Desktop', '122.0.0'],
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('Escanea este QR con tu teléfono:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada debido a ', lastDisconnect.error, ', reconectando ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Conexión abierta!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Endpoint para enviar mensajes
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
        return res.status(400).json({ error: 'El número y el mensaje son requeridos.' });
    }

    try {
        const jid = `${number}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        res.status(200).json({ success: 'Mensaje enviado.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al enviar el mensaje.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
    connectToWhatsApp();
});