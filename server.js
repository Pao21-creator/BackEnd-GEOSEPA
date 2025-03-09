const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
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

// Configurar CORS para permitir encabezados como Content-Type
app.use(cors({
  origin: 'http://localhost:5173',
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

// Función centralizada para procesar solicitudes
const processRequest = async (req, res, callback) => {
  try {
    const result = await callback(req.body);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

// Rutas para Earth Engine
app.post('/dataPolygonNdvi', (req, res) => {
  processRequest(req, res, PoligonEarthEngine);
});

app.post('/dataPointNDVI', (req, res) => {
  processRequest(req, res, PointEarthEngine);
});

// Rutas para gráficos y análisis de cuencas
app.post('/getMapIdCuenca', async (req, res) => {
  const { cuenca, año, funcion } = req.body;
  if (funcion === 'graficoAnual') {
    processRequest(req, res, () => graficoAnualCuenca(cuenca, Number(año)));
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

app.post('/getCuencaYearComparador', async (req, res) => {
  const { cuenca, año, funcion } = req.body;
  switch (funcion) {
    case 'graficoComparativo':
      processRequest(req, res, () => graficoAnual2Años(cuenca, Number(año)));
      break;
    default:
      res.status(400).json({ error: 'Función no válida' });
  }
});

// Rutas para gráficos y análisis de NDVI
app.post('/getMapIdNdvi', async (req, res) => {
  const { año, funcion, point, prov } = req.body;
  if (funcion === 'graficoAnual') {
    processRequest(req, res, () => graficoNdviProv(prov, Number(año), point));
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

app.post('/getNdviYearComparador', async (req, res) => {
  const { año, funcion, point, prov } = req.body;
  console.log("provincia es",prov)
  if (funcion === 'graficoComparativo') {
    processRequest(req, res, () => graficoNdviPunto(point, Number(año)));
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});


app.post('/getPointNdvi', async (req, res) => {
  const { año, funcion, point } = req.body;

  if (funcion === 'graficoAnual') {
    processRequest(req, res, () => graficoNdviPunto(point, Number(año)));
  } else {
    res.status(400).json({ error: 'Función no válida' });
  }
});

app.post('/getPolyNdvi', async (req, res) => {
  const { año, funcion, polygon } = req.body;

  if (funcion === 'graficoAnual') {
    processRequest(req, res, () => graficoNdviPoligono(polygon, Number(año)));
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

// Ruta principal para verificar el funcionamiento del backend
app.get('/', (req, res) => {
  res.send('¡Servidor de Earth Engine está en funcionamiento!');
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
