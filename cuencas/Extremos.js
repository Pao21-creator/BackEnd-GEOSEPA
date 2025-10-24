const ee = require('@google/earthengine');

const fechasReferencia = ['01/01', '09/01', '17/01', '25/01', '02/02', '10/02', '18/02', '26/02', '06/03', '14/03', '22/03', '30/03', '07/04', '15/04', '23/04', '01/05', '09/05', '17/05', '25/05', '02/06', '10/06', '18/06', '26/06', '04/07', '12/07', '20/07', '28/07', '05/08', '13/08', '21/08', '29/08', '06/09', '14/09', '22/09', '30/09', '08/10', '16/10', '24/10', '01/11', '09/11', '17/11', '25/11', '03/12', '11/12', '19/12', '27/12'];

const snowCoverVis = {
  min: 0,
  max: 1,
  palette: ['ffffff', '1e90ff']
};

async function extremosNieve(NombreCuenca) {
    const Cuenca = ee.FeatureCollection('projects/geosepa/assets/cuencas/' + `${NombreCuenca}`);

const promises = fechasReferencia.map(async (fecha) => {
  try {
    const fechaSinSlash = fecha.replaceAll('/', '');
    const maxAssetId = `projects/geosepa/assets/extremosNieve/Snow_max_${fechaSinSlash}`;
    const minAssetId = `projects/geosepa/assets/extremosNieve/Snow_min_${fechaSinSlash}`;
    const maxSnow = ee.Image(maxAssetId);
    const minSnow = ee.Image(minAssetId);

    const [maxTotal, minTotal, maxMap, minMap] = await Promise.all([
      maxSnow.reduceRegion({ reducer: ee.Reducer.sum(), geometry: Cuenca.geometry(), scale: 500, maxPixels: 1e13 }).getInfo(),
      minSnow.reduceRegion({ reducer: ee.Reducer.sum(), geometry: Cuenca.geometry(), scale: 500, maxPixels: 1e13 }).getInfo(),
      maxSnow.visualize(snowCoverVis).getMapId(),
      minSnow.visualize(snowCoverVis).getMapId()
    ]);

    const anioMax = await maxSnow.get('anio').getInfo();
    const anioMin = await minSnow.get('anio').getInfo();


    return {
      fecha,
      max: {
        anio: anioMax,
        nieve: maxTotal['nieve'] || 0,
        url: maxMap.urlFormat
      },
      min: {
        anio: anioMin,
        nieve: minTotal['nieve'] || 0,
        url: minMap.urlFormat
      }
    };
  } catch (error) {
    console.warn(`Error procesando la fecha ${fecha}:`, error.message);
    return null;
  }
});

const resultados = (await Promise.all(promises)).filter(r => r !== null);

    return resultados;

}

module.exports = { extremosNieve };
