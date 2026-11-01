
#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

// =====================================================
// 1. CONFIGURACION WIFI
// =====================================================
const char* WIFI_SSID = "Charly_Room";
const char* WIFI_PASSWORD = "Oc@rina1995$.";

// =====================================================
// 2. PINES ESP32 DEVKIT V1
// =====================================================
const int PIN_HUMEDAD = 34; // ADC1, entrada analogica
const int PIN_LLUVIA  = 27; // Sensor de lluvia, salida digital
const int PIN_TRIG    = 18; // Ultrasonico TRIG
const int PIN_ECHO    = 19; // Ultrasonico ECHO, con divisor
const int PIN_SERVO   = 25; // Servo del techo
const int PIN_RELE    = 26; // IN del modulo de rele

// Rele activo en LOW
const int RELE_ENCENDIDO = LOW;
const int RELE_APAGADO   = HIGH;

// =====================================================
// 3. CALIBRACION
// =====================================================

// Mantiene una escala aproximada de 0 a 1023,
// compatible con la lectura anterior del Arduino Uno.
const int SUELO_SECO_ADC   = 700;
const int SUELO_HUMEDO_ADC = 500;

// Tanque: distancia del sensor a la superficie del agua
const float TANQUE_VACIO_CM = 12.0;
const float TANQUE_LLENO_CM = 4.0;

// Techo: mismos angulos del proyecto anterior
const int ANGULO_TECHO_ABIERTO = 0;
const int ANGULO_TECHO_CERRADO = 155;

// =====================================================
// 4. OBJETOS Y ESTADO
// =====================================================
WebServer server(80);
Servo servoTecho;

bool bombaEncendida = false;
bool modoRiegoAutomatico = true;
bool modoTechoAutomatico = true;
bool techoCerrado = false;

int humedadSuelo = 0;
bool sueloSeco = false;
bool lluvia = false;

float distanciaAguaCm = -1.0;
int nivelAguaPorcentaje = 0;
bool tanqueTieneAgua = false;

unsigned long ultimaLectura = 0;
const unsigned long INTERVALO_LECTURA_MS = 1000;

// =====================================================
// 5. CONTROL DE BOMBA Y TECHO
// =====================================================

void apagarBomba() {
  digitalWrite(PIN_RELE, RELE_APAGADO);
  bombaEncendida = false;
}

void encenderBomba() {
  digitalWrite(PIN_RELE, RELE_ENCENDIDO);
  bombaEncendida = true;
}

void abrirTecho() {
  servoTecho.write(ANGULO_TECHO_ABIERTO);
  techoCerrado = false;
}

void cerrarTecho() {
  servoTecho.write(ANGULO_TECHO_CERRADO);
  techoCerrado = true;
}

// =====================================================
// 6. LECTURA DE SENSORES
// =====================================================

float medirDistanciaAgua() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(3);

  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  unsigned long duracion = pulseIn(PIN_ECHO, HIGH, 30000);

  if (duracion == 0) {
    return -1.0; // Sin eco valido
  }

  float distancia = duracion * 0.0343 / 2.0;

  // Rechazar lecturas fuera del rango util del tanque
  if (distancia < 2.0 || distancia > 400.0) {
    return -1.0;
  }

  return distancia;
}

void actualizarSensores() {
  // Escala aproximada de 0-1023 para compatibilidad
  // con el software anterior del dashboard.
  int adc = analogRead(PIN_HUMEDAD);
  humedadSuelo = adc / 4;

  // Esta calibracion supone que un valor alto
  // significa suelo mas seco.
  sueloSeco = (humedadSuelo >= SUELO_SECO_ADC);

  // El sensor de lluvia se considera activo en LOW
  lluvia = (digitalRead(PIN_LLUVIA) == LOW);

  distanciaAguaCm = medirDistanciaAgua();

  if (distanciaAguaCm < 0) {
    nivelAguaPorcentaje = 0;
    tanqueTieneAgua = false;
  } else {
    float porcentaje =
      (TANQUE_VACIO_CM - distanciaAguaCm) /
      (TANQUE_VACIO_CM - TANQUE_LLENO_CM) * 100.0;

    nivelAguaPorcentaje =
      constrain((int)(porcentaje + 0.5), 0, 100);

    // Segun la calibracion del tanque:
    // distancia >= 10 cm: vacio
    // distancia <= 4 cm: lleno
    tanqueTieneAgua = (distanciaAguaCm < TANQUE_VACIO_CM);
  }
}

// =====================================================
// 7. AUTOMATIZACION
// =====================================================

void ejecutarAutomatizacion() {
  if (modoRiegoAutomatico) {
    // Nunca arrancar la bomba si no hay agua,
    // si llueve o si el suelo no esta seco.
    if (sueloSeco && !lluvia && tanqueTieneAgua) {
      encenderBomba();
    } else {
      apagarBomba();
    }
  }

  if (modoTechoAutomatico) {
    if (lluvia) {
      cerrarTecho();
    } else {
      abrirTecho();
    }
  }
}

// =====================================================
// 8. RESPUESTA JSON DEL ESTADO
// =====================================================

String construirJSONEstado() {
  String json = "{";

  json += "\"humedadSuelo\":" + String(humedadSuelo) + ",";
  json += "\"sueloSeco\":" + String(sueloSeco ? "true" : "false") + ",";
  json += "\"lluvia\":" + String(lluvia ? "true" : "false") + ",";
  json += "\"distanciaAguaCm\":" + String(distanciaAguaCm, 1) + ",";
  json += "\"nivelAguaPorcentaje\":" + String(nivelAguaPorcentaje) + ",";
  json += "\"tanqueTieneAgua\":" + String(tanqueTieneAgua ? "true" : "false") + ",";
  json += "\"bombaEncendida\":" + String(bombaEncendida ? "true" : "false") + ",";
  json += "\"modoRiego\":\"" + String(modoRiegoAutomatico ? "automatico" : "manual") + "\",";
  json += "\"modoTecho\":\"" + String(modoTechoAutomatico ? "automatico" : "manual") + "\",";
  json += "\"techoCerrado\":" + String(techoCerrado ? "true" : "false") + ",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\"";

  json += "}";
  return json;
}

void responderEstado() {
  server.send(200, "application/json", construirJSONEstado());
}

void responderOK(const String& mensaje) {
  String json = "{\"ok\":true,\"mensaje\":\"" + mensaje + "\"}";
  server.send(200, "application/json", json);
}

// =====================================================
// 9. RUTAS HTTP: COMPATIBLES CON EL BACKEND
// =====================================================

void configurarRutas() {
  server.on("/", HTTP_GET, []() {
    server.send(200, "text/plain",
      "Vivero ESP32 activo. Consulta /api/estado");
  });

  server.on("/api/estado", HTTP_GET, responderEstado);

  server.on("/api/riego/encender", HTTP_GET, []() {
    modoRiegoAutomatico = false;
    encenderBomba();
    responderOK("Bomba encendida en modo manual");
  });

  server.on("/api/riego/apagar", HTTP_GET, []() {
    modoRiegoAutomatico = false;
    apagarBomba();
    responderOK("Bomba apagada en modo manual");
  });

  server.on("/api/modo/automatico", HTTP_GET, []() {
    modoRiegoAutomatico = true;
    responderOK("Riego automatico activado");
  });

  server.on("/api/techo/abrir", HTTP_GET, []() {
    modoTechoAutomatico = false;
    abrirTecho();
    responderOK("Techo abierto en modo manual");
  });

  server.on("/api/techo/cerrar", HTTP_GET, []() {
    modoTechoAutomatico = false;
    cerrarTecho();
    responderOK("Techo cerrado en modo manual");
  });

  server.on("/api/techo/automatico", HTTP_GET, []() {
    modoTechoAutomatico = true;
    responderOK("Techo automatico activado");
  });

  server.onNotFound([]() {
    server.send(404, "application/json",
      "{\"ok\":false,\"mensaje\":\"Ruta no encontrada\"}");
  });
}

// =====================================================
// 10. CONEXION WIFI
// =====================================================

void conectarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando a Wi-Fi");

  unsigned long inicio = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - inicio < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi conectado");
    Serial.print("IP del ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nNo se pudo conectar. Se seguira intentando.");
  }
}

// =====================================================
// 11. SETUP
// =====================================================

void setup() {
  Serial.begin(115200);

  // Preparar el rele apagado antes de usarlo como salida.
  // Esto reduce, pero no elimina, posibles pulsos al arrancar.
  digitalWrite(PIN_RELE, RELE_APAGADO);
  pinMode(PIN_RELE, OUTPUT);
  apagarBomba();

  pinMode(PIN_HUMEDAD, INPUT);
  pinMode(PIN_LLUVIA, INPUT);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);

  digitalWrite(PIN_TRIG, LOW);
  analogReadResolution(12);

  servoTecho.setPeriodHertz(50);
  servoTecho.attach(PIN_SERVO, 500, 2400);
  abrirTecho();

  conectarWiFi();

  configurarRutas();
  server.begin();

  Serial.println("Servidor HTTP iniciado en puerto 80");
  Serial.println("Endpoint: /api/estado");
}

// =====================================================
// 12. LOOP
// =====================================================

void loop() {
  server.handleClient();

  // Reconectar si se pierde el Wi-Fi
  static unsigned long ultimoIntentoWiFi = 0;

  if (WiFi.status() != WL_CONNECTED &&
      millis() - ultimoIntentoWiFi >= 10000) {
    ultimoIntentoWiFi = millis();
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  // Actualizar sensores y automatizacion cada segundo
  if (millis() - ultimaLectura >= INTERVALO_LECTURA_MS) {
    ultimaLectura = millis();

    actualizarSensores();
    ejecutarAutomatizacion();

    Serial.println(construirJSONEstado());
  }
}
