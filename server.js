const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const NodeCache = require('node-cache');  // Importamos node-cache
const { PoligonEarthEngine } = require('./EngineServicePolygon');
const { graficoAnualCuenca } = require('./cuencas/serviceCuencaAnual');
const { PointEarthEngine } = require('./EngineServicePoint');
const { promAnualCuenca } = require('./cuencas/servicioProm');
const { graficoNdviProv } = require('./ndvi/serviceProvNdvi');
const { graficoAnual2Años } = require('./cuencas/serviceCuanca2años');
const { graficoNdviPunto } = require('./ndvi/serviceNdvi2añosPoint');
const { graficoNdviPoligono } = require('./ndvi/serviceNdviPoly');

const app = express();
const port = 3000;

// Crear una instancia del caché
const myCache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 });  // TTL de 1 hora (en segundos)

// Configurar CORS para permitir encabezados como Content-Type
app.use(cors({
  origin: 'https://frontend-mvx5.onrender.com',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware para procesar el cuerpo de las solicitudes como JSON
app.use(express.json());

// Función para manejar las respuestas de error
const handleError = (res, error) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Error desconocido' });
};

// Función para procesar solicitudes con caché
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


// Rutas para Earth Engine
app.post('/dataPolygonNdvi', (req, res) => {
  const cacheKey = `dataPolygonNdvi-${JSON.stringify(req.body)}`;  // Usamos el cuerpo de la solicitud como clave
  processRequestWithCache(req, res, PoligonEarthEngine, cacheKey);
});

app.post('/dataPointNDVI', (req, res) => {
  const cacheKey = `dataPointNDVI-${JSON.stringify(req.body)}`;
  processRequestWithCache(req, res, PointEarthEngine, cacheKey);
});

// Rutas para gráficos y análisis de cuencas
app.post('/getMapIdCuenca', async (req, res) => {
  const { cuenca, año, funcion } = req.body;
  if (funcion === 'graficoAnual') {
    const cacheKey = `graficoAnualCuenca-${cuenca}-${año}`;
    processRequestWithCache(req, res, () => graficoAnualCuenca(cuenca, Number(año)), cacheKey);
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

app.post('/getCuencaYearComparador', async (req, res) => {
  const { cuenca, año, funcion } = req.body;
  if (funcion === 'graficoComparativo') {
    const cacheKey = `graficoComparativo-${cuenca}-${año}`;
    processRequestWithCache(req, res, () => graficoAnual2Años(cuenca, Number(año)), cacheKey);
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

// Rutas para gráficos y análisis de NDVI
app.post('/getMapIdNdvi', async (req, res) => {
  const { año, funcion, point, prov } = req.body;
  if (funcion === 'graficoAnual') {
    const cacheKey = `graficoNdviProv-${prov}-${año}-${point}`;
    processRequestWithCache(req, res, () => graficoNdviProv(prov, Number(año), point), cacheKey);
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

app.post('/getNdviYearComparador', async (req, res) => {
  const { año, funcion, point, prov } = req.body;
  if (funcion === 'graficoComparativo') {
    const cacheKey = `graficoNdviPunto-${point}-${año}`;
    processRequestWithCache(req, res, () => graficoNdviPunto(point, Number(año)), cacheKey);
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

app.post('/getPointNdvi', async (req, res) => {
  const { año, funcion, point } = req.body;

  if (funcion === 'graficoAnual') {
    const cacheKey = `graficoNdviPunto-${point}-${año}`;
    processRequestWithCache(req, res, () => graficoNdviPunto(point, Number(año)), cacheKey);
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

app.post('/getPolyNdvi', async (req, res) => {
  const { año, funcion, polygon } = req.body;

  if (funcion === 'graficoAnual') {
    const cacheKey = `graficoNdviPoligno-${polygon}-${año}`;
    processRequestWithCache(req, res, () => graficoNdviPoligono(polygon, Number(año)), cacheKey);
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

// Ruta para obtener promedio
app.get('/promedio', async (req, res) => {
  try {
    const result = await promAnualCuenca('barrancasygrande', '2001', '2002');
    console.log(result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/status', (req, res) => {
  res.status(200).send('Backend disponible');
});


// Ruta principal para verificar el funcionamiento del backend
app.get('/', (req, res) => {
  res.send('¡Servidor de Earth Engine está en funcionamiento!');
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
