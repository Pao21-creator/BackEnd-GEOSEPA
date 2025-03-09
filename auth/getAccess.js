const { JWT } = require('google-auth-library');
const privateKey = require('../private-key.json');
const ee = require('@google/earthengine');

// Configura el JWT con la clave privada
const authClient = new JWT({
  email: privateKey.client_email,  // Este es el correo de la cuenta de servicio
  key: privateKey.private_key,    // Esta es la clave privada
  scopes: ['https://www.googleapis.com/auth/earthengine.readonly'],  // Alcance necesario
});

// Función para autenticar y obtener el token
async function getAccessToken() {
  try {
    // Solicita un token de acceso
    const accessTokenResponse = await authClient.getAccessToken();
    const accessToken = accessTokenResponse.token;

    console.log("Token de acceso:", accessToken);
    // Aquí puedes usar el token para hacer solicitudes a la API de Earth Engine
    //await ee.initialize({ authToken: accessToken });
    //console.log("¡Conexión a Earth Engine exitosa!");

    return accessToken;
  } catch (error) {
    console.error('Error de autenticación:', error);
  }
}


module.exports = { getAccessToken };
