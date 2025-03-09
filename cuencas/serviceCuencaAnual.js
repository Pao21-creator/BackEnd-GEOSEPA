const ee = require('@google/earthengine');
const { authenticate } = require('../auth/apiEngine');

// Fechas de referencia específicas cada 8 días
var fechasReferencia = ['01/01', '09/01', '17/01', '25/01', '02/02', '10/02', '18/02', '26/02', '06/03', '14/03', '22/03', '30/03','07/04', '15/04', '23/04', '01/05', '09/05', '17/05', '25/05', '02/06', '10/06', '18/06', '26/06', '04/07','12/07', '20/07', '28/07', '05/08', '13/08', '21/08', '29/08', '06/09','14/09', '22/09', '30/09', '08/10', '16/10', '24/10', '01/11', '09/11', '17/11', '25/11', '03/12', '11/12', '19/12', '27/12'];


// Crear una lista para almacenar las imágenes de nieve para cada fecha
var imagenesPorFecha = [];
var valoresDeNievePorFecha = [];  // Lista para almacenar los promedios de nieve por fecha
var fechaGrafico = [];

async function calcularPromedio(cuenca) {
  // Verificamos si tenemos imágenes para procesar antes de calcular el promedio general
  if (imagenesPorFecha.length > 0) {
    try {
      var imgPromedioTotal = ee.Image('projects/geosepa/assets/Promedio2001_2024');
      // Calcular el promedio general de las imágenes acumuladas
      var imagenPromedioYear = ee.ImageCollection(imagenesPorFecha).mean();

      const snowCoverVis = {
        min: 0,
        max: 200,
        palette: [
          '#eff6f0',  // Blanco
          '#acdcec',  // Azul muy claro
          '#68bcf8',  // Azul claro
          '#3480fc',  // Azul intermedio
          '#121bd1'   // Azul
        ],
      };

      // obtener el MapId para el promedio 2001-2024
      
      var imagenConEstilo = imgPromedioTotal.select('b1').visualize(snowCoverVis);
      var mapUrlProm = await imagenConEstilo.getMapId().urlFormat;

      
   
 
      var mapIdYear = imagenPromedioYear.select(0).visualize(snowCoverVis);
      let mapUrlYear = await mapIdYear.getMapId().urlFormat;

      // Crear el contorno de la geometría
      const geomOutline = cuenca;

      // Obtener el contorno de la geometría de la cuenca
      const outlineMapId = await ee.Image().paint({
        featureCollection: geomOutline,
        color: 1,   // Color del contorno (1 para visible)
        width: 2,   // Grosor del contorno
      }).getMapId({
        palette: ['666666'],  // Color negro para el contorno
        min: 0,
        max: 1,
      });

      // Obtener la URL del contorno
      let outlineUrl = outlineMapId.urlFormat;

      return {
        urlYear: mapUrlYear,
        urlProm: mapUrlProm,
        outlineUrl: outlineUrl,
        valoresDeNievePorFecha: valoresDeNievePorFecha,  // Array con los valores de nieve
        fechaGrafico: fechaGrafico  // Array con las fechas para graficar
      };
    } catch (error) {
      console.error('Error al calcular el promedio de las imágenes:', error);
      throw new Error('Error al calcular el promedio');
    }
  } else {
    console.log('No se encontraron imágenes válidas para generar el promedio total.');
    return { error: 'No se encontraron imágenes válidas para generar el promedio' };
  }
}


async function graficoAnualCuenca(Cuenca, año) {
  try {
    // Llamamos a la función de autenticación
    await authenticate();

    const cuenca = ee.FeatureCollection('projects/geosepa/assets/'+`${Cuenca}`);

    var imgYear = ee.ImageCollection('MODIS/061/MOD10A2')
      .select('Maximum_Snow_Extent')  // Seleccionar la banda 'Maximum_Snow_Extent'
      .filterBounds(cuenca);  // Filtrar por la geometría de la cuenca

    const promises = [];  // Lista para almacenar las promesas

    // Usamos un bucle `for...of` para recorrer todas las fechas
    for (let fecha of fechasReferencia) {
      // Desglosamos la fecha de referencia en día y mes
      var dayMonth = fecha.split('/');
      var day = ee.Number.parse(dayMonth[0]);
      var month = ee.Number.parse(dayMonth[1]);

      // Generar la fecha correspondiente para el año proporcionado
      var currentDate = ee.Date.fromYMD(año, month, day);

      // Buscar las imágenes en un rango de ±7 días alrededor de la fecha de referencia
      var nearestImage = imgYear.filterDate(currentDate.advance(-7, 'days'), currentDate.advance(7, 'days')).first();

      // Verificar si la imagen es válida
      if (nearestImage && nearestImage.bandNames().length().gt(0)) {
        // Seleccionar la primera imagen más cercana a la fecha de referencia
        var imagenMasCercana = nearestImage.clip(cuenca);

        // Verificar si la imagen tiene datos válidos (de no ser así, la descartamos)
        var isValid = imagenMasCercana.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: cuenca,
          scale: 500,  // Resolución espacial de los datos MODIS (500m)
          maxPixels: 1e8
        }).get('Maximum_Snow_Extent');

        // Usar `Promise` para manejar el cálculo asincrónico
        promises.push(
          new Promise((resolve, reject) => {
            isValid.evaluate(function(value) {
              if (value !== null && value !== undefined) {
                // Almacenamos la imagen válida y su valor promedio
               imagenesPorFecha.push(imagenMasCercana);
               if(!valoresDeNievePorFecha.includes(value))valoresDeNievePorFecha.push(value);
                if(!fechaGrafico.includes(fecha))fechaGrafico.push(fecha);
                resolve();  // Resolver la promesa una vez que se procesó la imagen
              } else {
                console.log('Imagen descartada, sin datos válidos para la fecha:', fecha);
                resolve();  // Resolver incluso si la imagen es inválida (para no bloquear el ciclo)
              }
            });
          })
        );
      } else {
        console.log('No se encontró imagen para la fecha:', fecha);
      }
    }

    // Esperamos a que todas las promesas se resuelvan antes de continuar
    await Promise.all(promises);

    // Después de que todas las promesas se resuelvan, calculamos el promedio
    const result = await calcularPromedio(cuenca);
    return result;

  } catch (error) {
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}


module.exports = { graficoAnualCuenca };
