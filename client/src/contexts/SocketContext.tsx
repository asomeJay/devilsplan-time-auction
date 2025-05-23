import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // 서버 URL 동적 결정
    const getServerURL = () => {
      // 환경변수가 설정되어 있으면 우선 사용
      if (import.meta.env.VITE_SERVER_URL) {
        return import.meta.env.VITE_SERVER_URL;
      }
      
      // 현재 페이지의 hostname 사용 (IP로 접속했다면 그 IP 사용)
      const hostname = window.location.hostname;
      const serverPort = 3001;
      
      // localhost인 경우는 그대로 사용
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://localhost:${serverPort}`;
      }
      
      // IP 주소로 접속한 경우 해당 IP 사용
      return `http://${hostname}:${serverPort}`;
    };

    const serverURL = getServerURL();
    console.log('Connecting to server:', serverURL);
    
    const newSocket = io(serverURL, {
      transports: ['websocket', 'polling'], // 연결 방식 다양화
      timeout: 20000, // 타임아웃 증가
      forceNew: true
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};