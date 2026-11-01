
USE appdb;

CREATE TABLE IF NOT EXISTS lecturas_vivero (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    humedad_suelo SMALLINT NULL,
    suelo_seco BOOLEAN NULL,
    lluvia BOOLEAN NULL,

    distancia_agua_cm DECIMAL(6,2) NULL,
    nivel_agua_porcentaje TINYINT UNSIGNED NULL,
    tanque_tiene_agua BOOLEAN NULL,

    bomba_encendida BOOLEAN NULL,
    modo_riego VARCHAR(20) NULL,

    modo_techo VARCHAR(20) NULL,
    techo_cerrado BOOLEAN NULL,

    ip_arduino VARCHAR(45) NULL,

    PRIMARY KEY (id),
    INDEX idx_fecha_registro (fecha_registro)
);

CREATE TABLE IF NOT EXISTS eventos_vivero (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_evento VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NULL,
    valor VARCHAR(100) NULL,

    PRIMARY KEY (id),
    INDEX idx_evento_fecha (fecha_registro),
    INDEX idx_tipo_evento (tipo_evento)
);
