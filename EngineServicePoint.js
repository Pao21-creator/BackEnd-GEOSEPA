const ee = require('@google/earthengine');
const { authenticate } = require('./auth/apiEngine');  

async function PointIndicadorGrafic(point, indicador, periodos){

  let resultPixelValue = {};

  for (const per of periodos) {
    var imagen = ee.Image(`projects/geosepa/assets/${indicador}${per}`);

    const pixelValue = imagen.sample({
      region: point,
      scale: 30, // Escala de la imagen
      numPixels: 1, // Tomar un solo pixel
    });

    const result = await new Promise((resolve, reject) => {
      pixelValue.evaluate((pixelData) => {
        if (pixelData.error) {
          reject(pixelData.error);
        } else {
          const properties = pixelData.features && pixelData.features.length > 0
          ? pixelData.features[0].properties.b1 
          : null;  
          resolve(properties); // Resolución con los valores de píxel
        }
      });
    });

    
    resultPixelValue[per] = result;
  }

  return resultPixelValue;
}

// Función que hace la consulta a Google Earth Engine
async function PointEarthEngine(data) {
  try {
    
    await authenticate();

    const point = ee.Geometry.Point([data.point.lng, data.point.lat]);
    const periodos = data.periodo;
    const años = data.año;
    const max = data.maximo;
    const min = data.minima;
    const med = data.media;

    let resultPixelValue = {};

    for (const año of años) {
      for (const per of periodos) {
        // Crear la imagen NDVI para el año y periodo
        const imagen = ee.Image(`projects/geosepa/assets/ndvi${año}${per}`);

        // Muestrear la imagen en el punto
        const pixelValue = imagen.sample({
          region: point,
          scale: 30,
          numPixels: 1
        });

        // Evaluar los resultados de la muestra
        const result = await new Promise((resolve, reject) => {
          pixelValue.evaluate((pixelData) => {
            if (pixelData.error) {
              reject(pixelData.error);
            } else {
              console.log(pixelData)
              const properties = pixelData.features && pixelData.features.length > 0
              ? pixelData.features[0].properties.b1
              : null;  
      
              resolve(properties); 
            }
          });
        });

        // Almacenar los resultados
        if(!resultPixelValue[año]) resultPixelValue[año] = {}; 
        resultPixelValue[año][per] = result;

      }
    }

    // Agregar indicadores gráficos si es necesario
    if (max) {
      resultPixelValue['maximo'] = await PointIndicadorGrafic(point, "max", periodos);
    }

    if (min) {
      resultPixelValue['minima'] = await PointIndicadorGrafic(point, "min", periodos);
    }

    if (med) {
      resultPixelValue['media'] = await PointIndicadorGrafic(point, "med", periodos);
    }

    // Retornar los resultados de la consulta
    return { resultPixelValue };
  } catch (error) {
    console.error(`Error al consultar Earth Engine: ${error.message}`);
    throw new Error(`Error al consultar Earth Engine: ${error.message}`);
  }
}

module.exports = { PointEarthEngine };
