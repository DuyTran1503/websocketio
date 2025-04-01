import express, { Request, Response, NextFunction } from 'express';
import { Stan } from 'node-nats-streaming';

declare module 'express' {
  interface Application {
    get(name: 'natsClient'): Stan;
  }

  interface Request {
    user?: { id: string };
  }
}

const router = express.Router();

// Helper function to send requests via NATS
const forwardRequest = async (
  req: Request,
  res: Response,
  subject: string,
  pathPrefix: string
) => {
  try {
    const natsClient = req.app.get('natsClient');
    const response = await natsClient.request(
      subject,
      JSON.stringify({
        method: req.method,
        path: req.path.replace(pathPrefix, ''),
        body: req.body,
        query: req.query,
        params: req.params,
        userId: req.user ? req.user.id : null,
      }),
      5000 // Timeout in milliseconds
    );

    const result = JSON.parse(response.getData() as string);
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error(`Error forwarding request to ${subject}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Forward auth requests
router.all('/auth/*', (req: Request, res: Response) => {
  forwardRequest(req, res, 'auth.request', '/auth');
});

// Forward messages requests
router.all('/messages/*', (req: Request, res: Response) => {
  forwardRequest(req, res, 'message.request', '/messages');
});

export default router;