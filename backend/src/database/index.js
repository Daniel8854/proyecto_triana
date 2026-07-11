const { createClient } = require('@supabase/supabase-js');
const { normalizarTelefono } = require('../utils/telefono');
require('dotenv').config();

class Database {
    constructor() {
        this.client = null;
    }

    async connect() {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env');
        }

        this.client = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Verifica que la conexión y las tablas existan (deben crearse antes con supabase/schema.sql)
        const { error } = await this.client.from('clientes').select('id').limit(1);
        if (error) {
            throw new Error(`No se pudo conectar a Supabase o falta correr supabase/schema.sql: ${error.message}`);
        }
    }

    async crearVenta({ nombre, telefono, producto, cuotas, valorCuota }) {
        const { data: cliente, error: errorCliente } = await this.client
            .from('clientes')
            .insert({ nombre, telefono: normalizarTelefono(telefono), producto })
            .select()
            .single();

        if (errorCliente) throw errorCliente;

        const filasCuotas = [];
        for (let i = 1; i <= cuotas; i++) {
            const fechaVencimiento = new Date();
            fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i);

            filasCuotas.push({
                cliente_id: cliente.id,
                numero: i,
                total_cuotas: cuotas,
                valor: valorCuota,
                fecha_vencimiento: fechaVencimiento.toISOString().slice(0, 10)
            });
        }

        const { error: errorCuotas } = await this.client.from('cuotas').insert(filasCuotas);
        if (errorCuotas) throw errorCuotas;

        return cliente;
    }

    async getClienteByTelefono(telefono) {
        const { data, error } = await this.client
            .from('clientes')
            .select('*')
            .eq('telefono', normalizarTelefono(telefono))
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async getProximaCuota(clienteId) {
        const { data, error } = await this.client
            .from('cuotas')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('estado', 'pendiente')
            .order('numero', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async getCuotasPendientes(clienteId) {
        const { data, error } = await this.client
            .from('cuotas')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('estado', 'pendiente')
            .order('numero', { ascending: true });

        if (error) throw error;
        return data;
    }

    async subirComprobante(clienteId, base64Image) {
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const path = `${clienteId}/${Date.now()}.jpg`;

        const { error } = await this.client.storage
            .from('comprobantes')
            .upload(path, buffer, { contentType: 'image/jpeg' });

        if (error) throw error;
        return path;
    }

    async registrarPago(pago) {
        let comprobanteUrl = null;
        if (pago.comprobante) {
            comprobanteUrl = await this.subirComprobante(pago.cliente_id, pago.comprobante);
        }

        const { error: errorPago } = await this.client.from('pagos').insert({
            cliente_id: pago.cliente_id,
            cuota_id: pago.cuota_id,
            monto: pago.monto,
            fecha: pago.fecha,
            comprobante_url: comprobanteUrl
        });
        if (errorPago) throw errorPago;

        const { error: errorCuota } = await this.client
            .from('cuotas')
            .update({ estado: 'pagado' })
            .eq('id', pago.cuota_id);
        if (errorCuota) throw errorCuota;
    }

    async getPagosDelDia(fecha) {
        const inicio = new Date(fecha);
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(fecha);
        fin.setHours(23, 59, 59, 999);

        const { data, error } = await this.client
            .from('pagos')
            .select('*, clientes(nombre), cuotas(numero)')
            .gte('fecha', inicio.toISOString())
            .lte('fecha', fin.toISOString());

        if (error) throw error;

        return data.map(p => ({
            ...p,
            cliente_nombre: p.clientes?.nombre,
            cuota_numero: p.cuotas?.numero
        }));
    }

    async getClientesAtrasados() {
        const hoy = new Date().toISOString().slice(0, 10);

        const { data, error } = await this.client
            .from('cuotas')
            .select('fecha_vencimiento, clientes(*)')
            .eq('estado', 'pendiente')
            .lt('fecha_vencimiento', hoy);

        if (error) throw error;

        const vistos = new Map();
        for (const fila of data) {
            if (fila.clientes && !vistos.has(fila.clientes.id)) {
                vistos.set(fila.clientes.id, { ...fila.clientes, fecha_vencimiento: fila.fecha_vencimiento });
            }
        }
        return Array.from(vistos.values());
    }

    async getCuotasAtrasadas(clienteId) {
        const hoy = new Date().toISOString().slice(0, 10);

        const { data, error } = await this.client
            .from('cuotas')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('estado', 'pendiente')
            .lt('fecha_vencimiento', hoy);

        if (error) throw error;
        return data;
    }

    async actualizarEstadoCliente(clienteId, estado) {
        const { error } = await this.client
            .from('clientes')
            .update({ estado })
            .eq('id', clienteId);

        if (error) throw error;
    }
}

module.exports = new Database();
