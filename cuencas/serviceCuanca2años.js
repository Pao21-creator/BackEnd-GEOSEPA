const ee = require('@google/earthengine');

var fechasReferencia = ['01/01', '09/01', '17/01', '25/01', '02/02', '10/02', '18/02', '26/02', '06/03', '14/03', '22/03', '30/03','07/04', '15/04', '23/04', '01/05', '09/05', '17/05', '25/05', '02/06', '10/06', '18/06', '26/06', '04/07','12/07', '20/07', '28/07', '05/08', '13/08', '21/08', '29/08', '06/09','14/09', '22/09', '30/09', '08/10', '16/10', '24/10', '01/11', '09/11', '17/11', '25/11', '03/12', '11/12', '19/12', '27/12'];

async function graficoAnual2Años(Cuenca, año) {
  try {

    const cuenca = ee.FeatureCollection('projects/geosepa/assets/cuencas/'+`${Cuenca}`);

    var imgYear = ee.ImageCollection('MODIS/061/MOD10A2')
      .select('Maximum_Snow_Extent')
      .filterBounds(cuenca);

    const promises = [];

    var valoresDeNievePorFecha = [];
    var fechaGrafico = [];

    for (let fecha of fechasReferencia) {
      var dayMonth = fecha.split('/');
      var day = ee.Number.parse(dayMonth[0]);
      var month = ee.Number.parse(dayMonth[1]);

      var currentDate = ee.Date.fromYMD(año, month, day);

      var nearestImage = imgYear.filterDate(currentDate.advance(-7, 'days'), currentDate.advance(7, 'days')).first();

      if (nearestImage && nearestImage.bandNames().length().gt(0)) {
         var imagen = nearestImage.clip(cuenca);
         var imagenMasCercana = imagen.eq(200);

        var isValid = imagenMasCercana.reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: cuenca,
          scale: 500,
          maxPixels: 1e8
        }).get('Maximum_Snow_Extent');

        promises.push(
          new Promise((resolve, reject) => {
            isValid.evaluate(function(value) {
              if (value !== null && value !== undefined) {
                if (!valoresDeNievePorFecha.includes(value)) {
                  valoresDeNievePorFecha.push(value);
                }
                if (!fechaGrafico.includes(fecha)) {
                  fechaGrafico.push(fecha);
                }
                resolve();
              } else {
                console.log('Imagen descartada, sin datos válidos para la fecha:', fecha);
                resolve();
              }
            });
          })
        );
      } else {
        console.log('No se encontró imagen para la fecha:', fecha);
      }
    }

    await Promise.all(promises);

    const result = {
      valoresDeNievePorFecha: valoresDeNievePorFecha,
      fechaGrafico: fechaGrafico
    };

    return result;

  } catch (error) {
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}

module.exports = { graficoAnual2Años };
