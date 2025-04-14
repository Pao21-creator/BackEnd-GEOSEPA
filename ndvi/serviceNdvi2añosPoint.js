const ee = require('@google/earthengine');


// Fechas de referencia específicas cada 8 días
const fechasReferencia = ['01/01', '17/01', '02/02', '18/02', '06/03', '22/03', '07/04', '23/04', '09/05', '25/05', '10/06', '26/06', '12/07', '28/07', '13/08', '29/08', '14/09', '30/09', '16/10', '01/11', '17/11', '03/12', '19/12'];

let valoresNdviPunto = [];
let fechaGrafico = [];

// Función para obtener la imagen más cercana para cada fecha
async function obtenerImagenValida(dataset, fecha, punto, año) {
  const [day, month] = fecha.split('/').map(Number);
  const currentDate = ee.Date.fromYMD(año, month, day);
  const nearestImage = dataset.filterDate(currentDate.advance(-15, 'days'), currentDate.advance(15, 'days')).first();

  if (nearestImage && nearestImage.bandNames().length().gt(0)) {
    const imagenMasCercana = nearestImage.clip(punto);
    const isValid = imagenMasCercana.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: punto,
      scale: 500,
      maxPixels: 1e8
    }).get('NDVI');

    return (isValid !== null && isValid !== undefined) ? imagenMasCercana : null;
  }
  return null;
}

// Función para obtener el valor de NDVI en el punto para cada imagen
async function obtenerValorNdviPunto(imagenMasCercana, punto) {
  const pointGeom = ee.Geometry.Point(punto[1], punto[0]);

  try {
    const ndviEnPunto = imagenMasCercana.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: pointGeom,
      scale: 500,
      maxPixels: 1e8
    }).get('NDVI');

    const ndviValue = await ndviEnPunto.getInfo();

    return (ndviValue !== null && ndviValue !== undefined) ? ndviValue * 0.01 : null;
  } catch (error) {
    console.error('Error al obtener NDVI en el punto:', error);
    return null;
  }
}

// Función principal para generar el gráfico y valores de NDVI para el punto
async function graficoNdviPunto(punto, año) {
  try {

    // Convertimos el punto en una geometría de Earth Engine
    const pointGeom = ee.Geometry.Point(punto[1], punto[0]);

    // Usamos imágenes de NOAA VIIRS para NDVI
    const dataset = ee.ImageCollection('MODIS/061/MOD13Q1')
      .select('NDVI')
      .filterBounds(pointGeom);  // Filtramos directamente por el punto

    // Limpiar arrays globales
    valoresNdviPunto = [];
    fechaGrafico = [];

    const promises = fechasReferencia.map(async (fecha) => {
      const imagenMasCercana = await obtenerImagenValida(dataset, fecha, pointGeom, año);

      if (imagenMasCercana) {
        if (!fechaGrafico.includes(fecha)) fechaGrafico.push(fecha);

        const valorNdvi = await obtenerValorNdviPunto(imagenMasCercana, punto);
        if (valorNdvi !== null) {
          valoresNdviPunto.push(valorNdvi);
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
      valoresNdviPunto,  // Valores de NDVI para cada fecha
    };

    // Limpiar arrays globales
    valoresNdviPunto = [];
    fechaGrafico = [];

    return result;

  } catch (error) {
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}

module.exports = { graficoNdviPunto };
