const ee = require('@google/earthengine');
const { authenticate } = require('../auth/apiEngine');
const { exportarComoCSV } = require('../functions/exportCSV');

// Fechas de referencia específicas cada 8 días
var fechasReferencia = ['01/01', '09/01', '17/01', '25/01', '02/02', '10/02', '18/02', '26/02', '06/03', '14/03', '22/03', '30/03', '07/04', '15/04', '23/04', '01/05', '09/05', '17/05', '25/05', '02/06', '10/06', '18/06', '26/06', '04/07', '12/07', '20/07', '28/07', '05/08', '13/08', '21/08', '29/08', '06/09', '14/09', '22/09', '30/09', '08/10', '16/10', '24/10', '01/11', '09/11', '17/11', '25/11', '03/12', '11/12', '19/12', '27/12'];

// Crear una lista para almacenar las imágenes de nieve para cada fecha
var fechasPromedio = [];
var imagenPorFecha = [];


async function promAnualCuenca(Cuenca, añoInicio, añoFin) {
  try {
    await authenticate();

    // Cargar la geometría de la cuenca desde el asset
    const cuenca = ee.FeatureCollection('projects/geosepa/assets/' + `${Cuenca}`);

    var imgYear = ee.ImageCollection('MODIS/061/MOD10A2')
      .select('Maximum_Snow_Extent')  // Seleccionar la banda 'Maximum_Snow_Extent'
      .filterBounds(cuenca);  // Filtrar por la geometría de la cuenca

    const mediasPorFecha = {};  // Almacenar imágenes válidas por fecha
    const promises = [];  // Almacenar las promesas
    const promGrafico = [];

    // Función para procesar las fechas y almacenar las imágenes válidas
    const procesarFecha = async (fecha, year) => {
      var dayMonth = fecha.split('/');
      var day = ee.Number.parse(dayMonth[0]);
      var month = ee.Number.parse(dayMonth[1]);

      var currentDate = ee.Date.fromYMD(year, month, day);

      // Buscar las imágenes en un rango de ±7 días alrededor de la fecha de referencia
      var nearestImage = imgYear.filterDate(currentDate.advance(-7, 'days'), currentDate.advance(7, 'days')).first();

      if (!nearestImage || !nearestImage.bandNames().length().eq(0)) {
        console.warn(`No se encontró imagen para la fecha: ${currentDate.format('YYYY-MM-dd').getInfo()}`);
        return;  // No hay imagen, retorna sin hacer nada
      }

      // Recortamos la imagen usando la cuenca
      var imagenMasCercana = nearestImage.clip(cuenca);

      // Verificar si la imagen tiene datos válidos
      var isValid = imagenMasCercana.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: cuenca,
        scale: 500,  // Resolución espacial de los datos MODIS (500m)
        maxPixels: 1e8
      }).get('Maximum_Snow_Extent');

      const value = await new Promise((resolve, reject) => {
        isValid.evaluate(function(value) {
          resolve(value);
        });
      });

      if (value !== null && value !== undefined) {
        // Almacenamos la imagen válida
        if (!mediasPorFecha[fecha]) mediasPorFecha[fecha] = [];
        mediasPorFecha[fecha].push(imagenMasCercana);
      } else {
        console.log('Imagen descartada, sin datos válidos para la fecha:', fecha);
      }
    };

    // Iteramos sobre las fechas de referencia y años
    for (let fecha of fechasReferencia) {
      for (let year = 2001; year <= 2024; year++) {
        promises.push(procesarFecha(fecha, year));  // Agregar la promesa para cada fecha y año
      }
    }

    // Esperamos que todas las promesas se resuelvan
    await Promise.all(promises);

    // Crear el gráfico y exportar cuando los datos estén listos
    for (let fecha of fechasReferencia) {
      let mediasDeFecha = mediasPorFecha[fecha];

      if (mediasDeFecha && mediasDeFecha.length > 0) {
        // Crear una ImageCollection a partir de las imágenes de la fecha
        let imagenPromedio = ee.ImageCollection(mediasDeFecha).mean();

        // Agregar la imagen promedio a la lista de imágenes
        imagenPorFecha.push(imagenPromedio);

        // Agregar la fecha al listado de fechas si no está presente
        if (!fechasPromedio.includes(fecha)) fechasPromedio.push(fecha);

        // Calcular el promedio en la cuenca usando reduceRegion
        var promedioCuenca = imagenPromedio.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: cuenca,
          scale: 500,
          maxPixels: 1e8
        }).get('Maximum_Snow_Extent');

        const result = await new Promise((resolve, reject) => {
          promedioCuenca.evaluate(function(result) {
            resolve(result);
          });
        });

        // Asegúrate de que result contiene el valor esperado
        if (result !== null && result !== undefined) {
          promGrafico.push(result);  // Aquí añadimos el resultado del promedio a promGrafico
        } else {
          console.warn('No se pudo calcular el promedio para la cuenca.');
        }
      }
    }

    // Exportar los datos como CSV
    if (promGrafico.length > 0 && fechasPromedio.length > 0) {

      exportarComoCSV(fechasPromedio, promGrafico);

    } else {
      console.warn('No hay datos para exportar.');
    }


  } catch (error) {
    console.error('Error en el procesamiento de la cuenca:', error);
  }
}

module.exports = { promAnualCuenca };
