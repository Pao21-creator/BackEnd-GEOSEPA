const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const NodeCache = require('node-cache');

const { authenticate } = require('./auth/apiEngine');
//const { PoligonEarthEngine } = require('./EngineServicePolygon');
//const { PointEarthEngine } = require('./EngineServicePoint');
const { graficoAguaSueloDepa } = require('./aguaSuelo/aguaSueloDepa');
const { graficoAnualCuenca } = require('./cuencas/serviceCuencaAnual');
const { graficoAnual2Años } = require('./cuencas/serviceCuanca2años');
const { graficoNdviDepa } = require('./ndvi/serviceDepaNdvi');
const { graficoNdviPunto } = require('./ndvi/serviceNdvi2añosPoint');
const { graficoNdviPoligono } = require('./ndvi/serviceNdviPoly');
const { PromedioNdviPoint, PromedioNdviPoly } = require('./ndvi/promedioNdvi');
const { verificarPoint } = require('./ndvi/verificarPoint');
const { graficoInuDepa } = require('./inundacion/serviceInuDepa');
const { extremosNieve } = require('./cuencas/Extremos');
const { sendContactEmail } = require('./contacto/mail');

const app = express();
const port = 3000;
const myCache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 });

let isAuthenticated = false;

async function authenticateOnce() {
  if (!isAuthenticated) {
    await authenticate(); 
    isAuthenticated = true;
  }
}

const allowedOrigins = ['http://localhost', 'http://localhost:5173'];

app.use(cors({
  origin: function(origin, callback) {
    // Permitir solicitudes sin origen (ejemplo: Postman o curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS no permitido para este origen'));
    }
  },
  credentials: true
}));


app.use(express.json());

const handleError = (res, error) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Error desconocido' });
};

const processRequestWithCache = async (req, res, callback, cacheKey) => {
  const cachedResult = myCache.get(cacheKey);
  if (cachedResult) {
    console.log('Respuesta desde caché');
    return res.json(cachedResult);
  }

  try {
    if (typeof callback !== 'function') {
      throw new Error('Callback proporcionado no es una función');
    }
    const result = await callback(req.body);
    myCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

// ======================== RUTAS ============================ //

//************ POINT **********************/
app.post('/verificar-ubicacion', async (req, res) => {
  const { point, provincia, localidad } = req.body;

    const cacheKey = `verificarPoint-${point}`;

    try{
    await processRequestWithCache(req, res, async () => {
      await authenticateOnce();
      const resultado = await verificarPoint(point, provincia, localidad);
      return resultado;
    }, cacheKey);
    } catch(error){
      console.error('Error en processRequestWithCache:', error);
      return res.status(500).json({ error: 'Error interno en el servidor' });
    }

});

//************ CUENCAS *****************/

// Gráfico anual por cuenca
app.post('/getMapIdCuenca', async (req, res) => {
  const { cuenca, año, funcion } = req.body;

  if (funcion === 'graficoAnual') {
    const cacheKey = `graficoAnualCuenca-${cuenca}-${año}`;

    try{
    await processRequestWithCache(req, res, async () => {
      await authenticateOnce();
      const resultado = await graficoAnualCuenca(cuenca, Number(año));
      return resultado;
    }, cacheKey);
    } catch(error){
      console.error('Error en processRequestWithCache:', error);
      return res.status(500).json({ error: 'Error interno en el servidor' });
    }
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});


// Gráfico anual por cuenca
app.post('/getExtremosCuenca', async (req, res) => {
  const { cuenca} = req.body;
  const cacheKey = `maxminCuenca-${cuenca}`;
    try{
    await processRequestWithCache(req, res, async () => {
      await authenticateOnce();
      const extremos = await extremosNieve(cuenca);
      return extremos;
    }, cacheKey);
    } catch(error){
      console.error('Error en processRequestWithCache:', error);
      return res.status(500).json({ error: 'Error interno en el servidor' });
    }

});

// Comparador por cuenca
app.post('/getCuencaYearComparador', async (req, res) => {
  const { cuenca, año, funcion } = req.body;

  if (funcion === 'graficoComparativo') {
    const cacheKey = `graficoComparativo-${cuenca}-${año}`;

    try {
      await processRequestWithCache(req, res, async () => {
        await authenticateOnce(); 
        const resultado = await graficoAnual2Años(cuenca, Number(año));
        return resultado;
      }, cacheKey);
    } catch (error) {
      console.error('Error en processRequestWithCache:', error);
      return res.status(500).json({ error: 'Error interno en el servidor' });
    }

  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

/* ************** INUNDACION ******************** */

// NDVI Departamental
app.post('/getMapIdInu', async (req, res) => {
  try {
    const { funcion, localidad, provincia, firstPeriodo, secondPeriodo } = req.body;

    if (!funcion || !localidad || !provincia || !firstPeriodo || !secondPeriodo) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }

    if (funcion === 'graficoAnual') {
      const cacheKey = `graficoInuDepa-${provincia}-${localidad}-${firstPeriodo}-${secondPeriodo}`;

      await processRequestWithCache(req, res, async () => {
        await authenticateOnce();
        const grafico = await graficoInuDepa(provincia, localidad, firstPeriodo, secondPeriodo);
        return { grafico };
      }, cacheKey);
    } else {
      res.status(400).json({ error: 'Función no válida' });
    }
  } catch (error) {
    console.error('Error general en la solicitud:', error);
    res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

//************ INDICES DE VEGETACION *****************/

// NDVI Departamental
app.post('/getMapIdNdvi', async (req, res) => {
  try {
    const { año, funcion, point, localidad, provincia } = req.body;

    if (!año || !funcion || !point || !localidad || !provincia) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }

    if (funcion === 'graficoAnual') {
      const cacheKey = `graficoNdviDepa-${provincia}-${localidad}-${año}-${point}`;

      await processRequestWithCache(req, res, async () => {
        await authenticateOnce();
        const grafico = await graficoNdviDepa(provincia, localidad, Number(año), point);
        const promedio = await PromedioNdviPoint(point);
        return { grafico, promedio };
      }, cacheKey);
    } else {
      res.status(400).json({ error: 'Función no válida' });
    }
  } catch (error) {
    console.error('Error general en la solicitud:', error);
    res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// Comparador NDVI por punto
app.post('/getNdviYearComparador', async (req, res) => {
  const { año, funcion, point } = req.body;

  if (funcion === 'graficoComparativo') {
    const cacheKey = `graficoNdviPunto-${funcion}-${point}-${año}`;

    try {
    await processRequestWithCache(req, res, async() => {
      await authenticateOnce();
      const resultado = await graficoNdviPunto(point, Number(año));
      return resultado;
    }, cacheKey);
  } catch (error){
      throw error;   
  }

  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

// NDVI por punto (una sola serie)
app.post('/getPointNdvi', async (req, res) => {
  const { año, funcion, point} = req.body;

  if (funcion === 'graficoAnual') {
    const cacheKey = `graficoNdviPunto-${funcion}-${point}-${año}`;
  try{
    await processRequestWithCache(req, res, async () => {
      await authenticateOnce();
      const grafico = await graficoNdviPunto(point, Number(año));
      const promedio = await PromedioNdviPoint(point);
      return { grafico, promedio };
    }, cacheKey);} catch(error){
        throw error; 
    }
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

// NDVI por polígono
app.post('/getPolyNdvi', async (req, res) => {
  const { año, funcion, polygon } = req.body;

  if (funcion === 'graficoAnual') {
    const cacheKey = `graficoNdviPoligno-${polygon}-${año}`;

    await processRequestWithCache(req, res, async () => {
      await authenticateOnce();
      const grafico = await graficoNdviPoligono(polygon, Number(año));
      const promedio = await PromedioNdviPoly(polygon);
      return { grafico, promedio };
    }, cacheKey);
  } else if (funcion === 'graficoAnual2') {
    const cacheKey = `graficoNdviPoligno-${polygon}-${año}`;

    await processRequestWithCache(req, res, async () => {
      const grafico = await graficoNdviPoligono(polygon, Number(año));
      return { grafico };
    }, cacheKey);
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

// Earth Engine - Polygon NDVI
app.post('/dataPolygonNdvi', (req, res) => {
  const cacheKey = `dataPolygonNdvi-${JSON.stringify(req.body)}`;
  processRequestWithCache(req, res, PoligonEarthEngine, cacheKey);
});

// Earth Engine - Point NDVI
app.post('/dataPointNDVI', (req, res) => {
  const cacheKey = `dataPointNDVI-${JSON.stringify(req.body)}`;
  processRequestWithCache(req, res, PointEarthEngine, cacheKey);
});


/********************************************************************************** */

// AGUA EN EL SUELO --> PRODUCTO DE LUCAS

// Agua Departamental
app.post('/getMapIdAguaSuelo', async (req, res) => {
  try {
    const { año, funcion, point, localidad, provincia } = req.body;

    if (!año || !funcion || !point || !localidad || !provincia) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }

    if (funcion === 'graficoAnual') {
      const cacheKey = `graficoAguaDepa-${provincia}-${localidad}-${año}-${point}`;

      await processRequestWithCache(req, res, async () => {
        await authenticateOnce();
        const grafico = await graficoAguaSueloDepa(provincia, localidad, Number(año), point);
        //const promedio = await PromedioNdviPoint(point);
        //return { grafico, promedio };
        return { grafico };
      }, cacheKey);
    } else {
      res.status(400).json({ error: 'Función no válida' });
    }
  } catch (error) {
    console.error('Error general en la solicitud:', error);
    res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

/**************************************************************************** */


// Ruta temporal de prueba de promedios por cuenca
app.get('/promedio', async (req, res) => {
  try {
    const result = await promAnualCuenca('barrancasygrande', '2001', '2002');
    console.log(result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});


app.post('/contact', async (req, res) => {
    const formData = req.body;

    if (!formData.name || !formData.email || !formData.requestType || !formData.message) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    try {
        const successMessage = await sendContactEmail(formData);
        res.status(200).json({ message: successMessage });
    } catch (error) {
        console.error('Error al enviar el correo:', error.message);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
});

// Estado del backend
app.get('/status', (req, res) => {
  res.status(200).send('Backend disponible');
});

// Ruta principal
app.get('/', (req, res) => {
  res.send('¡Servidor de Earth Engine está en funcionamiento!');
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
