// src/server.js
import 'dotenv/config';
import app from './app.js';
import './jobs/rotationJob.js';

const PORT = process.env.PORT || 8003;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});