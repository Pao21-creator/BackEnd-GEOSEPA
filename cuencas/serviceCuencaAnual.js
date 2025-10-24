const ee = require('@google/earthengine');
const { authenticate } = require('../auth/apiEngine');

// Fechas de referencia específicas cada 8 días
var fechasReferencia = ['01/01', '09/01', '17/01', '25/01', '02/02', '10/02', '18/02', '26/02', '06/03', '14/03', '22/03', '30/03', '07/04', '15/04', '23/04', '01/05', '09/05', '17/05', '25/05', '02/06', '10/06', '18/06', '26/06', '04/07', '12/07', '20/07', '28/07', '05/08', '13/08', '21/08', '29/08', '06/09', '14/09', '22/09', '30/09', '08/10', '16/10', '24/10', '01/11', '09/11', '17/11', '25/11', '03/12', '11/12', '19/12', '27/12'];


async function obtenerUrlsImagenes(imagenesConFecha) {
  try {
      const snowCoverVis = {
          min: 0,
          max: 1,
          palette: ['ffffff', '1e90ff'],
      };

      const urls = await Promise.all(
          imagenesConFecha.map(async (item) => {
              if (item === null || item.image === null) {
                  return null;
              }
              const imagenVisualizada = item.image.visualize(snowCoverVis);
              const mapId = await imagenVisualizada.getMapId();
              return {
                  url: mapId.urlFormat,
                  fecha: item.date
              };
          })
      );

      return {
          urlsYear: urls
      };
  } catch (err) {
      console.error('Error al obtener URLs de imágenes:', err);
      throw err;
  }
}

function getNearestImage(año, imagesInWindow, currentDate) {
    if (año === 2025) {
        return imagesInWindow.first();
    } else {
        var withDiff = imagesInWindow.map(function(image) {
            var diff = image.date().difference(currentDate, 'day').abs();
            return image.set('diff', diff);
        });
        return withDiff.sort('diff').first();
    }
}


async function graficoAnualCuenca(Cuenca, año) {
  try {
      const cuenca = ee.FeatureCollection('projects/geosepa/assets/cuencas/' + `${Cuenca}`);
      var imgYear = ee.ImageCollection('MODIS/061/MOD10A2')
          .select('Maximum_Snow_Extent')
          .filterBounds(cuenca);

      const resultsPromises = [];
      const imagenesPorFecha = [];
      const valoresDeNievePorFecha = [];
      const fechaGrafico = [];
      const idsUnicos = new Set();

      for (let fecha of fechasReferencia) {
          var dayMonth = fecha.split('/');
          var day = ee.Number.parse(dayMonth[0]);
          var month = ee.Number.parse(dayMonth[1]);
          var currentDate = ee.Date.fromYMD(año, month, day);

          var imagesInWindow = imgYear.filterDate(currentDate.advance(-7, 'days'), currentDate.advance(7, 'days'));

          resultsPromises.push(new Promise((resolve) => {

             var nearestImage = getNearestImage(año, imagesInWindow, currentDate);

              if (nearestImage && nearestImage.bandNames().length().gt(0)) {
                  nearestImage.id().evaluate(function(imagenId) {
                      if (imagenId && !idsUnicos.has(imagenId)) {
                          idsUnicos.add(imagenId);

                          var imagen = nearestImage.clip(cuenca);
                          var imagenMasCercana = imagen.eq(200);

                          imagenMasCercana.reduceRegion({
                              reducer: ee.Reducer.sum(),
                              geometry: cuenca,
                              scale: 500,
                              maxPixels: 1e8
                          }).evaluate(function(result) {
                              const snowValue = result?.Maximum_Snow_Extent ?? NaN;
                              resolve({
                                  image: imagenMasCercana,
                                  value: snowValue,
                                  date: fecha
                              });
                          });
                      } else {
                          resolve({
                              image: null,
                              value: NaN,
                              date: fecha
                          });
                      }
                  });
              } else {
                  resolve({
                      image: null,
                      value: NaN,
                      date: fecha
                  });
              }
          }));
      }

      const resolvedData = await Promise.all(resultsPromises);

      resolvedData.forEach((item) => {
          imagenesPorFecha.push(item.image ?? null);
          valoresDeNievePorFecha.push(item.value ?? NaN);
          fechaGrafico.push(item.date ?? null);
      });

      const urlsImagenes = await obtenerUrlsImagenes(resolvedData); // ahora recibe objetos con { image, date }

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
          urls: urlsImagenes, // urls.urlsYear: [{ url, fecha }]
          outlineUrl: outlineUrl,
          valoresDeNievePorFecha: valoresDeNievePorFecha,
          fechaGrafico: fechaGrafico
      };

  } catch (error) {
      console.error('Error en Earth Engine:', error);
      throw new Error('Error en Earth Engine: ' + error.message);
  }
}


module.exports = { graficoAnualCuenca };