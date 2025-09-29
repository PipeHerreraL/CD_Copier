# 💿 Archivo README: CD Copier

## 🚀 Copiador Masivo de CDs/DVDs con Interfaz Web

Esta es una aplicación de escritorio local desarrollada con **Node.js y Express** que automatiza la copia masiva de CDs o DVDs. La herramienta monitorea unidades ópticas, copia el contenido a una carpeta de destino y expulsa automáticamente la bandeja al finalizar, nombrando las carpetas con la **estampa de tiempo y la etiqueta del disco**.

El proyecto combina una interfaz web simple (`index.html`) para control con la potencia de la línea de comandos de Windows (a través de Node.js) para la gestión del sistema de archivos y *hardware*.

---

## ✨ Características Principales

* **Detección Automática:** Monitorea continuamente las unidades ópticas configuradas.
* **Copia Robusta:** Utiliza **`Robocopy`** de Windows para manejar reintentos y errores de lectura en discos rayados.
* **Nomenclatura Inteligente:** Las carpetas se nombran automáticamente con el formato: **`YYYYMMDD_HHMMSS_ETIQUETA_DEL_DISCO`**.
* **Expulsión Automática:** Expulsa la bandeja del CD/DVD tras una copia exitosa.
* **Interfaz Web (HTML):** Control simple de inicio y parada desde un navegador web local.
* **Registro (Log):** Genera un archivo de registro (`Logs_Copia_CDs.txt`) detallado de cada operación.

---

## ⚙️ Requisitos del Sistema

Para ejecutar esta aplicación, tu sistema debe cumplir con los siguientes requisitos:

1.  **Sistema Operativo:** Windows 10/11.
2.  **Entorno:** **Node.js** (versión 14 o superior) y **npm** instalado.
3.  **Utilidad Externa:** **NirCmd** (requerida para la función de expulsión de bandeja).
    * *Descarga `nircmd.exe` y colócalo en la carpeta raíz del proyecto (`CD_Copier`) o en el PATH.*

---

## 📦 Instalación y Configuración

Sigue estos pasos para poner en marcha el proyecto:

### 1. Clonar el Repositorio

```bash
git clone https://github.com/PipeHerreraL/CD_Copier.git
cd CD_Copier
```

### 2. Instalar Dependencias

Asegúrate de tener el archivo package.json en la carpeta y luego instala el framework Express:

```bash
npm install
```

3. Personalizar la Configuración (server.js)
   Abre el archivo server.js y edita la sección de configuración para que coincida con tus unidades ópticas:

```js
// --- CONFIGURACIÓN DE UNIDADES Y RUTAS ---
const DRIVE_A = 'I:';  // ¡Modifica a tu unidad A!
const DRIVE_B = 'J:';  // ¡Modifica a tu unidad B!
// ... (El resto de rutas)
```

## 🏃 Uso de la Aplicación
### 1. Iniciar el Servidor
Abre el Símbolo del Sistema o PowerShell.

⚠️ Importante: Si experimentas errores de permisos (EPERM, fallos con WMIC), ejecuta tu terminal como Administrador antes de iniciar Node.js.

```bash
node server.js
```

### 2. Acceder a la Interfaz Web
Abre tu navegador y navega a la siguiente dirección:

```
http://localhost:3000
```

### 3. Controlar el Proceso
Iniciar Monitoreo: Pulsa el botón "Iniciar Monitoreo". El servidor comenzará a buscar discos en las unidades configuradas.

Detener: Pulsa "Detener". El proceso detendrá el monitoreo después de finalizar la copia del disco actualmente en proceso.