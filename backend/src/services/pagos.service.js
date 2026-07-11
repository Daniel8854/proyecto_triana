const database = require('../database');
const ocrService = require('./ocr.service');
const iaService = require('./ia.service');

class PagosService {
    async procesarComprobante(media, numeroCliente, chatId, client) {
        try {
            // 1. Extraer texto de la imagen
            const texto = await ocrService.leerImagen(media.data);

            // 2. Extraer datos del comprobante
            const datosPago = await this.extraerDatosPago(texto);

            // 3. Buscar cliente
            const cliente = await database.getClienteByTelefono(numeroCliente);

            if (!cliente) {
                await client.sendMessage(chatId,
                    "❌ No te encuentro en el sistema. ¿Podrías darme tu nombre completo?");
                return;
            }

            // 4. Validar monto con cuota pendiente
            const cuotaPendiente = await database.getProximaCuota(cliente.id);

            if (!cuotaPendiente) {
                await client.sendMessage(chatId,
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

                const totalCuotas = cuotaPendiente.total_cuotas;
                const cuotaPagada = cuotaPendiente.numero;

                let mensajeConfirmacion =
                    `✅ ¡Pago confirmado! R$${datosPago.monto}\n` +
                    `📊 Cuota ${cuotaPagada}/${totalCuotas} pagada\n\n`;

                if (cuotaPagada >= totalCuotas) {
                    mensajeConfirmacion += `🎉 ¡Completaste todas tus cuotas! Gracias por tu confianza, ${cliente.nombre} 🙌`;
                } else {
                    mensajeConfirmacion += `🎯 Siguiente cuota: ${cuotaPagada + 1}/${totalCuotas}\n\n¡Gracias por tu pago, ${cliente.nombre}! 🙌`;
                }

                await client.sendMessage(chatId, mensajeConfirmacion);

                // Actualizar estado del cliente
                await this.verificarAtrasos(cliente.id);
            } else {
                await client.sendMessage(chatId,
                    `⚠️ El monto detectado es R$${datosPago.monto}\n` +
                    `Tu cuota es de R$${cuotaPendiente.valor}\n\n` +
                    `¿Podrías confirmar el monto exacto que pagaste?`);
            }

        } catch (error) {
            console.error('Error procesando pago:', error);
            await client.sendMessage(chatId,
                "🤔 No pude leer bien tu comprobante.\n" +
                "¿Podrías escribir el valor que pagaste y tu nombre?");
        }
    }
    
    async extraerDatosPago(texto) {
        try {
            const datos = await iaService.extraerDatosComprobante(texto);
            if (datos && typeof datos.monto === 'number') {
                return { monto: datos.monto, nombre_detectado: datos.nombre || null, texto_original: texto };
            }
        } catch (error) {
            console.error('IA no pudo leer el comprobante, uso regex de respaldo:', error.message);
        }

        // Respaldo: extraer monto con regex si la IA falla o no encontró nada
        const montoRegex = /R?\$?\s*(\d+(?:[.,]\d{2})?)/i;
        const match = texto.match(montoRegex);
        const monto = match ? parseFloat(match[1].replace(',', '.')) : 0;

        return { monto, nombre_detectado: null, texto_original: texto };
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