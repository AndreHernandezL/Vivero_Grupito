
import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

import {
  guardarLectura,
  obtenerHistorial,
  verificarConexion,
  cerrarConexion,
} from './database.js';

const app = express();
const server = createServer(app);

const PORT = Number(process.env.PORT || 3000);
const ARDUINO_URL =
  process.env.ARDUINO_URL || 'http://192.168.0.233';
const INTERVALO_MS = 15000;

app.use(express.json());




const accionesArduino = {
  'riego-encender': '/api/riego/encender',
  'riego-apagar': '/api/riego/apagar',
  'riego-automatico': '/api/modo/automatico',
  'techo-abrir': '/api/techo/abrir',
  'techo-cerrar': '/api/techo/cerrar',
  'techo-automatico': '/api/techo/automatico',
};

app.post('/api/vivero/control/:accion', async (req, res) => {
  const rutaArduino = accionesArduino[req.params.accion];

  if (!rutaArduino) {
    return res.status(404).json({
      exito: false,
      error: 'Acción no reconocida',
    });
  }

  try {
    const respuesta = await fetch(`${ARDUINO_URL}${rutaArduino}`, {
      signal: AbortSignal.timeout(5000),
    });

    const texto = await respuesta.text();

    if (!respuesta.ok) {
      return res.status(502).json({
        exito: false,
        error: `El Vivero respondió HTTP ${respuesta.status}`,
      });
    }

    res.json({
      exito: true,
      mensaje: 'Solicitud enviada al Vivero',
      respuesta: texto,
    });
  } catch (error) {
    console.error('Error enviando comando al Vivero:', error.message);

    res.status(502).json({
      exito: false,
      error: 'No se pudo contactar con el Vivero',
    });
  }
});



const wss = new WebSocketServer({
  server,
  path: '/ws',
});

// Estado más reciente recibido del Arduino
let ultimoEstado = null;
let ultimaActualizacion = null;
let ultimoErrorArduino = null;

// -----------------------------
// RUTAS DE LA API
// -----------------------------


app.get('/api/vivero/historial', async (req, res) => {
  try {
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;

    const fechaValida = (fecha) =>
      typeof fecha === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
      !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) &&
      new Date(`${fecha}T00:00:00Z`)
        .toISOString()
        .startsWith(fecha);

    if (
      (desde && !fechaValida(desde)) ||
      (hasta && !fechaValida(hasta))
    ) {
      return res.status(400).json({
        exito: false,
        error: 'La fecha seleccionada no es válida.',
      });
    }

    if (desde && hasta && desde > hasta) {
      return res.status(400).json({
        exito: false,
        error: 'La fecha inicial no puede ser posterior a la final.',
      });
    }

    if (desde && hasta) {
      const dias =
        (Date.parse(`${hasta}T00:00:00Z`) -
          Date.parse(`${desde}T00:00:00Z`)) /
          86400000 +
        1;

      if (dias > 5) {
        return res.status(400).json({
          exito: false,
          error: 'El rango máximo permitido es de 5 días.',
        });
      }
    }

    // Sin fechas, consulta el día actual completo.
    const hoy = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Guatemala',
    });

    const fechaDesde = desde || hoy;
    const fechaHasta = hasta || hoy;

    // Si solo se proporciona una fecha, consulta ese día.
    const datos = await obtenerHistorial(fechaDesde, fechaHasta);

    res.json({
      exito: true,
      cantidad: datos.length,
      filtros: {
        desde: fechaDesde,
        hasta: fechaHasta,
      },
      datos,
    });
  } catch (error) {
    console.error('Error consultando historial:', error.message);

    res.status(500).json({
      exito: false,
      error: 'No se pudo consultar el historial.',
    });
  }
});


// Obtener el estado actual en memoria
app.get('/api/vivero/estado', (req, res) => {
  if (!ultimoEstado) {
    return res.status(503).json({
      exito: false,
      error: ultimoErrorArduino || 'Esperando datos del Arduino',
    });
  }

  res.json({
    exito: true,
    ultimaActualizacion,
    datos: ultimoEstado,
  });
});

// Obtener historial desde MySQL
app.get('/api/vivero/historial', async (req, res) => {
  try {
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;

    const fechaValida = (fecha) =>
      typeof fecha === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
      !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) &&
      new Date(`${fecha}T00:00:00Z`)
        .toISOString()
        .startsWith(fecha);

    if (
      (desde && !fechaValida(desde)) ||
      (hasta && !fechaValida(hasta))
    ) {
      return res.status(400).json({
        exito: false,
        error: 'La fecha seleccionada no es válida.',
      });
    }

    if (desde && hasta && desde > hasta) {
      return res.status(400).json({
        exito: false,
        error: 'La fecha inicial no puede ser posterior a la final.',
      });
    }

    if (desde && hasta) {
      const dias =
        (Date.parse(`${hasta}T00:00:00Z`) -
          Date.parse(`${desde}T00:00:00Z`)) /
          86400000 +
        1;

      if (dias > 5) {
        return res.status(400).json({
          exito: false,
          error: 'El rango máximo permitido es de 5 días.',
        });
      }
    }

    // Sin fechas, consulta el día actual completo.
    const hoy = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Guatemala',
    });

    const fechaDesde = desde || hoy;
    const fechaHasta = hasta || hoy;

    // Si solo se proporciona una fecha, consulta ese día.
    const datos = await obtenerHistorial(fechaDesde, fechaHasta);

    res.json({
      exito: true,
      cantidad: datos.length,
      filtros: {
        desde: fechaDesde,
        hasta: fechaHasta,
      },
      datos,
    });
  } catch (error) {
    console.error('Error consultando historial:', error.message);

    res.status(500).json({
      exito: false,
      error: 'No se pudo consultar el historial.',
    });
  }
});

// -----------------------------
// FUNCIONES DE WEBSOCKET
// -----------------------------

function enviarAClientes(mensaje) {
  const contenido = JSON.stringify(mensaje);

  for (const cliente of wss.clients) {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(contenido);
    }
  }
}

wss.on('connection', (socket) => {
  console.log('Cliente WebSocket conectado');

  // Enviar inmediatamente el último estado conocido
  if (ultimoEstado) {
    socket.send(JSON.stringify({
      tipo: 'estado',
      fecha: ultimaActualizacion,
      datos: ultimoEstado,
    }));
  }

  socket.on('error', (error) => {
    console.error('Error WebSocket:', error.message);
  });

  socket.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });
});

// -----------------------------
// CONSULTA AL ARDUINO
// -----------------------------

let consultaEnCurso = false;

async function consultarArduino() {
  if (consultaEnCurso) return;

  consultaEnCurso = true;

  try {
    const respuesta = await fetch(
      `${ARDUINO_URL}/api/estado`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!respuesta.ok) {
      throw new Error(`Arduino respondió HTTP ${respuesta.status}`);
    }

    const datos = await respuesta.json();

    // Actualizar el estado en memoria
    ultimoEstado = datos;
    ultimaActualizacion = new Date().toISOString();
    ultimoErrorArduino = null;

    // Guardar en MySQL sin impedir el envío por WebSocket
    try {
      const id = await guardarLectura(datos);
      console.log(`Lectura guardada en MySQL. ID: ${id}`);
    } catch (errorDB) {
      console.error('Error guardando en MySQL:', errorDB.message);
    }

    // Publicar el estado a los clientes conectados
    enviarAClientes({
      tipo: 'estado',
      fecha: ultimaActualizacion,
      datos,
    });

    console.log('Estado recibido del Arduino');
  } catch (error) {
    ultimoErrorArduino = error.message;

    console.error('Error consultando Arduino:', error.message);

    enviarAClientes({
      tipo: 'error',
      mensaje: 'No se pudo consultar el Arduino',
      fecha: new Date().toISOString(),
    });
  } finally {
    consultaEnCurso = false;
  }
}

// -----------------------------
// INICIAR SERVIDOR
// -----------------------------


let intervaloConsulta;

async function iniciarServidor() {
  try {
    await verificarConexion();
  } catch (error) {
    console.error(
      'No se pudo conectar a MySQL al iniciar:',
      error.message
    );
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Express escuchando en puerto ${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`Arduino: ${ARDUINO_URL}`);

    consultarArduino();
    intervaloConsulta = setInterval(
      consultarArduino,
      INTERVALO_MS
    );
  });
}

async function apagarServidor() {
  console.log('Cerrando servidor...');

  clearInterval(intervaloConsulta);

  for (const cliente of wss.clients) {
    cliente.close();
  }

  server.close(async () => {
    try {
      await cerrarConexion();
    } catch (error) {
      console.error('Error cerrando MySQL:', error.message);
    }

    process.exit(0);
  });
}

process.on('SIGINT', apagarServidor);
process.on('SIGTERM', apagarServidor);

iniciarServidor();

