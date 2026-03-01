import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketServer(httpServer, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('Client connected', socket.id);

    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });

    // Simple room logic for tables
    socket.on('join_table', (tableId) => {
      socket.join(`table_${tableId}`);
    });

    // KDS station rooms
    socket.on('join_kds', (station?: string) => {
      socket.join(station ? `kds_${station}` : 'kds_all');
    });

    // Pickup screen room
    socket.on('join_pickup', () => {
      socket.join('pickup');
    });
  });

  // Make io globally accessible across route handlers (hacky but works for POC)
  (global as any).io = io;

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
