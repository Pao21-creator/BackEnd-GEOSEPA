const ee = require('@google/earthengine');

async function verificarPoint(punto, provincia, localidad) {
  try {
    const pointGeom = ee.Geometry.Point(punto[0], punto[1]); // [lng, lat]
    const departamentos = ee.FeatureCollection('projects/geosepa/assets/depart/departamentos');

    const departSeleccionado = departamentos.filter(ee.Filter.and(
      ee.Filter.eq('PROVINCIA', provincia),
      ee.Filter.eq('DEPTO', localidad)
    ));

    const count = await departSeleccionado.size().getInfo();
    if (count === 0) {
      throw new Error(`No se encontró el departamento: ${localidad}, provincia: ${provincia}`);
    }

    const geometry = departSeleccionado.geometry();

    // Verificar si el punto está contenido dentro de la geometría
    const estaDentro = await geometry.contains(pointGeom, ee.ErrorMargin(1)).getInfo();

    return estaDentro;

  } catch (error) {
    console.error('Error en verificarPoint:', error);
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}

module.exports = { verificarPoint };

  