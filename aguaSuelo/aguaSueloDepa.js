const ee = require('@google/earthengine');

function clasificarPorRangos(image, breaks) {
  let classImage = ee.Image(0).updateMask(image.mask());  // solo donde hay datos válidos

  breaks.forEach((b, i) => {
    if (i < breaks.length - 1) {
      const lower = ee.Number(b);
      const upper = ee.Number(breaks[i + 1]);
      const clase = ee.Image.constant(i + 1);
      classImage = classImage.where(image.gte(lower).and(image.lt(upper)), clase);
    }
  });

  const lastClass = ee.Image.constant(breaks.length);
  classImage = classImage.where(image.gte(breaks[breaks.length - 1]), lastClass);

  return classImage.updateMask(image.mask()); // garantiza que se conserven solo los valores válidos
}




async function obtenerUrlsStacks(depart, año, mes) {
  try {
    const añoStr = año.toString().slice(-2);
    const mesStr = mes.toString().padStart(2, '0');
    const sufijo = `${añoStr}${mesStr}`;

    const nombresAmj = [`amj${sufijo}-1`, `amj${sufijo}-2`, `amj${sufijo}-3`];
    const nombresPj  = [`pj${sufijo}-1`,  `pj${sufijo}-2`,  `pj${sufijo}-3`];

    const breaksAlmacenaje = [0, 20, 40, 60, 80, 100, 130, 160, 190, 220, 250];
    const paletteAlmacenaje = [
      "#a10000", "#f61e22", "#f7611f", "#f0e31c", "#8ced4b",
      "#5fc448", "#43973b", "#0a742d", "#3c988f", "#2879ac", "#2f22cb"
    ];

    const breaksPorcentaje = [0,10,20,30,40,50,60,70,80,90,100];
    const palettePorcentaje = [
      "#ff0000", "#ffa500", "#ffd600", "#eff905", "#00ff00",
      "#4fc933", "#00ffff", "#3fe0d1", "#2ba3ef", "#0000ff"
    ];

    // Clasificar y visualizar
    const urlsAmj = await Promise.all(
      nombresAmj.map(async nombre => {
        const raw = ee.Image(`projects/geosepa/assets/AguaSuelo/${nombre}`).clip(depart);
        const clasificada = clasificarPorRangos(raw, breaksAlmacenaje);
        const visual = clasificada.visualize({
          min: 1,
          max: paletteAlmacenaje.length,
          palette: paletteAlmacenaje
        });
        const mapId = await visual.getMapId();
        return mapId.urlFormat;
      })
    );

    const urlsPj = await Promise.all(
      nombresPj.map(async nombre => {
        const raw = ee.Image(`projects/geosepa/assets/AguaSuelo/${nombre}`).clip(depart);
        const clasificada = clasificarPorRangos(raw, breaksPorcentaje);
        const visual = clasificada.visualize({
          min: 1,
          max: palettePorcentaje.length,
          palette: palettePorcentaje
        });
        const mapId = await visual.getMapId();
        return mapId.urlFormat;
      })
    );

    return { urlsAmj, urlsPj };

  } catch (err) {
    console.error('Error al obtener URLs de stacks clasificados:', err);
    throw err;
  }
}






async function graficoAguaSueloDepa(provincia, localidad, año, punto) {
  var imagenesPorFecha = [];
  let fechaGrafico = [];
  let valoresAguaPunto = [];

  try {
    const departamentos = ee.FeatureCollection('projects/geosepa/assets/depart/departamentos');
    const departSeleccionado = departamentos.filter(ee.Filter.and(
      ee.Filter.eq('PROVINCIA', provincia),
      ee.Filter.eq('DEPTO', localidad)
    ));

    // Mes hardcodeado por ahora (ejemplo: mayo)
    const { urlsAmj, urlsPj } = await obtenerUrlsStacks(departSeleccionado, año, '05');

    const outlineMapId = await ee.Image().paint({
      featureCollection: departSeleccionado,
      color: 1,
      width: 2,
    }).getMapId({
      palette: ['666666'],
      min: 0,
      max: 1,
    });

    const outlineUrl = outlineMapId.urlFormat;

    return {
      clasificacionUrlsAmj: urlsAmj,
      clasificacionUrlsPj: urlsPj,
      outlineUrl: outlineUrl
    };

  } catch (error) {
    throw new Error('Error en Earth Engine: ' + error.message);
  }
}

module.exports = { graficoAguaSueloDepa };
