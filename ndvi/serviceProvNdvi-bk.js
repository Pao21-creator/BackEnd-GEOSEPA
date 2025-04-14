const ee = require('@google/earthengine');
const { authenticate } = require('../auth/apiEngine');

// Fechas de referencia específicas cada 16 días
var fechasReferencia = ['01/01', '17/01', '02/02', '18/02', '06/03', '22/03', '07/04', '23/04', 
'09/05', '25/05', '10/06', '26/06', '12/07', '28/07', '13/08', '29/08', 
'14/09', '30/09', '16/10', '01/11', '17/11', '03/12', '19/12'];

// Crear una lista para almacenar las imágenes de NDVI para cada fecha
var imagenesPorFecha = [];
let valoresNdviPunto = [];
var fechaGrafico = [];

// Función para obtener la imagen más cercana para cada fecha
async function obtenerImagenValida(dataset, fecha, prov, año) {
  var dayMonth = fecha.split('/');
  var day = ee.Number.parse(dayMonth[0]);
  var month = ee.Number.parse(dayMonth[1]);

  var currentDate = ee.Date.fromYMD(año, month, day);
  var nearestImage = dataset.filterDate(currentDate.advance(-15, 'days'), currentDate.advance(15, 'days')).first();

  if (nearestImage && nearestImage.bandNames().length().gt(0)) {
    var imagenMasCercana = nearestImage.clip(prov);

    var isValid = imagenMasCercana.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: prov,
      scale: 500,
      maxPixels: 1e8
    }).get('NDVI');

    if (isValid !== null && isValid !== undefined) {
      return imagenMasCercana;
    }
  }
  return null;
}



// Función para calcular el promedio de las imágenes de NDVI
async function calcularPromedio(prov) {

  try {
      // Comprobar que imagenesPorFecha tiene imágenes para procesar
      if (!imagenesPorFecha || imagenesPorFecha.length === 0) {
          throw new Error('No hay imágenes disponibles para calcular el promedio');
      }

      // Calcular el promedio general de las imágenes acumuladas
      // Ajustar los valores de NDVI multiplicando por 0.01
      var imagenPromedioYearAjustada = imagenesPorFecha[0].multiply(0.01);

      // Paleta personalizada para los rangos de valores de NDVI
      const customPalette = [
          '1F12D4',  
          'A903D6',  
          'F80100',  
          'C99811',  
          'FFFE08', 
          '7BF319',  
          '0EE517',  
          '2E9936',  
      ];

      // Visualización del promedio de NDVI ajustado con la paleta personalizada
      const ndviVis = {
          min: 0,   
          max: 80, 
          palette: customPalette,  // Usar la paleta personalizada
          opacity: 1
      };



      var imagenConEstilo = imagenPromedioYearAjustada.visualize(ndviVis);

      // Obtener el MapId de la imagen estilizada (esto crea una URL para la visualización en el mapa)
      var mapUrlYear = await imagenConEstilo.getMapId().urlFormat;

      // Crear el contorno de la geometría (prov) para mostrar la cuenca o área de interés
      const geomOutline = prov;

      // Obtener el contorno de la geometría de la cuenca
      const outlineMapId = await ee.Image().paint({
          featureCollection: geomOutline,
          color: 1,
          width: 2,
      }).getMapId({
          palette: ['666666'],  // Color gris para el contorno
          min: 0,
          max: 1,
      });

      // Obtener la URL del contorno
      let outlineUrl = outlineMapId.urlFormat;

      // Retornar los resultados con las URLs generadas y cualquier otra información relevante
      return {
          urlYear: mapUrlYear,
          outlineUrl: outlineUrl,
          fechaGrafico: fechaGrafico,  // Asumo que esta variable está definida en algún lugar
          valoresNdviPunto: valoresNdviPunto,  // Asumo que esta variable está definida y contiene datos
      };
  } catch (error) {
      console.error('Error al calcular el promedio de las imágenes:', error);
      throw new Error('Error al calcular el promedio');
  }
}

// Función para obtener el valor de NDVI en el punto para cada imagen
async function obtenerValorNdviPunto(imagenMasCercana, punto) {

  // Usar los índices del arreglo para obtener latitud y longitud
  const lat = punto[0];
  const lng = punto[1];
  
  // Crear la geometría del punto
  const pointGeom = ee.Geometry.Point([lng, lat]);

  try {
    // Extraer el valor de NDVI en el punto usando getInfo()
    const ndviEnPunto = imagenMasCercana.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: pointGeom,
      scale: 500,  // Resolución espacial de los datos VIIRS (500m)
      maxPixels: 1e8
    }).get('NDVI');

    // Usamos getInfo para obtener el valor directamente
    const ndviValue = await ndviEnPunto.getInfo();

    // Comprobar si el valor de NDVI es válido
    if (ndviValue !== null && ndviValue !== undefined) {
      // Almacenar el valor si es válido
      const ndviAjustado = ndviValue * 0.01;
      //valoresNdviPunto.push(ndviAjustado);
      return ndviAjustado;
    } else {
      console.log('No se encontró un valor válido de NDVI en el punto:', punto);
      return 0;
    }
  } catch (error) {
    console.error('Error al obtener NDVI en el punto:', error);
  }
}


// Función principal para generar el gráfico y valores de NDVI para la provincia
async function graficoNdviProv(provincia, año, punto) {
  try {
    // Llamamos a la función de autenticación
    await authenticate();

    const prov = ee.FeatureCollection('projects/geosepa/assets/provincias/' + `${provincia}`);

    // Usamos imágenes de NOAA VIIRS para NDVI
    var dataset = ee.ImageCollection('MODIS/061/MOD13Q1')
      .select('NDVI')  // Seleccionamos la banda NDVI
      .filterBounds(prov);

    valoresNdviPunto = [];  // Limpiar el array global
    fechaGrafico = [];      // Limpiar las fechas de gráfico
    imagenesPorFecha = [];


    const promises = [];  // Lista para almacenar las promesas
    const valoresNdviPuntoLocal = [];

    for (let fecha of fechasReferencia) {
      promises.push(
        (async () => {  // Utilizamos una IIFE (Immediately Invoked Function Expression) asincrónica
          const imagenMasCercana = await obtenerImagenValida(dataset, fecha, prov, año);
          if (imagenMasCercana !== null) {
            // Almacenamos la imagen de NDVI válida y la fecha
            if (!imagenesPorFecha.includes(imagenMasCercana)) imagenesPorFecha.push(imagenMasCercana);
            if (!fechaGrafico.includes(fecha)) fechaGrafico.push(fecha);

            // Obtener el valor de NDVI en el punto para cada imagen usando la nueva función
            const valorNdvi = await obtenerValorNdviPunto(imagenMasCercana, punto);
            valoresNdviPuntoLocal.push(valorNdvi);
          } else {
            console.log('Imagen descartada para la fecha:', fecha);
          }
        })()
      );
    }

    // Esperamos a que todas las promesas se resuelvan antes de continuar
    await Promise.all(promises);
    valoresNdviPunto = valoresNdviPuntoLocal;

    // Después de que todas las promesas se resuelvan, calculamos el promedio y el valor en el punto
    const result = await calcularPromedio(prov);

    valoresNdviPunto = [];
    fechaGrafico = [];
    imagenesPorFecha = []

    return result;

  } catch (error) {
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}

module.exports = { graficoNdviProv };
