const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

async function start() {
  await connectDB();
  const server = app.listen(env.port, () => {
    console.log(`Clinic API running on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
