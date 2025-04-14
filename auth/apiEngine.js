const ee = require('@google/earthengine');
const privateKey = require('../private-key.json');  // Asegúrate de que el archivo de la clave es correcto
require('dotenv').config();  // Cargar las variables de entorno

// Si necesitas deshabilitar la verificación de certificados SSL (solo en entornos controlados)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Función de autenticación utilizando la clave privada
async function authenticate() {
  return new Promise((resolve, reject) => {
    // Función para correr la lógica de Earth Engine después de la autenticación
    const runAnalysis = () => {
      console.log('Autenticación exitosa. Inicializando Earth Engine...');
      
      // Aquí puedes ejecutar tu análisis de Earth Engine
      ee.initialize(null, null, () => {
        console.log("¡Holis! Earth Engine inicializado.");
        // Aquí puedes agregar tu lógica de análisis o consultas.
        resolve();
      }, (e) => {
        console.error('Error en la inicialización de Earth Engine: ' + e);
        reject(e);
      });
    };
    
    // Autenticación con la cuenta de servicio usando la clave privada
    ee.data.authenticateViaPrivateKey(privateKey, runAnalysis, (e) => {
      console.error('Error de autenticación: ' + e);
      reject(e);
    });
  });
}

// Exporta la función para que pueda ser usada en otros módulos
module.exports = { authenticate };
