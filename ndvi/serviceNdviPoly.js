const ee = require('@google/earthengine');
const { authenticate } = require('../auth/apiEngine');

// Fechas de referencia específicas cada 8 días
const fechasReferencia = ['01/01', '17/01', '02/02', '18/02', '06/03', '22/03', '07/04', '23/04', '09/05', '25/05', '10/06', '26/06', '12/07', '28/07', '13/08', '29/08', '14/09', '30/09', '16/10', '01/11', '17/11', '03/12'];

let valoresNdviPoligono = [];
let fechaGrafico = [];

// Función para obtener la imagen más cercana para cada fecha
async function obtenerImagenValida(dataset, fecha, poligono, año) {
  const [day, month] = fecha.split('/').map(Number);
  const currentDate = ee.Date.fromYMD(año, month, day);
  const nearestImage = dataset.filterDate(currentDate.advance(-15, 'days'), currentDate.advance(15, 'days')).first();

  if (nearestImage && nearestImage.bandNames().length().gt(0)) {
    const imagenMasCercana = nearestImage.clip(poligono);
    const isValid = imagenMasCercana.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: poligono,
      scale: 500,
      maxPixels: 1e8
    }).get('NDVI');

    return (isValid !== null && isValid !== undefined) ? imagenMasCercana : null;
  }
  return null;
}

// Función para obtener el valor de NDVI en el polígono para cada imagen
async function obtenerValorNdviPoligono(imagenMasCercana, poligono) {
  try {
    const ndviEnPoligono = imagenMasCercana.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: poligono,
      scale: 500,
      maxPixels: 1e8
    }).get('NDVI');



    const ndviValue = await ndviEnPoligono.getInfo();
    console.log(ndviValue)

    return (ndviValue !== null && ndviValue !== undefined) ? ndviValue * 0.01 : null;
  } catch (error) {
    console.error('Error al obtener NDVI en el polígono:', error);
    return null;
  }
}

// Función principal para generar el gráfico y valores de NDVI para el polígono
async function graficoNdviPoligono(poly, año) {
  try {
    // Llamamos a la función de autenticación
    await authenticate();

    console.log("coord son", poly);

    const poligono = ee.Geometry.Polygon(poly)
    // Usamos imágenes de NOAA VIIRS para NDVI
    const dataset = ee.ImageCollection('MODIS/061/MOD13Q1')
      .select('NDVI')
      .filterBounds(poligono);  // Filtramos directamente por el polígono

    // Limpiar arrays globales
    valoresNdviPoligono = [];
    fechaGrafico = [];

    const promises = fechasReferencia.map(async (fecha) => {
      const imagenMasCercana = await obtenerImagenValida(dataset, fecha, poligono, año);

      if (imagenMasCercana) {
        if (!fechaGrafico.includes(fecha)) fechaGrafico.push(fecha);

        const valorNdvi = await obtenerValorNdviPoligono(imagenMasCercana, poligono);
        if (valorNdvi !== null) {
          valoresNdviPoligono.push(valorNdvi);
        } else {
          console.log(`NDVI no válido para la fecha ${fecha}`);
        }
      } else {
        console.log('Imagen descartada para la fecha:', fecha);
      }
    });

    // Esperamos a que todas las promesas se resuelvan
    await Promise.all(promises);

    // Generamos el resultado
    const result = {
      fechaGrafico,  // Fechas correspondientes
      valoresNdviPoligono,  // Valores de NDVI para cada fecha
    };

    // Limpiar arrays globales
    valoresNdviPoligono = [];
    fechaGrafico = [];

    return result;

  } catch (error) {
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}

module.exports = { graficoNdviPoligono };
