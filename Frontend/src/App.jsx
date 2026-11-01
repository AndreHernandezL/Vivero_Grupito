import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Droplets,
  CloudRain,
  Power,
  RefreshCw,
  Sun,
  Thermometer,
  Waves,
  Leaf,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';
import './App.css';

const ACCIONES = [
  { id: 'riego-encender', texto: 'Encender bomba', icono: Power, tipo: 'principal' },
  { id: 'riego-apagar', texto: 'Apagar bomba', icono: Power, tipo: 'peligro' },
  { id: 'riego-automatico', texto: 'Riego automático', icono: RotateCcw },
  { id: 'techo-abrir', texto: 'Abrir techo', icono: ArrowUp },
  { id: 'techo-cerrar', texto: 'Cerrar techo', icono: ArrowDown },
  { id: 'techo-automatico', texto: 'Techo automático', icono: Sun },
];


function fechaLocalISO(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

// Convierte la lectura analógica a un porcentaje aproximado.
// Ajusta estos límites con mediciones reales de tu sensor.
function humedadPorcentaje(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === '' ||
    !Number.isFinite(Number(valor))
  ) {
    return null;
  }

  const lectura = Number(valor);

  return Math.round(
    Math.max(0, Math.min(100, ((700 - lectura) / 200) * 100))
  );
}

function prepararLectura(datos, fecha = new Date().toISOString()) {
  const instante = new Date(fecha);

  return {
    fecha: instante.toISOString(),
    hora: instante.toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    fechaCorta: instante.toLocaleDateString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    timestamp: instante.getTime(),
    humedad: humedadPorcentaje(Number(datos.humedadSuelo)),
    nivel: datos.nivelAguaPorcentaje == null
      ? null
      : Number(datos.nivelAguaPorcentaje),
  };
}

function Panel({ titulo, icono: Icono, children, clase = '' }) {
  return (
    <section className={`panel ${clase}`}>
      <div className="panel-titulo">
        <span className="icono-panel"><Icono size={19} /></span>
        <h2>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function EtiquetaFechaHora({ x, y, payload, mostrarFecha }) {
  const fecha = new Date(payload.value);

  const hora = fecha.toLocaleTimeString('es-GT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dia = fecha.toLocaleDateString('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill="#63736a"
        fontSize={11}
      >
        {hora}
      </text>

      {mostrarFecha && (
        <text
          x={0}
          y={0}
          dy={27}
          textAnchor="middle"
          fill="#63736a"
          fontSize={10}
        >
          {dia}
        </text>
      )}
    </g>
  );
}

function App() {
  const [estado, setEstado] = useState(null);
  const [lecturas, setLecturas] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [cargando, setCargando] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  
  const hoyInicial = fechaLocalISO();

  const [desde, setDesde] = useState(hoyInicial);
  const [hasta, setHasta] = useState(hoyInicial);

  const [filtroAplicado, setFiltroAplicado] = useState({
    modo: 'hoy',
    desde: hoyInicial,
    hasta: hoyInicial,
  });

  // Mantiene accesibles los filtros actuales desde WebSocket.
  const filtroRef = useRef(filtroAplicado);
  filtroRef.current = filtroAplicado;


  
const cargarHistorial = useCallback(async (filtro = filtroRef.current) => {
  try {
    const parametros = new URLSearchParams({});

    if (filtro.desde) parametros.set('desde', filtro.desde);
    if (filtro.hasta) parametros.set('hasta', filtro.hasta);

    const respuesta = await fetch(
      `/api/vivero/historial?${parametros.toString()}`
    );

    if (!respuesta.ok) {
      throw new Error('No se pudo cargar el historial');
    }

    const resultado = await respuesta.json();
    const filas = (resultado.datos || [])
    .map((fila) => ({
      fecha: fila.fecha,
      hora: fila.hora,
      etiqueta:
        filtro.modo === 'rango'
          ? `${fila.hora}\n${fila.fecha}`
          : fila.hora,
      humedad: humedadPorcentaje(Number(fila.humedad_suelo)),
      nivel:
        fila.nivel_agua_porcentaje == null
          ? null
          : Number(fila.nivel_agua_porcentaje),
    }))
    .filter(
      (fila) =>
        fila.fecha &&
        fila.hora &&
        Number.isFinite(fila.humedad)
    )
    .reverse();

    setLecturas(filas);
    setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);


  const actualizarEstado = useCallback(async () => {
    try {
      const respuesta = await fetch('/api/vivero/estado');
      if (!respuesta.ok) throw new Error('No se pudo consultar el estado');

      const resultado = await respuesta.json();

      if (resultado.datos) {
        setEstado(resultado.datos);
      }
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);


useEffect(() => {
  cargarHistorial(filtroAplicado);
  actualizarEstado();
}, [cargarHistorial, actualizarEstado, filtroAplicado]);

useEffect(() => {
  const protocolo =
    window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  const socket = new WebSocket(
    `${protocolo}//${window.location.host}/ws`
  );

  socket.onopen = () => setConectado(true);
  socket.onclose = () => setConectado(false);
  socket.onerror = () => setConectado(false);

  socket.onmessage = (evento) => {
    try {
      const mensajeWS = JSON.parse(evento.data);

      if (mensajeWS.tipo === 'estado' && mensajeWS.datos) {
        setEstado(mensajeWS.datos);
        setError('');

        const filtro = filtroRef.current;
        const hoy = fechaLocalISO();

        // Actualizar las métricas automáticamente cuando
        // el período seleccionado incluya el día de hoy.
        if (filtro.desde <= hoy && filtro.hasta >= hoy) {
          cargarHistorial(filtro);
        }
      } else if (mensajeWS.tipo === 'error') {
        setError(mensajeWS.mensaje || 'Error de comunicación');
      }
    } catch {
      setError('Se recibió un mensaje no válido por WebSocket');
    }
  };

  return () => socket.close();
}, [cargarHistorial]);


  async function ejecutarAccion(accion) {
    setCargando((previo) => ({ ...previo, [accion]: true }));
    setMensaje('');
    setError('');

    try {
      const respuesta = await fetch(`/api/vivero/control/${accion}`, {
        method: 'POST',
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.exito) {
        throw new Error(resultado.error || 'No se pudo ejecutar la acción');
      }

      setMensaje('Comando enviado correctamente.');
      await actualizarEstado();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando((previo) => ({ ...previo, [accion]: false }));
    }
  }

  const humedad = estado
    ? humedadPorcentaje(Number(estado.humedadSuelo))
    : null;

  const nivel = Number.isFinite(Number(estado?.nivelAguaPorcentaje))
    ? Math.max(0, Math.min(100, Number(estado.nivelAguaPorcentaje)))
    : null;

  
  function verHoy() {
    const hoy = fechaLocalISO();

    setDesde(hoy);
    setHasta(hoy);

    setFiltroAplicado({
      modo: 'hoy',
      desde: hoy,
      hasta: hoy,
    });
  }

  function aplicarRango(e) {
    e.preventDefault();

    if (!desde || !hasta) {
      setError('Selecciona ambas fechas.');
      return;
    }

    if (desde > hasta) {
      setError('La fecha inicial no puede ser posterior a la final.');
      return;
    }

    const dias =
      (Date.parse(`${hasta}T00:00:00Z`) -
        Date.parse(`${desde}T00:00:00Z`)) /
        86400000 +
      1;

    if (dias > 5) {
      setError('Solo puedes consultar un rango máximo de 5 días.');
      return;
    }

    setError('');
    setFiltroAplicado({
      modo: 'rango',
      desde,
      hasta,
    });
  }

  return (
    <main className="dashboard">
      <header className="encabezado">
        <div className="marca">
          <div className="logo"><Leaf size={26} /></div>
          <div>
            <p className="sobretitulo">MONITOREO INTELIGENTE</p>
            <h1>Vivero <span>Grupito 🥂</span></h1>
            <p className="subtitulo">Panel de control y sensores</p>
          </div>
        </div>

        <div className={`conexion ${conectado ? 'online' : 'offline'}`}>
          {conectado ? <Wifi size={17} /> : <WifiOff size={17} />}
          {conectado ? 'WebSocket conectado' : 'Sin conexión WebSocket'}
        </div>
      </header>

      {(mensaje || error) && (
        <div className={`aviso ${error ? 'aviso-error' : 'aviso-ok'}`}>
          {error || mensaje}
          <button onClick={() => { setMensaje(''); setError(''); }}>×</button>
        </div>
      )}

      <section className="resumen">
        <div className="bienvenida">
          <div>
            <p className="sobretitulo">VISTA GENERAL</p>
            <h2>Tu vivero, de un vistazo</h2>
            <p>Supervisa la humedad, el agua y los actuadores.</p>
          </div>
          <button className="boton-refrescar" onClick={() => {
            actualizarEstado();
            cargarHistorial();
          }}>
            <RefreshCw size={17} /> Actualizar
          </button>
        </div>

        <div className="tarjetas">
          <article className="tarjeta">
            <div className="tarjeta-icono verde"><Droplets /></div>
            <p>Humedad estimada</p>
            <strong>{humedad === null ? '—' : `${humedad}%`}</strong>
            <span>{estado?.sueloSeco ? 'Suelo seco' : 'Según sensor'}</span>
          </article>

          <article className="tarjeta">
            <div className="tarjeta-icono azul"><Waves /></div>
            <p>Nivel del tanque</p>
            <strong>{nivel === null ? '—' : `${nivel}%`}</strong>
            <span>
              {estado?.distanciaAguaCm >= 0
                ? `${estado.distanciaAguaCm} cm de distancia`
                : 'Sin lectura válida'}
            </span>
          </article>

          <article className="tarjeta">
            <div className="tarjeta-icono naranja"><Power /></div>
            <p>Bomba de agua</p>
            <strong className="estado-texto">
              {estado ? (estado.bombaEncendida ? 'Encendida' : 'Apagada') : '—'}
            </strong>
            <span>{estado?.modoRiego || 'Esperando datos'}</span>
          </article>

          <article className="tarjeta">
            <div className="tarjeta-icono violeta"><CloudRain /></div>
            <p>Sensor de lluvia</p>
            <strong className="estado-texto">
              {estado ? (estado.lluvia ? 'Lluvia' : 'Sin lluvia') : '—'}
            </strong>
            <span>
              {estado?.techoCerrado ? 'Techo cerrado' : 'Techo abierto'}
            </span>
          </article>
        </div>
      </section>

      <section className="contenido">
        <Panel titulo="Historial de humedad" icono={Activity} clase="panel-grafica">
          
          <form className="filtros-historial" onSubmit={aplicarRango}>
            <button
              type="button"
              className={`boton-filtro ${filtroAplicado.modo === 'hoy' ? 'activo' : ''}`}
              onClick={verHoy}
            >
              <Activity size={16} />
              Tiempo real · Hoy
            </button>

            <div className="filtros-campos">
              <label className="campo-fecha">
                <span>Desde</span>
                <input
                  type="date"
                  value={desde}
                  max={fechaLocalISO()}
                  onChange={(e) => setDesde(e.target.value)}
                  required
                />
              </label>

              <label className="campo-fecha">
                <span>Hasta</span>
                <input
                  type="date"
                  value={hasta}
                  max={fechaLocalISO()}
                  min={desde || undefined}
                  onChange={(e) => setHasta(e.target.value)}
                  required
                />
              </label>

              <button type="submit" className="boton-filtro">
                Aplicar fechas
              </button>
            </div>
          </form>
          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}
          <div className="grafica-resumen">
            <div>
              <strong>{humedad === null ? '—' : `${humedad}%`}</strong>
              <span>Humedad estimada actual</span>
            </div>
            <span className="etiqueta-tiempo">
              {filtroAplicado.modo === 'hoy'
                ? `Hoy · ${lecturas.length} lecturas`
                : `${filtroAplicado.desde} — ${filtroAplicado.hasta}`}
            </span>
          </div>

          <div className="grafica">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lecturas} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <defs>
                  <linearGradient id="humedadColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#259b70" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#259b70" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#e6ece8" />
                <XAxis
                  dataKey="etiqueta"
                  interval="preserveStartEnd"
                  minTickGap={25}
                  height={filtroAplicado.modo === 'rango' ? 48 : 30}
                  tick={({ x, y, payload }) => {
                    const partes = String(payload.value).split('\n');

                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={12}
                          textAnchor="middle"
                          fill="#63736a"
                          fontSize={11}
                        >
                          {partes[0]}
                        </text>

                        {partes[1] && (
                          <text
                            x={0}
                            y={0}
                            dy={27}
                            textAnchor="middle"
                            fill="#63736a"
                            fontSize={10}
                          >
                            {partes[1]}
                          </text>
                        )}
                      </g>
                    );
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#7b8982' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(valor) => `${valor}%`}
                />
                <Tooltip
                  labelFormatter={(etiqueta) => {
                    const lectura = lecturas.find(
                      (fila) => fila.etiqueta === etiqueta
                    );

                    return lectura
                      ? `${lectura.fecha} — ${lectura.hora}`
                      : String(etiqueta);
                  }}
                  formatter={(valor) => [
                    `${Number(valor).toFixed(1)}%`,
                    'Humedad',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="humedad"
                  stroke="#259b70"
                  strokeWidth={2.5}
                  fill="url(#humedadColor)"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 5, fill: '#259b70' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="nota-grafica">
            Porcentaje aproximado calculado a partir de la lectura analógica.
            Calibra los valores seco y húmedo para mejorar la precisión.
          </p>
        </Panel>

        <Panel titulo="Nivel del tanque" icono={Waves}>
          <div className="tanque">
            <div className="tanque-visual">
              <div className="tanque-agua" style={{ height: `${nivel ?? 0}%` }}>
                <div className="olas" />
              </div>
              <span className="tanque-porcentaje">
                {nivel === null ? '—' : `${nivel}%`}
              </span>
            </div>
            <div className="tanque-detalles">
              <div><span>Estado</span><strong>
                {nivel === null ? 'Sin lectura' : nivel <= 10 ? 'Bajo' : nivel >= 90 ? 'Lleno' : 'Disponible'}
              </strong></div>
              <div><span>Distancia al agua</span><strong>
                {estado?.distanciaAguaCm >= 0 ? `${estado.distanciaAguaCm} cm` : '—'}
              </strong></div>
              <div><span>Agua detectada</span><strong>
                {estado ? (estado.tanqueTieneAgua ? 'Sí' : 'No') : '—'}
              </strong></div>
            </div>
          </div>
        </Panel>

        <Panel titulo="Control del vivero" icono={Power} clase="panel-controles">
          <p className="descripcion-panel">
            Selecciona una acción para enviar el comando al Arduino.
          </p>
          <div className="botones-control">
            {ACCIONES.map(({ id, texto, icono: Icono, tipo }) => (
              <button
                key={id}
                className={`boton-control ${tipo || ''}`}
                disabled={Boolean(cargando[id])}
                onClick={() => ejecutarAccion(id)}
              >
                <Icono size={18} />
                <span>{cargando[id] ? 'Enviando…' : texto}</span>
              </button>
            ))}
          </div>
          <div className="estado-actuadores">
            <div>
              <span className={`punto ${estado?.bombaEncendida ? 'activo' : ''}`} />
              Bomba: {estado ? (estado.bombaEncendida ? 'Activa' : 'Inactiva') : 'Sin datos'}
            </div>
            <div>
              <span className={`punto ${estado?.techoCerrado ? 'activo' : ''}`} />
              Techo: {estado ? (estado.techoCerrado ? 'Cerrado' : 'Abierto') : 'Sin datos'}
            </div>
          </div>
        </Panel>
      </section>

      <footer className="pie">
        <span><Leaf size={15} /> Vivero UMG</span>
        <span><Thermometer size={15} /> Monitoreo del sistema</span>
        <span>{lecturas.length} puntos en gráfica</span>
      </footer>
    </main>
  );
}

export default App;
