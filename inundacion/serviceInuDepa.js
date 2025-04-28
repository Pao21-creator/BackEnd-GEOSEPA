const ee = require('@google/earthengine');

// Función para formatear la fecha en 'YYYY-MM-DD'
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Función para obtener el rango de fechas de una colección de imágenes
function dates(imgcol) {
  var range = imgcol.reduceColumns(ee.Reducer.minMax(), ["system:time_start"]);
  var minDate = ee.Date(range.get('min'));
  var maxDate = ee.Date(range.get('max'));
  var printed = ee.String('de ')
    .cat(minDate.format('YYYY-MM-dd'))
    .cat(' a ')
    .cat(maxDate.format('YYYY-MM-dd'));
  return printed;
}

async function graficoInuDepa(provincia, localidad, primerPeriodo, segundoPeriodo) {
  try {
    const departamentos = ee.FeatureCollection('projects/geosepa/assets/depart/departamentos');
    const departSeleccionado = departamentos.filter(ee.Filter.and(
      ee.Filter.eq('PROVINCIA', provincia),
      ee.Filter.eq('DEPTO', localidad)
    ));

    const before_start = formatDate(new Date(primerPeriodo[0])); 
    const before_end = formatDate(new Date(primerPeriodo[1]));  
    const after_start = formatDate(new Date(segundoPeriodo[0])); 
    const after_end = formatDate(new Date(segundoPeriodo[1]));   

    const polarization = "VH";
    const pass_direction = "DESCENDING";
    const difference_threshold = 1.25;

    // Crear la colección de imágenes
    const dataset = ee.ImageCollection('COPERNICUS/S1_GRD')
      .filter(ee.Filter.eq('instrumentMode', 'IW'))
      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', polarization))
      .filter(ee.Filter.eq('orbitProperties_pass', pass_direction))
      .filter(ee.Filter.eq('resolution_meters', 10))
      .filterBounds(departSeleccionado)
      .select(polarization);

    const before_collection = dataset.filterDate(before_start, before_end);
    const after_collection = dataset.filterDate(after_start, after_end);

    // Usar getInfo directamente (sin promesas)
    const beforeSize = before_collection.size().getInfo();
    const afterSize = after_collection.size().getInfo();

    const beforeDates = dates(before_collection);
    const afterDates = dates(after_collection);

    console.log(`Imágenes seleccionadas: Antes de la Inundación (${beforeSize})`);
    console.log(`Imágenes seleccionadas: Después de la Inundación (${afterSize})`);

    const before = before_collection.mosaic().clip(departSeleccionado);
    const after = after_collection.mosaic().clip(departSeleccionado);

    const smoothing_radius = 50;
    const before_filtered = before.focal_mean(smoothing_radius, 'circle', 'meters');
    const after_filtered = after.focal_mean(smoothing_radius, 'circle', 'meters');

    const difference = after_filtered.divide(before_filtered);
    const difference_binary = difference.gt(difference_threshold);

    const swater = ee.Image('JRC/GSW1_0/GlobalSurfaceWater').select('seasonality');
    const swater_mask = swater.gte(10).updateMask(swater.gte(10));

    const flooded_mask = difference_binary.where(swater_mask, 0);
    let flooded = flooded_mask.updateMask(flooded_mask);

    const connections = flooded.connectedPixelCount();
    flooded = flooded.updateMask(connections.gte(8));

    const DEM = ee.Image('WWF/HydroSHEDS/03VFDEM');
    const terrain = ee.Algorithms.Terrain(DEM);
    const slope = terrain.select('slope');
    flooded = flooded.updateMask(slope.lt(5));

    const flood_pixelarea = flooded.select(polarization).multiply(ee.Image.pixelArea());

    const flood_stats = flood_pixelarea.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: departSeleccionado,
      scale: 10,
      bestEffort: true,
    });

    const flood_area_ha = flood_stats.getInfo();

    const areaHectareas = flood_area_ha.VH / 10000;

    const formattedArea = new Intl.NumberFormat("es-AR", {
      style: "decimal",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(areaHectareas);

    console.log(`Área inundada estimada: ${formattedArea} hectáreas`);
    
   

    const floodedVis = flooded.visualize({ palette: ["0000FF"], min: 0, max: 1 });
    const floodedMapId = await floodedVis.getMapId();
    const mapUrlYear = floodedMapId.urlFormat;

    const geomOutline = departSeleccionado;
    const outlineMapId = await ee.Image().paint({
      featureCollection: geomOutline,
      color: 1,
      width: 2,
    }).getMapId({
      palette: ['#FF0000'],  // Rojo en formato hexadecimal
      min: 0,
      max: 1,
    });
    

    const outlineUrl = outlineMapId.urlFormat;

    return {
      urlYear: mapUrlYear,
      outlineUrl: outlineUrl,
      flood_area_ha: formattedArea,
    };

  } catch (error) {
    console.error('Error en Earth Engine:', error);
    throw error;
  }
}

module.exports = { graficoInuDepa };
