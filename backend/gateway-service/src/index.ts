import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import { connect, Stan } from 'node-nats-streaming';
import socketSetup from './websocket/socket';
import apiRoutes from './routes/api';

const app: Application = express();
const server = http.createServer(app);
const PORT: number = Number(process.env.PORT) || 3000;
const NATS_CLUSTER_ID = process.env.NATS_CLUSTER_ID || 'test-cluster';
const NATS_CLIENT_ID = `gateway-${Math.random().toString(36).substr(2, 9)}`;
const NATS_URL: string = process.env.NATS_URL || 'nats://localhost:4222';

// Middleware
app.use(cors());
app.use(express.json());

// NATS setup
let natsClient: Stan;

async function connectToNATS() {
  try {
    natsClient = connect(NATS_CLUSTER_ID, NATS_CLIENT_ID, { url: NATS_URL });

    natsClient.on('connect', () => {
      console.log('Connected to NATS Streaming');

      // Make NATS client available globally
      app.set('natsClient', natsClient);

      // Set up WebSocket after NATS connection
      socketSetup(server, natsClient);

      // API routes
      app.use('/api', apiRoutes);

      // Start the server
      server.listen(PORT, () => {
        console.log(`Gateway service listening on port ${PORT}`);
      });
    });

    natsClient.on('error', (err) => {
      console.error('NATS Connection Error:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('Error connecting to NATS:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (natsClient) {
    natsClient.close();
  }
  process.exit(0);
});

// Connect to NATS
connectToNATS();
