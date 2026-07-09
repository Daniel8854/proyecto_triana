import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Ventas from './pages/Ventas';
import Pagos from './pages/Pagos';
import Entrenamiento from './pages/Entrenamiento';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-md p-4">
          <div className="container mx-auto flex gap-4">
            <a href="/" className="text-blue-600">Dashboard</a>
            <a href="/clientes" className="text-blue-600">Clientes</a>
            <a href="/ventas" className="text-blue-600">Ventas</a>
            <a href="/pagos" className="text-blue-600">Pagos</a>
            <a href="/entrenamiento" className="text-blue-600">Entrenamiento</a>
          </div>
        </nav>
        
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route path="/entrenamiento" element={<Entrenamiento />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;