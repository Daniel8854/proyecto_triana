function normalizarTelefono(numero) {
    return String(numero).replace(/\D/g, '');
}

module.exports = { normalizarTelefono };
