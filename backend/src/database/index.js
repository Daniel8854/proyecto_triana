const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        this.pool = null;
    }
    
    async connect() {
        this.pool = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'triana_db',
            waitForConnections: true,
            connectionLimit: 10
        });
        
        await this.initTables();
    }
    
    async initTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS clientes (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nombre VARCHAR(100),
                telefono VARCHAR(20),
                producto VARCHAR(100),
                estado VARCHAR(20) DEFAULT 'aldia',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS cuotas (
                id INT PRIMARY KEY AUTO_INCREMENT,
                cliente_id INT,
                numero INT,
                total_cuotas INT,
                valor DECIMAL(10,2),
                fecha_vencimiento DATE,
                estado VARCHAR(20) DEFAULT 'pendiente',
                FOREIGN KEY (cliente_id) REFERENCES clientes(id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS pagos (
                id INT PRIMARY KEY AUTO_INCREMENT,
                cliente_id INT,
                cuota_id INT,
                monto DECIMAL(10,2),
                fecha DATETIME,
                comprobante TEXT,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id)
            )`
        ];
        
        for (const query of queries) {
            await this.pool.execute(query);
        }
    }
    
    async getClienteByTelefono(telefono) {
        const [rows] = await this.pool.execute(
            'SELECT * FROM clientes WHERE telefono = ?',
            [telefono]
        );
        return rows[0];
    }
    
    async getProximaCuota(clienteId) {
        const [rows] = await this.pool.execute(
            `SELECT c.*, cl.nombre, cl.telefono 
             FROM cuotas c 
             JOIN clientes cl ON c.cliente_id = cl.id 
             WHERE c.cliente_id = ? AND c.estado = 'pendiente'
             ORDER BY c.numero ASC LIMIT 1`,
            [clienteId]
        );
        return rows[0];
    }
    
    async getCuotasPendientes(clienteId) {
        const [rows] = await this.pool.execute(
            `SELECT * FROM cuotas 
             WHERE cliente_id = ? AND estado = 'pendiente'
             ORDER BY numero ASC`,
            [clienteId]
        );
        return rows;
    }
    
    async registrarPago(pago) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            
            // Registrar pago
            await connection.execute(
                `INSERT INTO pagos (cliente_id, cuota_id, monto, fecha, comprobante)
                 VALUES (?, ?, ?, ?, ?)`,
                [pago.cliente_id, pago.cuota_id, pago.monto, pago.fecha, pago.comprobante]
            );
            
            // Actualizar cuota
            await connection.execute(
                `UPDATE cuotas SET estado = 'pagado' WHERE id = ?`,
                [pago.cuota_id]
            );
            
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    
    async getPagosDelDia(fecha) {
        const [rows] = await this.pool.execute(
            `SELECT p.*, c.nombre as cliente_nombre, cu.numero as cuota_numero
             FROM pagos p
             JOIN clientes c ON p.cliente_id = c.id
             JOIN cuotas cu ON p.cuota_id = cu.id
             WHERE DATE(p.fecha) = DATE(?)`,
            [fecha]
        );
        return rows;
    }
    
    async getClientesAtrasados() {
        const [rows] = await this.pool.execute(
            `SELECT DISTINCT c.*, cu.fecha_vencimiento
             FROM clientes c
             JOIN cuotas cu ON c.id = cu.cliente_id
             WHERE cu.estado = 'pendiente' 
             AND cu.fecha_vencimiento < CURDATE()`
        );
        return rows;
    }
    
    async getCuotasAtrasadas(clienteId) {
        const [rows] = await this.pool.execute(
            `SELECT * FROM cuotas 
             WHERE cliente_id = ? 
             AND estado = 'pendiente'
             AND fecha_vencimiento < CURDATE()`,
            [clienteId]
        );
        return rows;
    }
    
    async actualizarEstadoCliente(clienteId, estado) {
        await this.pool.execute(
            'UPDATE clientes SET estado = ? WHERE id = ?',
            [estado, clienteId]
        );
    }
}

module.exports = new Database();