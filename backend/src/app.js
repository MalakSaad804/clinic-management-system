const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const requestContext = require('./middleware/requestContext');
const { protect } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct client IPs
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'img-src': ["'self'", 'data:', 'blob:'] },
    },
  })
);
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use(requestContext);

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api', protect, require('./routes')); // everything else needs a valid token
app.use('/api', notFound);

// Production: serve the built React app from the same server (one Render service).
if (env.frontendDist && fs.existsSync(env.frontendDist)) {
  app.use(express.static(env.frontendDist));
  app.get('*', (_req, res) => res.sendFile(path.resolve(env.frontendDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
