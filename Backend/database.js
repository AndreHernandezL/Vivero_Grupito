
import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

// Comprobar que MySQL responde
export async function verificarConexion() {
  const conexion = await db.getConnection();

  try {
    await conexion.ping();
    console.log('Conexión a MySQL establecida');
  } finally {
    conexion.release();
  }
}

// Insertar una lectura de sensores
export async function guardarLectura(datos) {
  const sql = `
    INSERT INTO lecturas_vivero (
      humedad_suelo,
      suelo_seco,
      lluvia,
      distancia_agua_cm,
      nivel_agua_porcentaje,
      tanque_tiene_agua,
      bomba_encendida,
      modo_riego,
      modo_techo,
      techo_cerrado,
      ip_arduino
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const distancia =
    Number.isFinite(datos.distanciaAguaCm) &&
    datos.distanciaAguaCm >= 0
      ? datos.distanciaAguaCm
      : null;

  const nivel =
    Number.isFinite(datos.nivelAguaPorcentaje) &&
    datos.nivelAguaPorcentaje >= 0 &&
    datos.nivelAguaPorcentaje <= 100
      ? datos.nivelAguaPorcentaje
      : null;

  const valores = [
    datos.humedadSuelo ?? null,
    datos.sueloSeco ?? null,
    datos.lluvia ?? null,
    distancia,
    nivel,
    datos.tanqueTieneAgua ?? null,
    datos.bombaEncendida ?? null,
    datos.modoRiego ?? null,
    datos.modoTecho ?? null,
    datos.techoCerrado ?? null,
    datos.ip ?? null,
  ];

  const [resultado] = await db.execute(sql, valores);

  return resultado.insertId;
}

export async function obtenerHistorial(desde = null, hasta = null) {
  const condiciones = [];
  const valores = [];

  if (desde) {
    condiciones.push('DATE(lv.fecha_registro) >= ?');
    valores.push(desde);
  }

  if (hasta) {
    condiciones.push('DATE(lv.fecha_registro) <= ?');
    valores.push(hasta);
  }

  const where = condiciones.length
    ? `WHERE ${condiciones.join(' AND ')}`
    : '';

  const sql = `
    SELECT
      DATE_FORMAT(lv.fecha_registro, '%Y-%m-%d') AS fecha,
      TIME_FORMAT(lv.fecha_registro, '%H:%i:%s') AS hora,
      lv.distancia_agua_cm,
      lv.nivel_agua_porcentaje,
      lv.tanque_tiene_agua,
      lv.humedad_suelo,
      lv.suelo_seco,
      lv.lluvia,
      lv.bomba_encendida,
      lv.modo_riego,
      lv.modo_techo,
      lv.techo_cerrado
    FROM lecturas_vivero lv
    ${where}
    ORDER BY lv.fecha_registro DESC
  `;

  const [filas] = await db.execute(sql, valores);
  return filas;
}


// Cerrar el pool cuando se detenga el servidor
export async function cerrarConexion() {
  await db.end();
}
