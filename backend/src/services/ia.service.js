const { OpenAI } = require('openai');
const database = require('../database');

class IAService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async procesarMensaje(mensaje, numeroCliente) {
        // Buscar cliente por número
        const cliente = await database.getClienteByTelefono(numeroCliente);
        
        if (!cliente) {
            return "Hola! Soy Triana 🤖\nPara identificar tu cuenta, ¿podrías darme tu nombre o número de pedido?";
        }

        // Detectar intención del mensaje
        const intencion = await this.detectarIntencion(mensaje);
        
        switch(intencion) {
            case 'consultar_deuda':
                return await this.consultarDeuda(cliente);
            case 'reportar_pago':
                return "Por favor, envía la foto del comprobante de pago 📸";
            case 'duda':
                return await this.responderDuda(mensaje, cliente);
            default:
                return "¿En qué puedo ayudarte?\n\n💬 Opciones:\n• Consultar mi deuda\n• Enviar comprobante de pago\n• Hablar con un asesor";
        }
    }

    async detectarIntencion(mensaje) {
        const prompt = `
        Analiza este mensaje de WhatsApp y clasificalo en una de estas categorías:
        - consultar_deuda: preguntas sobre cuánto debe, cuotas pendientes
        - reportar_pago: dice que pagó, envió comprobante
        - duda: preguntas sobre productos, fechas, etc.
        
        Mensaje: "${mensaje}"
        
        Responde solo con la categoría.
        `;
        
        const response = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0
        });
        
        return response.choices[0].message.content.trim();
    }

    async consultarDeuda(cliente) {
        const cuotas = await database.getCuotasPendientes(cliente.id);
        
        if (cuotas.length === 0) {
            return `✅ ${cliente.nombre}, estás al día con tus pagos. ¡Gracias! 🎉`;
        }
        
        const proxima = cuotas[0];
        const atraso = this.calcularAtraso(proxima.fecha_vencimiento);
        
        let mensaje = `📋 ${cliente.nombre}, tu situación actual:\n\n`;
        mensaje += `💰 Próxima cuota: R$${proxima.valor}\n`;
        mensaje += `📅 Vence: ${proxima.fecha_vencimiento}\n`;
        
        if (atraso > 0) {
            mensaje += `⚠️ Atraso: ${atraso} días\n`;
        }
        
        mensaje += `\nEnvía el comprobante de pago por aquí 📸`;
        
        return mensaje;
    }

    calcularAtraso(fechaVencimiento) {
        const hoy = new Date();
        const vencimiento = new Date(fechaVencimiento);
        const diff = hoy - vencimiento;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    async responderDuda(mensaje, cliente) {
        const response = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Eres Triana, asistente de ventas de muebles. Responde de forma amable y profesional." },
                { role: "user", content: mensaje }
            ]
        });
        
        return response.choices[0].message.content;
    }

    async generarInformeDiario(resumen) {
        const response = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "Genera un resumen diario de pagos para WhatsApp, formato amigable con emojis." },
                { role: "user", content: `Genera informe con: ${JSON.stringify(resumen)}` }
            ]
        });
        
        return response.choices[0].message.content;
    }
}

module.exports = new IAService();