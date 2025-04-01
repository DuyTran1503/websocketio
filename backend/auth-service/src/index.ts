import express from 'express';
import mongoose from 'mongoose';
import { connect, Stan } from 'node-nats-streaming';
import authController from './controllers/auth.controller';

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/auth';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const NATS_CLUSTER_ID = process.env.NATS_CLUSTER_ID || 'test-cluster';
const NATS_CLIENT_ID = process.env.NATS_CLIENT_ID || 'auth-service-client';

// Middleware
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// NATS setup
let natsClient: Stan;

async function connectToNATS() {
  try {
    natsClient = connect(NATS_CLUSTER_ID, NATS_CLIENT_ID, { url: NATS_URL });
    
    natsClient.on('connect', () => {
      console.log('Connected to NATS Streaming');
      
      // Subscribe to auth requests
      const subscription = natsClient.subscribe('auth.request');
      
      subscription.on('message', async (msg) => {
        try {
          const request = JSON.parse(msg.getData() as string);
          const { method, path, body } = request;
          
          let result;
          
          // Route to appropriate controller method
          switch (`${method} ${path}`) {
            case 'POST /register':
              result = await authController.register(body);
              break;
            case 'POST /login':
              result = await authController.login(body);
              break;
            case 'GET /me':
              result = await authController.getProfile(body.userId);
              break;
            default:
              result = { status: 404, data: { error: 'Not found' } };
          }
          
          msg.respond(JSON.stringify(result));
        } catch (error) {
          console.error('Error processing auth request:', error);
          msg.respond(JSON.stringify({ 
            status: 500, 
            data: { error: 'Internal server error' } 
          }));
        }
      });
    });

    // Handle NATS errors
    natsClient.on('error', (err) => {
      console.error('NATS connection error:', err);
    });
    
    // Start the HTTP server (for direct access if needed)
    app.listen(PORT, () => {
      console.log(`Auth service listening on port ${PORT}`);
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
  mongoose.disconnect();
  process.exit(0);
});

connectToNATS();
