const cron = require('node-cron');
const database = require('../database');
const pagosService = require('../services/pagos.service');
const whatsappService = require('../whatsapp');
const iaService = require('../services/ia.service');

class CronJobs {
    init() {
        // Enviar recordatorios todos los días a las 9 AM
        cron.schedule('0 9 * * *', async () => {
            console.log('📢 Enviando recordatorios de pago...');
            await this.enviarRecordatorios();
        });
        
        // Generar informe diario a las 9 PM
        cron.schedule('0 21 * * *', async () => {
            console.log('📊 Generando informe diario...');
            await this.generarInformeDiario();
        });
        
        // Verificar pagos no confirmados cada hora
        cron.schedule('0 * * * *', async () => {
            console.log('🔄 Verificando pagos pendientes...');
            await this.verificarPagosPendientes();
        });
    }
    
    async enviarRecordatorios() {
        const clientesConDeuda = await database.getClientesAtrasados();
        
        for (const cliente of clientesConDeuda) {
            const cuota = await database.getProximaCuota(cliente.id);
            
            const mensaje = `💬 Hola ${cliente.nombre}, hoy vence tu cuota #${cuota.numero} de R$${cuota.valor} 😊\n\nPuedes pagar por Pix y enviar el comprobante aquí mismo.`;
            
            await whatsappService.enviarMensaje(cliente.telefono, mensaje);
            
            // Esperar 1 segundo entre mensajes para evitar bloqueos
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    async generarInformeDiario() {
        const informe = await pagosService.generarInformeDiario();
        
        // Enviar a tu número personal (el administrador)
        const adminNumber = process.env.ADMIN_WHATSAPP;
        
        await whatsappService.enviarMensaje(adminNumber, informe);
        
        console.log('✅ Informe diario enviado');
    }
    
    async verificarPagosPendientes() {
        // Lógica para verificar pagos que no fueron confirmados
        // y hacer seguimiento
        console.log('Verificación completada');
    }
}

module.exports = new CronJobs();