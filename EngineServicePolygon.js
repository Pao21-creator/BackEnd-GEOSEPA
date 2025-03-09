const ee = require('@google/earthengine');
const { authenticate } = require('./auth/apiEngine');  // Asegúrate de que la autenticación esté correctamente implementada
const { poly } = require('googleapis/build/src/apis/poly');

async function PolyIndicadorGrafic(polygon, indicador, periodos){

  let resultPixelValue = {};

  for (const per of periodos) {
    var imagen = ee.Image(`projects/geosepa/assets/${indicador}${per}`); 

    // Extraer valores de píxeles dentro del polígono
     var pixelValues = imagen.reduceRegion({
reducer: ee.Reducer.mean(),
geometry: polygon,
scale: 30,  // Ajustar según la resolución de tu imagen
maxPixels: 1e6
});


// Espera a que los valores sean evaluados y procesados
const Result = await pixelValues.getInfo(); // Obtener valores de manera legible

    
    resultPixelValue[per] = Result;
  }
  

  return resultPixelValue;
}




// Función que hace la consulta a Google Earth Engine
async function PoligonEarthEngine(data) {
  try {
    // Asegurarse de que la autenticación esté completa antes de realizar la consulta
    await authenticate();

    var coordenadas = data.coord;
    var polygon = ee.Geometry.Polygon(coordenadas);
    const periodos = data.periodo;
    const años = ['2021'];
    const max = data.maximo;
    const min = data.minima;
    const med = data.media;

    //const nombreBandas = ['2021001', '2021017', '2021033', '2021049', '2021065'];
    let resultPixelValue = [];

    for (const año of años) {
      for (const per of periodos) {

    var imagen = ee.Image(`projects/geosepa/assets/ndvi${año}${per}`); 

          // Extraer valores de píxeles dentro del polígono
    var pixelValues = imagen.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: polygon,
      scale: 30,  // Ajustar según la resolución de tu imagen
      maxPixels: 1e6
    });

    const añi = ['2021'][0];
    // Espera a que los valores sean evaluados y procesados  
    const Result = await pixelValues.getInfo(); // Obtener valores de manera legible
    if(!resultPixelValue[añi]) resultPixelValue[añi] = {}; 
    if (per && Result) {  // Verifica que 'per' y 'Result' sean válidos
      resultPixelValue[añi][per] = Result;
  }
  
  }}


/*
    // valor por cada pixel
    var sample = imagen.sampleRegions({
      collection: ee.FeatureCollection([ee.Feature(polygon)]),
      properties: ['value'],
      scale: 30
    });

    const sampleResult = await new Promise((resolve, reject) => {
      sample.evaluate(resolve, reject); // Evaluar los resultados
    });*/

    // Retorna los resultados de la consulta

        // Agregar indicadores gráficos si es necesario
        if (max) {
          resultPixelValue['maximo'] = await PolyIndicadorGrafic(polygon, "max", periodos);
        }
    
        if (min) {
          resultPixelValue['minima'] = await PolyIndicadorGrafic(polygon, "min", periodos);
        }
    
        if (med) {
          resultPixelValue['media'] = await PolyIndicadorGrafic(polygon, "med", periodos);
        }
      

    return { resultPixelValue };

  } catch (error) {
    throw new Error(`Error al consultar Earth Engine: ${error.message}`);
  }
}

module.exports = { PoligonEarthEngine };