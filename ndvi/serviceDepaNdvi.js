const ee = require('@google/earthengine');


// Fechas de referencia específicas cada 16 días
var fechasReferencia = ['01/01', '17/01', '02/02', '18/02', '06/03', '22/03', '07/04', '23/04', 
'09/05', '25/05', '10/06', '26/06', '12/07', '28/07', '13/08', '29/08', 
'14/09', '30/09', '16/10', '01/11', '17/11', '03/12', '19/12'];



// Función para obtener la imagen más cercana para cada fecha
async function obtenerImagenValida(dataset, fecha, department, año) {
  var dayMonth = fecha.split('/');
  var day = ee.Number.parse(dayMonth[0]);
  var month = ee.Number.parse(dayMonth[1]);

  var currentDate = ee.Date.fromYMD(año, month, day);
  var nearestImage = dataset.filterDate(currentDate.advance(-15, 'days'), currentDate.advance(15, 'days')).first();

  if (nearestImage && nearestImage.bandNames().length().gt(0)) {
    var imagenMasCercana = nearestImage.clip(department);
  
    var isValid = imagenMasCercana.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: department,
      scale: 500,
      maxPixels: 1e8
    }).get('NDVI');

    if (isValid !== null && isValid !== undefined) {
      return imagenMasCercana;
    }
  }
  return null;
}



async function obtenerUrlsImagenes(indiceImagenes) {
  try {
    const customPalette = [
      '1F12D4', 'A903D6', 'F80100', 'C99811',
      'FFFE08', '7BF319', '0EE517', '2E9936',
    ];

    const ndviVis = {
      min: 0,
      max: 80,
      palette: customPalette,
      opacity: 1,
    };

    const urls = await Promise.all(
      indiceImagenes.map(async (img) => {
        const imagenVisualizada = img.multiply(0.01).visualize(ndviVis);
        const mapId = await imagenVisualizada.getMapId();
        return mapId.urlFormat;
      })
    );

    return urls;
  } catch (err) {
    console.error('Error al obtener URLs de imágenes:', err);
    throw err;
  }
}


async function obtenerUrlsImgClasificadas(depart, año) {
  try {
    const paletaClasificacion = [
      '#255d2a', // 1 - Superior al Máximo (verde oscuro)
      '#00ff00', // 2 - Superior al Promedio (verde claro)
      '#ffffff', // 3 - Igual al Promedio (blanco)
      '#f4a300', // 4 - Inferior al Promedio (naranja)
      '#b30000', // 5 - Inferior al Mínimo (rojo oscuro)
      '#bfbfbf'  // 6 - Sin dato (gris claro)
    ];

    const visClasificacion = {
      min: 1,
      max: 6,
      palette: paletaClasificacion
    };

    const stackClasificado = ee.Image('projects/geosepa/assets/AnomaliaNdvi/Anomalia' + año);

    const bandas = await stackClasificado.bandNames().getInfo();

    const imagenesClasificadas = bandas.map(nombreBanda =>
      stackClasificado.select(nombreBanda).clip(depart)
    );

    const urls = await Promise.all(
      imagenesClasificadas.map(async (img) => {
        const imagenVisualizada = img.visualize(visClasificacion);
        const mapId = await imagenVisualizada.getMapId();
        return mapId.urlFormat;
      })
    );

    return urls;
  } catch (err) {
    console.error('Error al obtener URLs de imágenes clasificadas:', err);
    throw err;
  }
}




// Función para obtener el valor de NDVI en el punto para cada imagen
async function obtenerValorNdviPunto(imagenMasCercana, punto) {


  const lat = punto[0];
  const lng = punto[1];

  const pointGeom = ee.Geometry.Point([lng, lat]);

  try {
 
    const ndviEnPunto = imagenMasCercana.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: pointGeom,
      scale: 250, 
      maxPixels: 1e8
    }).get('NDVI');

 
    const ndviValue = await ndviEnPunto.getInfo();


    if (ndviValue !== null && ndviValue !== undefined) {
      
      const ndviAjustado = ndviValue * 0.01;
      
      return ndviAjustado;
    } else {
      console.log('No se encontró un valor válido de NDVI en el punto:', punto);
      return 0;
    }
  } catch (error) {
    console.error('Error al obtener NDVI en el punto:', error);
  }
}



// ----------------------------------------------
// NUEVA función para procesamiento concurrente controlado
async function procesarFechasConLimite(dataset, fechas, departSeleccionado, año, punto, concurrencia = 6) {
  const resultados = [];
  let index = 0;

const indiceFecha = {};
fechas.forEach((f, i) => {
  indiceFecha[f] = i;
});

async function procesarLote() {
  while (index < fechas.length) {
    const fecha = fechas[index++];
    try {
      const imagenMasCercana = await obtenerImagenValida(dataset, fecha, departSeleccionado, año);
      if (imagenMasCercana !== null) {
        const valorNdvi = await obtenerValorNdviPunto(imagenMasCercana, punto);

        const bandaIndex = indiceFecha[fecha];
        if (bandaIndex === undefined) {
          console.warn(`Fecha ${fecha} no tiene índice de banda asociado.`);
          continue;
        }

        resultados.push({
          fecha,
          imagen: imagenMasCercana,
          valorNdvi
        });
      } else {
        console.log('Imagen descartada para la fecha:', fecha);
      }
    } catch (err) {
      console.error(`Error procesando fecha ${fecha}:`, err);
    }
  }
}

  const tareas = Array.from({ length: concurrencia }, () => procesarLote());
  await Promise.all(tareas);
  return resultados;
}

// ----------------------------------------------
async function graficoNdviDepa(provincia, localidad, año, punto) {
    var imagenesPorFecha = [];
    let fechaGrafico = [];
    let valoresNdviPunto = [];

  try {
 
    const departamentos = ee.FeatureCollection('projects/geosepa/assets/depart/departamentos');
    const departSeleccionado = departamentos.filter(ee.Filter.and(
      ee.Filter.eq('PROVINCIA', provincia),
      ee.Filter.eq('DEPTO', localidad)
    ));

    const dataset = ee.ImageCollection('MODIS/061/MOD13Q1')
      .select('NDVI')
      .filterBounds(departSeleccionado)
      .filter(ee.Filter.calendarRange(año, año, 'year'));

    // Procesamos con control de concurrencia
    const resultados = await procesarFechasConLimite(dataset, fechasReferencia, departSeleccionado, año, punto, 6);

    imagenesPorFecha = resultados.map(r => r.imagen);
    fechaGrafico = resultados.map(r => r.fecha);
    valoresNdviPunto = resultados.map(r => r.valorNdvi);

    //const result = await calcularPromedio(departSeleccionado);
    const urlsImagenesNDVI = await obtenerUrlsImagenes(imagenesPorFecha);

    let urlsClasificadas = [];
    try {
      urlsClasificadas = await obtenerUrlsImgClasificadas(departSeleccionado, año);
    } catch (error) {
      console.warn('No se pudo obtener imágenes clasificadas:', error);
      // Continúa el procesamiento sin las imágenes clasificadas
    }
    
     
    const outlineMapId = await ee.Image().paint({
        featureCollection: departSeleccionado,
        color: 1,
        width: 2,
    }).getMapId({
        palette: ['666666'],  
        min: 0,
        max: 1,
    });

  
    let outlineUrl = outlineMapId.urlFormat;


 
    
    return {
  urls: urlsImagenesNDVI,
  clasificacionUrls: urlsClasificadas,
  outlineUrl: outlineUrl,
        fechaGrafico: fechaGrafico,  
        valoresNdviPunto: valoresNdviPunto, 
}


  } catch (error) {
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}

module.exports = { graficoNdviDepa };
