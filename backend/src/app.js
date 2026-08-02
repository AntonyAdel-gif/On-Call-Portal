// src/app.js
import express from 'express';
import cors from 'cors';
import publicViewRoutes from './routes/publicViewRoutes.js';
import staticInfoRoutes from './routes/staticInfoRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import teamsRoutes from './routes/teamsRoutes.js';
import applicationsRoutes from './routes/applicationsRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import swapRequestsRoutes from './routes/swapRequestsRoutes.js';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swaggerConfig.js';

const app = express();


app.use(cors({
  origin: 'http://localhost:5173', // your frontend's actual dev URL — adjust to match
}));


// Middleware
app.use(express.json());

// OpenAPI Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check route — confirms the server is alive, useful for testing before routes exist
app.get('/', (req, res) => {
  res.json({ message: 'On-Call Portal API is running' });
});

app.use('/api/public', publicViewRoutes);
app.use('/api/static-info', staticInfoRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/swap-requests', swapRequestsRoutes);

// Routes will be mounted here once you have resources, e.g.:
// import routes from './routes/index.js';
// app.use('/api', routes);

// 404 handler — catches any route that doesn't match
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Centralized error handler — catches errors passed via next(err)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

export default app;