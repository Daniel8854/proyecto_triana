const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const iaService = require('../services/ia.service');
const pagosService = require('../services/pagos.service');
const database = require('../database');

class WhatsAppService {
    constructor() {
        this.clients = [];
        this.numbers = ['+1234567890', '+0987654321', '+1122334455']; // Tus 3 números
    }

    async initialize() {
        for (let i = 0; i < this.numbers.length; i++) {
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: `whatsapp-${i+1}`
                })
            });

            client.on('qr', (qr) => {
                console.log(`WhatsApp ${i+1} - Escanea este QR:`);
                qrcode.generate(qr, {small: true});
            });

            client.on('ready', () => {
                console.log(`✅ WhatsApp ${i+1} conectado!`);
            });

            client.on('message', async (message) => {
                await this.handleMessage(message, client);
            });

            await client.initialize();
            this.clients.push(client);
        }
    }

    async handleMessage(message, client) {
        const from = message.from;
        const body = message.body;
        
        // Si es imagen (comprobante de pago)
        if (message.hasMedia && message.type === 'image') {
            const media = await message.downloadMedia();
            await pagosService.procesarComprobante(media, from, client);
        } 
        // Si es texto
        else if (body) {
            const respuesta = await iaService.procesarMensaje(body, from);
            if (respuesta) {
                await client.sendMessage(from, respuesta);
            }
        }
    }

    async enviarMensaje(numero, mensaje) {
        // Distribuir entre los 3 números
        const client = this.clients[Math.floor(Math.random() * this.clients.length)];
        await client.sendMessage(`${numero}@c.us`, mensaje);
    }
}

module.exports = new WhatsAppService();