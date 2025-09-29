// server.js

const express = require('express');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const app = express();
const port = 3000;

// --- CONFIGURACIÓN DE UNIDADES Y RUTAS ---
const DRIVE_A = 'I:';
const DRIVE_B = 'J:';
const TARGET_DIR = 'C:\\Archivos_Copia\\';
const LOG_FILE = 'C:\\Logs_Copia_CDs.txt';
// ----------------------------------------

// Estado global de la aplicación
let isRunning = false;
let currentStatus = "Servidor listo. Esperando inicio...";
let lastCopyInfo = ""; // Para mostrar qué disco se copió último
let currentCDName = "N/A";

// Configuración de Express
app.use(express.static('public')); // Sirve el index.html
app.use(express.json());           // Permite leer el cuerpo de las solicitudes POST

// ------------------------------------------------------------------
// --- FUNCIONES DE LÓGICA DE COPIA ---
// ------------------------------------------------------------------

/**
 * Verifica si hay un disco cargado usando WMIC (Windows Management Instrumentation).
 * @param {string} drive - La letra de la unidad (Ej: "I:").
 * @returns {boolean} - True si hay disco, False si no.
 */
function isMediaLoaded(drive) {
    try {
        // Ejecuta el comando WMIC de forma síncrona para una verificación rápida
        const result = execSync(`wmic cdrom ${drive} get MediaLoaded`, { stdio: 'pipe' }).toString();
        // Verifica si la salida contiene 'TRUE'
        return result.includes('TRUE');
    } catch (e) {
        // Asume que no hay disco o que la unidad no es válida si WMIC falla
        return false;
    }
}

/**
 * Genera una estampa de tiempo formateada (YYYYMMDD_HHMMSS).
 * @returns {string} - Estampa de tiempo.
 */
function getTimestamp() {
    const now = new Date();
    // Obtiene componentes de la fecha y asegura que tengan dos dígitos
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Obtiene la etiqueta del volumen (Volume Label) de una unidad.
 * @param {string} drive - La letra de la unidad (Ej: "I:").
 * @returns {string} - La etiqueta del volumen, o un valor por defecto si falla.
 */
function getVolumeLabel(drive) {
    try {
        // Ejecuta WMIC para obtener el 'VolumeName'
        const command = `wmic logicaldisk where DeviceID="${drive}" get VolumeName /value`;
        const result = execSync(command, { stdio: 'pipe', encoding: 'utf8' }).toString();
        
        // El resultado es una cadena como "VolumeName=NOMBRE_DEL_DISCO\r\n\r\n"
        const match = result.match(/VolumeName=(.*)/i);

        if (match && match[1].trim()) {
            let label = match[1].trim();
            
            // Limpia caracteres no seguros para nombres de archivo (opcional pero recomendado)
            label = label.replace(/[<>:"/\\|?*]/g, '_');
            
            return label;
        }
        
        // Devuelve un valor por defecto si no hay etiqueta (ej: un disco genérico)
        return `CD_SIN_NOMBRE_${Date.now()}`;
        
    } catch (e) {
        console.error(`ERROR al leer la etiqueta del volumen para ${drive}: ${e.message}`);
        return `CD_ERROR_${Date.now()}`;
    }
}

/**
 * Función principal para iniciar la copia y manejar el bucle de monitoreo.
 */
async function monitorLoop() {
    if (!isRunning) {
        currentStatus = "Proceso detenido manualmente.";
        return;
    }
    
    currentStatus = `Buscando discos en ${DRIVE_A} y ${DRIVE_B}...`;
    console.log(currentStatus);

    // 1. Procesar Unidad A (espera a que termine antes de pasar a B)
    await checkAndCopy(DRIVE_A);

    // 2. Procesar Unidad B
    await checkAndCopy(DRIVE_B);

    if (isRunning) {
        currentStatus = `Esperando 5 segundos. Copia reciente: ${lastCopyInfo || "Ninguna"}.`;
        setTimeout(monitorLoop, 5000); // Llama a sí misma después de 5 segundos
    } else {
        currentStatus = "Proceso de copia finalizado o detenido. Servidor listo.";
    }
}

/**
 * Ejecuta el comando Robocopy y la expulsión de la bandeja.
 * @param {string} currentDrive - La letra de la unidad a copiar (Ej: "I:").
 * @returns {Promise<void>}
 */
function checkAndCopy(currentDrive) {
    return new Promise(resolve => {
        if (!isMediaLoaded(currentDrive)) {
            return resolve(); // No hay disco, pasa al siguiente
        }

	const cdLabel = getVolumeLabel(currentDrive); 

	const timestamp = getTimestamp();

        const targetFolder = `${timestamp}_${cdLabel}`; 
        
        const targetPath = `${TARGET_DIR}${targetFolder}`;
        
        lastCopyInfo = `Procesando CD: ${cdLabel} como ${targetFolder} desde ${currentDrive}.`;
        currentStatus = lastCopyInfo;
        
        // 1. Asegura que la carpeta de destino exista
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }

        // Escribe el encabezado en el log
        const logEntry = `--- Copiando Disco ETIQUETA: ${cdLabel} (${targetFolder}) de ${currentDrive} a ${targetPath} ---\n`;
        fs.writeFileSync(LOG_FILE, logEntry, { flag: 'a' });

        // 2. Comando Robocopy: /E /R:3 /W:5 /TEE /LOG+:
        const robocopyCommand = `robocopy ${currentDrive}\\ "${targetPath}" /E /R:3 /W:5 /TEE /LOG+:${LOG_FILE}`;
        
        // Ejecuta robocopy de forma asíncrona
        const child = exec(robocopyCommand);
        
        // Actualiza el estado con un mensaje de progreso
        child.stdout.on('data', (data) => {
            // Muestra una línea de progreso de Robocopy si lo deseas, o usa un mensaje genérico
            currentStatus = `Copiando ${targetFolder}... ${data.trim().split('\n').pop()}`;
        });

        child.on('close', (code) => {
            // Robocopy devuelve códigos 0-8 como éxito o éxito con omisiones/archivos extra
            if (code <= 8) {
                lastCopyInfo = `✅ COPIA EXITOSA DE ${targetFolder}. Expulsando...`;
                currentStatus = lastCopyInfo;

                // 3. Expulsar la bandeja usando nircmd.exe
                try {
            		// Utilizamos 'exec' en lugar de 'execSync' y redirigimos la salida
            		// Esto previene que Node.js interprete errores menores como un fallo de ejecución
            		exec(`nircmd.exe cdrom open ${currentDrive}`, (error, stdout, stderr) => {
                		if (error) {
                    			// Si el disco se expulsa físicamente pero hay un error de código, lo ignoramos.
                    			// Si el error es grave (e.g., nircmd.exe no existe), esto lo registraremos
                    			if (error.message.includes('not found')) {
                         			lastCopyInfo = "❌ ERROR FATAL: nircmd.exe no se encontró en el PATH.";
                         			currentStatus = lastCopyInfo;
                    			} else {
                        			// El disco se expulsó, pero el código de error fue malo. 
                        			// Cambiamos el mensaje para reflejar el éxito físico.
                        			lastCopyInfo = `✅ COPIA EXITOSA. Disco expulsado (Advertencia de NirCmd).`;
                        			currentStatus = lastCopyInfo;
                    			}
                		} else {
                    			lastCopyInfo = `✅ COPIA EXITOSA. Disco expulsado.`;
                    			currentStatus = lastCopyInfo;
                		}
                
                		// Si estás usando el contador, incrementa aquí: counter++; 
                		// Si usas el nombre del CD, simplemente resolvemos.
                		resolve(); 
            		});
                } catch (e) {
                    	// Este catch solo se activaría si la llamada inicial a exec fallara
             		lastCopyInfo = `⚠️ ERROR inesperado al intentar llamar a NirCmd.`;
             		currentStatus = lastCopyInfo;
             		resolve();
                }
            } else {
        		lastCopyInfo = `❌ ERROR DE COPIA GRAVE (código: ${code}) en ${targetFolder}. Revise el log.`;
        		currentStatus = lastCopyInfo;
        		resolve();
            }
            resolve(); // Resuelve la promesa y permite que monitorLoop continúe
        });
    });
}

function startCopyProcess() {
    if (isRunning) return;
    
    // Inicializar estado y variables
    isRunning = true;
    
    // Escribe el encabezado inicial del log
    const logHeader = `\n--- INICIO DE PROCESO DE COPIA MASIVA: ${new Date().toLocaleString()} ---\n`;
    fs.writeFileSync(LOG_FILE, logHeader, { flag: 'a' });
    
    console.log(`Proceso iniciado.`);
    monitorLoop(); 
}

// ------------------------------------------------------------------
// --- ENDPOINTS DE LA API (Comunicación con el HTML) ---
// ------------------------------------------------------------------

// ENDPOINT para iniciar la copia
app.post('/api/start', (req, res) => {
    if (isRunning) {
         return res.status(400).json({ success: false, message: "El proceso ya está corriendo." });
    }

    startCopyProcess(); // Llamar sin argumento
    res.json({ success: true, message: "Proceso de copia iniciado." });
});

// ENDPOINT para detener el proceso
app.post('/api/stop', (req, res) => {
    if (!isRunning) {
        return res.json({ success: true, message: "El proceso ya estaba detenido." });
    }
    isRunning = false;
    currentStatus = "Deteniendo... El proceso terminará después de la copia actual.";
    res.json({ success: true, message: "Comando de detención enviado." });
});

// ENDPOINT para obtener el estado actual
app.get('/api/status', (req, res) => {
    res.json({ 
        running: isRunning, 
        status: currentStatus,
        cdName: currentCDName 
    });
});

// Inicia el servidor
app.listen(port, () => {
    // Crea el directorio de destino al iniciar el servidor
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
        console.log(`Creado directorio de destino: ${TARGET_DIR}`);
    }
    console.log(`Servidor de copias iniciado en http://localhost:${port}`);
    console.log("Abre esta dirección en tu navegador.");
});