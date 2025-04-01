import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Stan } from 'node-nats-streaming';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export default function setupSocket(server: HttpServer, natsClient: Stan) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket: AuthenticatedSocket, next) => {
    if (socket.handshake.auth?.token) {
      try {
        const token = socket.handshake.auth.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key') as { id: string };
        socket.userId = decoded.id;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    } else {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId}`);

    if (!socket.userId) {
      socket.disconnect();
      return;
    }

    socket.join(socket.userId);

    const subscription = natsClient.subscribe('message.new');

    subscription.on('message', (msg) => {
      const data = JSON.parse(msg.getData() as string);

      if (data.recipientId === socket.userId || data.senderId === socket.userId) {
        io.to(socket?.userId!).emit('message', data);
      }
    });

    socket.on('send_message', async (data) => {
      if (!socket.userId) return;
      data.senderId = socket.userId;
      natsClient.publish('message.send', JSON.stringify(data));
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      subscription.unsubscribe();
    });
  });

  return io;
}
