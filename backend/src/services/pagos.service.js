const database = require('../database');
const ocrService = require('./ocr.service');

class PagosService {
    async procesarComprobante(media, numeroCliente, client) {
        try {
            // 1. Extraer texto de la imagen
            const texto = await ocrService.leerImagen(media.data);
            
            // 2. Extraer datos del comprobante
            const datosPago = await this.extraerDatosPago(texto);
            
            // 3. Buscar cliente
            const cliente = await database.getClienteByTelefono(numeroCliente);
            
            if (!cliente) {
                await client.sendMessage(numeroCliente, 
                    "❌ No te encuentro en el sistema. ¿Podrías darme tu nombre completo?");
                return;
            }
            
            // 4. Validar monto con cuota pendiente
            const cuotaPendiente = await database.getProximaCuota(cliente.id);
            
            if (!cuotaPendiente) {
                await client.sendMessage(numeroCliente,
                    "✅ ¡Estás al día! No tienes cuotas pendientes.");
                return;
            }
            
            // 5. Verificar si el monto coincide
            if (Math.abs(datosPago.monto - cuotaPendiente.valor) < 1) {
                // Registrar pago
                await database.registrarPago({
                    cliente_id: cliente.id,
                    cuota_id: cuotaPendiente.id,
                    monto: datosPago.monto,
                    fecha: new Date(),
                    comprobante: media.data
                });
                
                const siguienteCuota = cuotaPendiente.numero + 1;
                const totalCuotas = cuotaPendiente.total;
                
                await client.sendMessage(numeroCliente,
                    `✅ ¡Pago confirmado! R$${datosPago.monto}\n` +
                    `📊 Cuota ${siguienteCuota-1}/${totalCuotas} pagada\n` +
                    `🎯 Siguiente cuota: ${siguienteCuota}/${totalCuotas}\n\n` +
                    `¡Gracias por tu pago, ${cliente.nombre}! 🙌`);
                    
                // Actualizar estado del cliente
                await this.verificarAtrasos(cliente.id);
            } else {
                await client.sendMessage(numeroCliente,
                    `⚠️ El monto detectado es R$${datosPago.monto}\n` +
                    `Tu cuota es de R$${cuotaPendiente.valor}\n\n` +
                    `¿Podrías confirmar el monto exacto que pagaste?`);
            }
            
        } catch (error) {
            console.error('Error procesando pago:', error);
            await client.sendMessage(numeroCliente,
                "🤔 No pude leer bien tu comprobante.\n" +
                "¿Podrías escribir el valor que pagaste y tu nombre?");
        }
    }
    
    async extraerDatosPago(texto) {
        // Extraer monto usando regex
        const montoRegex = /R?\$?\s*(\d+(?:[.,]\d{2})?)/i;
        const match = texto.match(montoRegex);
        
        let monto = match ? parseFloat(match[1].replace(',', '.')) : 0;
        
        return {
            monto: monto,
            texto_original: texto
        };
    }
    
    async verificarAtrasos(clienteId) {
        const cuotasAtrasadas = await database.getCuotasAtrasadas(clienteId);
        
        if (cuotasAtrasadas.length > 0) {
            // Marcar cliente como moroso
            await database.actualizarEstadoCliente(clienteId, 'moroso');
        } else {
            await database.actualizarEstadoCliente(clienteId, 'aldia');
        }
    }
    
    async generarInformeDiario() {
        const hoy = new Date();
        const pagosHoy = await database.getPagosDelDia(hoy);
        const atrasados = await database.getClientesAtrasados();
        
        let informe = `📊 *Resumen del día (${hoy.toLocaleDateString()})*\n\n`;
        informe += `✅ *Pagos recibidos:*\n`;
        
        for (const pago of pagosHoy) {
            informe += `${pago.cliente_nombre} → R$${pago.monto} (cuota ${pago.cuota_numero})\n`;
        }
        
        informe += `\n⚠️ *Pendientes:*\n`;
        
        for (const atrasado of atrasados) {
            const diasAtraso = Math.floor((hoy - new Date(atrasado.fecha_vencimiento)) / (1000 * 60 * 60 * 24));
            if (diasAtraso === 0) {
                informe += `${atrasado.nombre} → vence hoy\n`;
            } else {
                informe += `${atrasado.nombre} → ${diasAtraso} días de atraso\n`;
            }
        }
        
        const total = pagosHoy.reduce((sum, pago) => sum + pago.monto, 0);
        informe += `\n💰 *Total recibido:* R$${total}`;
        
        return informe;
    }
}

module.exports = new PagosService();