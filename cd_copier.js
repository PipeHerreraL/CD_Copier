// cd_copier.js

const { exec, execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');

// --- CONFIGURACIÓN ---
const DRIVE_A = 'I:';
const DRIVE_B = 'J:';
const TARGET_DIR = 'C:\\Archivos_Copia\\';
const LOG_FILE = 'C:\\Logs_Copia_CDs.txt';
// --------------------

let baseName = '';
let counter = 101;

// Configuración para la entrada de usuario
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Función principal para iniciar la aplicación y pedir el nombre base.
 */
function start() {
    rl.question("Escribe el nombre base para las carpetas (Ej: CD_ARCHIVE_): ", (inputName) => {
        baseName = inputName.trim();
        if (!baseName) {
            console.log("Nombre base no puede estar vacío. Reintentando...");
            return start();
        }
        
        // Crea el directorio de destino si no existe
        if (!fs.existsSync(TARGET_DIR)) {
            fs.mkdirSync(TARGET_DIR, { recursive: true });
        }

        // Escribe el encabezado del log
        const logHeader = `\n--- INICIO DE PROCESO DE COPIA MASIVA: ${new Date().toLocaleString()} ---\n`;
        fs.writeFileSync(LOG_FILE, logHeader, { flag: 'a' });

        console.log(`\nIniciando monitoreo de unidades... Presiona Ctrl+C para detener.`);
        // Inicia el bucle de monitoreo
        monitorLoop();
    });
}

/**
 * Función que revisa periódicamente las unidades.
 */
function monitorLoop() {
    console.log('\nBuscando discos...');
    
    // Ejecuta las verificaciones de manera secuencial
    checkAndCopy(DRIVE_A)
        .then(() => checkAndCopy(DRIVE_B))
        .then(() => {
            console.log('\nEsperando 5 segundos para nuevos discos.');
            setTimeout(monitorLoop, 5000); // Espera 5 segundos y llama a sí misma
        });
}

/**
 * Verifica si hay un disco cargado usando WMIC.
 * @param {string} drive - La letra de la unidad (Ej: "I:")
 * @returns {Promise<boolean>} - True si hay disco, False si no.
 */
function isMediaLoaded(drive) {
    // Usamos execSync para una verificación síncrona y rápida
    try {
        const result = execSync(`wmic cdrom ${drive} get MediaLoaded`, { stdio: 'pipe' }).toString();
        // Verifica si la salida de wmic contiene 'TRUE'
        return result.includes('TRUE');
    } catch (e) {
        // Ignora errores si la unidad no existe o no se puede acceder
        return false; 
    }
}

/**
 * Función principal de copia.
 * @param {string} currentDrive - La letra de la unidad a copiar.
 * @returns {Promise<void>}
 */
function checkAndCopy(currentDrive) {
    return new Promise(resolve => {
        if (!isMediaLoaded(currentDrive)) {
            return resolve(); // No hay disco, pasa al siguiente
        }

        const targetFolder = `${baseName}${counter}`;
        const targetPath = `${TARGET_DIR}${targetFolder}`;

        console.log(`\n📀 DISCO ENCONTRADO EN ${currentDrive} - Copiando a: ${targetPath}`);
        
        // 1. Asegura que la carpeta de destino exista
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath);
        }

        const logEntry = `--- Copiando Disco ${counter} de ${currentDrive} a ${targetPath} ---\n`;
        fs.writeFileSync(LOG_FILE, logEntry, { flag: 'a' });

        // 2. Inicia la copia con Robocopy
        // /E: Incluye subdirectorios | /R:3 /W:5: Reintenta 3 veces, esperando 5s
        const robocopyCommand = `robocopy ${currentDrive}\\ "${targetPath}" /E /R:3 /W:5 /TEE /LOG+:${LOG_FILE}`;
        
        // Ejecuta robocopy de forma asíncrona
        const child = exec(robocopyCommand);

        // Muestra la salida de robocopy en tiempo real (opcional)
        child.stdout.on('data', (data) => {
            process.stdout.write(`Robocopy: ${data}`);
        });

        child.on('close', (code) => {
            // Robocopy devuelve códigos de error donde 0-8 son éxitos (0-7 sin fallos graves)
            if (code <= 8) {
                console.log(`\n✅ COPIA FINALIZADA EN ${currentDrive}. Expulsando el disco...`);
                // 3. Expulsar la bandeja usando nircmd.exe
                try {
                    execSync(`nircmd.exe cdrom open ${currentDrive}`);
                    counter++;
                } catch (e) {
                    console.error("⚠️ ERROR: No se pudo expulsar el disco (NirCmd no encontrado o error).");
                }
            } else {
                console.error(`\n❌ ERROR DE COPIA GRAVE (código: ${code}) en ${currentDrive}. Revise el log. No se expulsa el disco.`);
            }
            resolve(); // Termina la promesa y pasa al siguiente chequeo
        });
    });
}

// Inicia el programa
start();