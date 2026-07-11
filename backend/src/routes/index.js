const express = require('express');
const router = express.Router();
const database = require('../database');
const pagosService = require('../services/pagos.service');

// API para registrar nueva venta
router.post('/ventas', async (req, res) => {
    const { cliente, producto, cuotas, valorCuota } = req.body;

    try {
        const clienteCreado = await database.crearVenta({
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            producto,
            cuotas,
            valorCuota
        });

        res.json({ success: true, message: 'Venta registrada', clienteId: clienteCreado.id });
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