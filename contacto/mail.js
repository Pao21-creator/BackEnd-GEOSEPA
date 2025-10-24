const Mailjet = require('node-mailjet'); // Librería de Mailjet

// --- Configuración de Mailjet ---
// Asegúrate de que MAILJET_API_KEY y MAILJET_API_SECRET estén en tu archivo .env
const mailjet = Mailjet.apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_API_SECRET
);

/**
 * Manejador de ruta para el envío de correos electrónicos.
 * Extraído para mejorar la modularidad y la legibilidad.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
async function sendContactEmail({ name, email, requestType, message }) {
    // Validación básica (esto se hace mejor en la ruta, pero lo dejo por si acaso)
    if (!name || !email || !requestType || !message) {
        throw new Error('Todos los campos son obligatorios.');
    }

    const mailjetMsg = {
        Messages: [
            {
                From: {
                    Email: process.env.MAILJET_SENDER_EMAIL,
                    Name: "Formulario de Contacto"
                },
                To: [
                    {
                        Email: process.env.RECIPIENT_EMAIL,
                        Name: "Destinatario Contacto"
                    }
                ],
                Subject: `Nueva Consulta de Contacto: ${requestType}`,
                HTMLPart: `
                    <p><strong>Nombre:</strong> ${name}</p>
                    <p><strong>Email del remitente:</strong> ${email}</p>
                    <p><strong>Tipo de Consulta:</strong> ${requestType}</p>
                    <p><strong>Mensaje:</strong></p>
                    <p>${message}</p>
                    <hr>
                    <p>Este mensaje fue enviado desde el formulario de contacto de tu sitio web.</p>
                `,
                ReplyTo: {
                    Email: email,
                    Name: name
                }
            }
        ]
    };

    // Envío real
    await mailjet.post('send', { version: 'v3.1' }).request(mailjetMsg);

    return 'Mensaje enviado con éxito. Agradecemos su comunicación.';
}

module.exports = { sendContactEmail };


