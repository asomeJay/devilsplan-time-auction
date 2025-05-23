import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocketHandlers } from './sockets/socketHandlers';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
        '*'
    ],
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: [
    '*'
  ]
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // 모든 네트워크 인터페이스에 바인딩

httpServer.listen(Number(PORT), HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  
  // 개발 환경에서 로컬 IP 주소 출력
  const os = require('os');
    const interfaces = os.networkInterfaces();
    console.log('\n접속 가능한 주소들:');
    console.log(`- http://localhost:${PORT}`);

    Object.keys(interfaces).forEach(name => {
        interfaces[name]?.forEach((iface: any) => {
        if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`- http://${iface.address}:${PORT}`);
        }
        });
    });
    console.log('');
});