const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const iaService = require('../services/ia.service');
const pagosService = require('../services/pagos.service');
const { normalizarTelefono } = require('../utils/telefono');

class WhatsAppService {
    constructor() {
        this.clients = [];
        // Cada sesión se identifica escaneando un QR distinto con el WhatsApp que quieras usar.
        // No hace falta saber los números de antemano.
        this.sesiones = Number(process.env.WHATSAPP_SESSIONS) || 1;
    }

    async initialize() {
        for (let i = 0; i < this.sesiones; i++) {
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: `whatsapp-${i + 1}`
                })
            });

            client.on('qr', async (qr) => {
                console.log(`Sesión ${i + 1} - Escanea este QR:`);
                qrcodeTerminal.generate(qr, { small: true });

                const qrPath = path.join(__dirname, `../../qr-sesion-${i + 1}.png`);
                await qrcode.toFile(qrPath, qr, { width: 400 });
                console.log(`(También guardado como imagen en ${qrPath})`);
            });

            client.on('ready', () => {
                console.log(`✅ Sesión ${i + 1} conectada! Número vinculado: ${client.info?.wid?._serialized}`);
            });

            client.on('message', async (message) => {
                await this.handleMessage(message, client);
            });

            client.on('change_state', (state) => {
                console.log(`🔄 Sesión ${i + 1} - cambio de estado: ${state}`);
            });

            client.on('disconnected', (reason) => {
                console.log(`⚠️ Sesión ${i + 1} desconectada: ${reason}`);
            });

            await client.initialize();
            this.clients.push(client);
        }
    }

    // WhatsApp a veces identifica a contactos que no están en la agenda con un "lid"
    // (ej. 91543352377377@lid) en vez del número real (5511999999999@c.us), como
    // medida de privacidad. Acá intentamos resolver el número real detrás del lid.
    async resolverNumero(message) {
        if (message.from.endsWith('@c.us')) return message.from;

        if (message.from.endsWith('@lid')) {
            try {
                const contact = await message.getContact();
                if (contact?.id?._serialized?.endsWith('@c.us')) {
                    return contact.id._serialized;
                }
                if (contact?.number) {
                    return `${contact.number}@c.us`;
                }
            } catch (error) {
                console.error(`No se pudo resolver el contacto detrás de ${message.from}:`, error.message);
            }
        }

        return null;
    }

    async handleMessage(message, client) {
        // Ignora grupos, canales y estados: solo atendemos chats 1 a 1
        if (message.from.endsWith('@g.us') || message.from === 'status@broadcast') return;

        const numero = await this.resolverNumero(message);
        if (!numero) {
            console.log(`⚠️ No se pudo identificar el número real detrás de ${message.from} (probablemente no está en la agenda). Se ignora el mensaje.`);
            return;
        }

        const chatId = message.from;
        const body = message.body;
        console.log(`📩 Mensaje de ${numero}: ${message.hasMedia ? `[media:${message.type}]` : body}`);

        try {
            if (message.hasMedia && message.type === 'image') {
                const media = await message.downloadMedia();
                await pagosService.procesarComprobante(media, numero, chatId, client);
            } else if (body) {
                const respuesta = await iaService.procesarMensaje(body, numero);
                if (respuesta) {
                    console.log(`📤 Respuesta a ${numero}: ${respuesta}`);
                    await client.sendMessage(chatId, respuesta);
                }
            }
        } catch (error) {
            console.error(`❌ Error procesando mensaje de ${numero}:`, error);
        }
    }

    async enviarMensaje(numero, mensaje) {
        const client = this.clients[Math.floor(Math.random() * this.clients.length)];
        const numeroNormalizado = normalizarTelefono(numero);
        await client.sendMessage(`${numeroNormalizado}@c.us`, mensaje);
    }
}

module.exports = new WhatsAppService();
