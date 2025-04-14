const ee = require('@google/earthengine');

// Calcula el max, min y media en un punto con los datos historicos de 2001-2024

async function PromedioNdviPoint(punto) {

  try {

      const point = ee.Geometry.Point(punto[1], punto[0]); // [lon, lat]
 
      const maximos = ee.Image('projects/geosepa/assets/NDVI/NDVI_max');
      const minimos = ee.Image('projects/geosepa/assets/NDVI/NDVI_min');
      const media = ee.Image('projects/geosepa/assets/NDVI/NDVI_med');

      
      const getBandValuesAtPoint = (image, geometry) => {
          return image.reduceRegion({
              reducer: ee.Reducer.first(),
              geometry: geometry,
              scale: 250, 
              maxPixels: 1e13
          });
      };


    const sortedValues = (values) => {
      const sortedKeys = Object.keys(values).sort((a, b) => {
        const numA = parseInt(a.replace('b', '')); 
        const numB = parseInt(b.replace('b', ''));
        return numA - numB; 
      });

      return sortedKeys.map(key => values[key]);
    };

      const maxVals = await getBandValuesAtPoint(maximos, point).getInfo();
      const minVals = await getBandValuesAtPoint(minimos, point).getInfo();
      const medVals = await getBandValuesAtPoint(media, point).getInfo();

      const max = sortedValues(maxVals);
      const min = sortedValues(minVals);
      const med = sortedValues(medVals);

      return {
          maximos: max,
          minimos: min,
          media: med
      };

  } catch (error) {
      console.error("Error al calcular el promedio NDVI:", error);
  }
}

/***************************************************************** */
// Calcula el max, min y media en un poligono con los datos historicos de 2001-2024

async function PromedioNdviPoly(poly, año) {
  
  try {

      const poligono = ee.Geometry.Polygon(poly)

      // Cargar las imágenes
      const maximos = ee.Image('projects/geosepa/assets/NDVI/NDVI_max');
      const minimos = ee.Image('projects/geosepa/assets/NDVI/NDVI_min');
      const media = ee.Image('projects/geosepa/assets/NDVI/NDVI_med');

     
      const getBandMeanValues = (image, geometry) => {
        return image.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: geometry,
          scale: 250, // Ajusta según la resolución de tus datos
          maxPixels: 1e13
        });
      };

      const sortedValues = (values) => {
        const sortedKeys = Object.keys(values).sort((a, b) => {
          const numA = parseInt(a.replace('b', '')); 
          const numB = parseInt(b.replace('b', ''));
          return numA - numB; 
        });
  
        return sortedKeys.map(key => values[key]);
      };

      const maxVals = await getBandMeanValues(maximos, poligono).getInfo();
      const minVals = await getBandMeanValues(minimos, poligono).getInfo();
      const medVals = await getBandMeanValues(media, poligono).getInfo();

      const max = sortedValues(maxVals);
      const min = sortedValues(minVals);
      const med = sortedValues(medVals);

      return {
          maximos: max,
          minimos: min,
          media: med
      };

  } catch (error) {
      console.error("Error al calcular el promedio NDVI:", error);
  }
}

  
  module.exports = { PromedioNdviPoint, PromedioNdviPoly };
  