const ee = require('@google/earthengine');
const { authenticate } = require('../auth/apiEngine');

// Fechas de referencia específicas cada 8 días
var fechasReferencia = ['01/01', '09/01', '17/01', '25/01', '02/02', '10/02', '18/02', '26/02', '06/03', '14/03', '22/03', '30/03', '07/04', '15/04', '23/04', '01/05', '09/05', '17/05', '25/05', '02/06', '10/06', '18/06', '26/06', '04/07', '12/07', '20/07', '28/07', '05/08', '13/08', '21/08', '29/08', '06/09', '14/09', '22/09', '30/09', '08/10', '16/10', '24/10', '01/11', '09/11', '17/11', '25/11', '03/12', '11/12', '19/12', '27/12'];

// Función común para calcular el promedio
async function calcularPromedio(cuenca, imagenesPorFecha, valoresDeNievePorFecha, fechaGrafico) {
  if (imagenesPorFecha.length === 0) {
    console.log('No se encontraron imágenes válidas para generar el promedio total.');
    return { error: 'No se encontraron imágenes válidas para generar el promedio' };
  }

  try {
    var imgPromedioTotal = ee.Image('projects/geosepa/assets/Promedio2001_2024');
    var imagenPromedioYear = ee.ImageCollection(imagenesPorFecha).mean();

    const snowCoverVis = {
      min: 0,
      max: 200,
      palette: ['#eff6f0', '#acdcec', '#68bcf8', '#3480fc', '#121bd1'],
    };

    var imagenConEstilo = imgPromedioTotal.select('b1').visualize(snowCoverVis);
    var mapUrlProm = await imagenConEstilo.getMapId().urlFormat;

    var mapIdYear = imagenPromedioYear.select(0).visualize(snowCoverVis);
    let mapUrlYear = await mapIdYear.getMapId().urlFormat;

    const outlineMapId = await ee.Image().paint({
      featureCollection: cuenca,
      color: 1,
      width: 2,
    }).getMapId({
      palette: ['666666'],
      min: 0,
      max: 1,
    });

    let outlineUrl = outlineMapId.urlFormat;

    return {
      urlYear: mapUrlYear,
      urlProm: mapUrlProm,
      outlineUrl: outlineUrl,
      valoresDeNievePorFecha: valoresDeNievePorFecha,
      fechaGrafico: fechaGrafico,
    };
  } catch (error) {
    console.error('Error al calcular el promedio de las imágenes:', error);
    throw new Error('Error al calcular el promedio');
  }
}

// Función que maneja la carga y procesamiento de las imágenes dependiendo del año
async function graficoAnualCuenca(Cuenca, año) {
  try {

    const cuenca = ee.FeatureCollection('projects/geosepa/assets/cuencas/' + `${Cuenca}`);
    var imgYear = ee.ImageCollection('MODIS/061/MOD10A2')
      .select('Maximum_Snow_Extent')
      .filterBounds(cuenca);

    const promises = [];
    var imagenesPorFecha = [];
    var valoresDeNievePorFecha = [];
    var fechaGrafico = [];

    // Determinar si el año es 2025 o no y usar el código adecuado
    if (año === 2025) {
      // Usamos el primer código si es el año 2025
      for (let fecha of fechasReferencia) {
        var dayMonth = fecha.split('/');
        var day = ee.Number.parse(dayMonth[0]);
        var month = ee.Number.parse(dayMonth[1]);
        var currentDate = ee.Date.fromYMD(año, month, day);

        var nearestImage = imgYear.filterDate(currentDate.advance(-7, 'days'), currentDate.advance(7, 'days')).first();

        promises.push(new Promise((resolve, reject) => {
          if (nearestImage && nearestImage.bandNames().length().gt(0)) {
            var imagenMasCercana = nearestImage.clip(cuenca);
            imagenMasCercana.reduceRegion({
              reducer: ee.Reducer.mean(),
              geometry: cuenca,
              scale: 500,
              maxPixels: 1e8
            }).evaluate(function(result) {
              if (result && result.hasOwnProperty('Maximum_Snow_Extent')) {
                const snowValue = result['Maximum_Snow_Extent'];
                if (snowValue != null && snowValue !== undefined) {
                  imagenesPorFecha.push(imagenMasCercana);
                  if (!valoresDeNievePorFecha.includes(snowValue)) {
                    valoresDeNievePorFecha.push(snowValue);
                    fechaGrafico.push(fecha);
                  }
                }
              }
              resolve();
            });
          } else {
            resolve();
          }
        }));
      }
    } else {
      // Usamos el segundo código para otros años
      for (let fecha of fechasReferencia) {
        var dayMonth = fecha.split('/');
        var day = ee.Number.parse(dayMonth[0]);
        var month = ee.Number.parse(dayMonth[1]);
        var currentDate = ee.Date.fromYMD(año, month, day);

        var nearestImage = imgYear.filterDate(currentDate.advance(-7, 'days'), currentDate.advance(7, 'days')).first();

        if (nearestImage && nearestImage.bandNames().length().gt(0)) {
          var imagenMasCercana = nearestImage.clip(cuenca);
          promises.push(new Promise((resolve, reject) => {
            imagenMasCercana.reduceRegion({
              reducer: ee.Reducer.mean(),
              geometry: cuenca,
              scale: 500,
              maxPixels: 1e8
            }).evaluate(function(result) {
              if (result && result.hasOwnProperty('Maximum_Snow_Extent')) {
                const snowValue = result['Maximum_Snow_Extent'];
                if (snowValue != null && snowValue !== undefined) {
                  imagenesPorFecha.push(imagenMasCercana);
                  if (!valoresDeNievePorFecha.includes(snowValue)) {
                    valoresDeNievePorFecha.push(snowValue);
                    fechaGrafico.push(fecha);
                  }
                }
              }
              resolve();
            });
          }));
        }
      }
    }

    // Esperamos a que todas las promesas se resuelvan antes de continuar
    await Promise.all(promises);

    // Después de que todas las promesas se resuelvan, calculamos el promedio
    const result = await calcularPromedio(cuenca, imagenesPorFecha, valoresDeNievePorFecha, fechaGrafico);
    return result;

  } catch (error) {
    console.error('Error en Earth Engine:', error);
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}

module.exports = { graficoAnualCuenca };
