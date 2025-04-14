const fs = require('fs');
const path = require('path');

// Función para exportar como CSV
function exportarComoCSV(fechas, promedios) {
  const header = 'Fecha,PromedioNieve\n';  // Cabecera del CSV
  const rows = fechas.map((fecha, i) => `${fecha},${promedios[i]}`).join('\n');  // Formato de las filas
  const csvContent = header + rows;  // Concatenar la cabecera y las filas

  // Ruta donde se guardará el archivo CSV
  const filePath = path.join(__dirname, 'Promedio2001_2024', 'PromedioNieve2001_2024.csv');

  if (fs.existsSync(filePath)) {
    console.log('El archivo ya existe. No se creará el archivo nuevo.');
    return;  // Salir de la función si el archivo ya existe
  }

  // Crear el directorio si no existe
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  // Guardar el archivo CSV
  fs.writeFileSync(filePath, csvContent, 'utf8');
  console.log('Archivo CSV guardado en:', filePath);
}

module.exports = { exportarComoCSV };

