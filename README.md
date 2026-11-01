Paso para la instalación del web services:
1. Entrar a la carpeta Backend y ejecutar la 'docker build -t vivero_back .'
2. Entrar a la carpeta FrontEnd y ejecutar la 'docker build -t vivero_front .'
3. En el archvio docker-compose.yml que se encuentra en la raiz del proyecto, y cambiar la instruccion de la linea command del servicio de backend por 'command: pnpm install'
4. ejecutar el comando 'docker compose up -d' en la raiz del proyecto
5. Volver a editar el archivo docker-compose.yml y cambiar la linea de command del servicio de backend por 'command: node serve.js'
6. Volver a ejecutar el comando 'docker compose up -d' en la raiz del proyecto.
7. Abrir el archvio BDD.sql desde su gestor de base de datos preferido (se recomienda Workbench o Dbeaver).
8. crear una nueva conexion de base de datos con la credenciales
     host: localhost
     port: 3307
     user: root
     password: root123
9. Ejecutar el scritpt dentro de la conexion creada.
10. reinicar el contedor donde se encuentra el servicio de backend.
11. Entrar desde el navegador a: localhost:5173
