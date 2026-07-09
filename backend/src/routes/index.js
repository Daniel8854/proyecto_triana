const express = require('express');
const router = express.Router();
const database = require('../database');
const pagosService = require('../services/pagos.service');

// API para registrar nueva venta
router.post('/ventas', async (req, res) => {
    const { cliente, producto, total, cuotas, valorCuota } = req.body;
    
    try {
        // Registrar cliente
        const [result] = await database.pool.execute(
            'INSERT INTO clientes (nombre, telefono, producto) VALUES (?, ?, ?)',
            [cliente.nombre, cliente.telefono, producto]
        );
        
        const clienteId = result.insertId;
        
        // Registrar cuotas
        for (let i = 1; i <= cuotas; i++) {
            const fechaVencimiento = new Date();
            fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i);
            
            await database.pool.execute(
                `INSERT INTO cuotas (cliente_id, numero, total_cuotas, valor, fecha_vencimiento)
                 VALUES (?, ?, ?, ?, ?)`,
                [clienteId, i, cuotas, valorCuota, fechaVencimiento]
            );
        }
        
        res.json({ success: true, message: 'Venta registrada', clienteId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API para obtener dashboard
router.get('/dashboard', async (req, res) => {
    const pagosHoy = await database.getPagosDelDia(new Date());
    const atrasados = await database.getClientesAtrasados();
    const totalRecibido = pagosHoy.reduce((sum, p) => sum + p.monto, 0);
    
    res.json({
        pagosHoy,
        atrasados,
        totalRecibido
    });
});

module.exports = router;