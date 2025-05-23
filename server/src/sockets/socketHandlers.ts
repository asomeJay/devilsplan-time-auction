import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/RoomService';
import { GameService } from '../services/GameService';
import { TimerService } from '../services/TimerService';

export function setupSocketHandlers(io: Server) {
  const roomService = new RoomService();
  const gameService = new GameService();
  const timerService = new TimerService();

  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // 룸 생성
    socket.on('room:create', (playerName: string, role: 'player' | 'display') => {
      const room = roomService.createRoom(socket.id, playerName, role);
      socket.join(room.code);
      socket.emit('room:created', room);
    });

    // 룸 참가
    socket.on('room:join', (roomCode: string, playerName: string, role: 'player' | 'display') => {
      const room = roomService.joinRoom(roomCode, socket.id, playerName, role);
      if (room) {
        socket.join(roomCode);
        socket.emit('room:joined', room);
        io.to(roomCode).emit('room:updated', room);
      } else {
        socket.emit('error', '룸을 찾을 수 없습니다');
      }
    });

    // 게임 설정 업데이트
    socket.on('game:updateSettings', (roomCode: string, settings: any) => {
      const room = roomService.updateSettings(roomCode, settings);
      if (room) {
        io.to(roomCode).emit('room:updated', room);
      }
    });

    // 게임 시작
    socket.on('game:start', (roomCode: string) => {
      const room = roomService.getRoom(roomCode);
      if (room && room.hostId === socket.id) {
        gameService.startGame(room);
        io.to(roomCode).emit('game:started', room);
        
        // 첫 라운드 시작
        startRound(io, roomCode, room);
      }
    });

    // 플레이어 준비
    socket.on('player:ready', (roomCode: string) => {
      const room = gameService.setPlayerReady(roomCode, socket.id);
      if (room) {
        io.to(roomCode).emit('room:updated', room);
        
        // 모든 플레이어가 준비되었는지 확인
        if (gameService.areAllPlayersReady(room)) {
          startCountdown(io, roomCode, room);
        }
      }
    });

    // 플레이어 입찰 (버튼에서 손 뗄 때)
    socket.on('player:bid', (roomCode: string) => {
      const result = gameService.placeBid(roomCode, socket.id);
      if (result) {
        socket.emit('bid:placed', result.bidTime);
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      const room = roomService.removePlayer(socket.id);
      if (room) {
        io.to(room.code).emit('room:updated', room);
      }
    });
  });

  // 카운트다운 시작
  function startCountdown(io: Server, roomCode: string, room: any) {
    let countdown = 5;
    const interval = setInterval(() => {
      io.to(roomCode).emit('game:countdown', countdown);
      
      if (countdown === 0) {
        clearInterval(interval);
        gameService.startRound(room);
        io.to(roomCode).emit('round:started', room.gameState.currentRound);
        
        // 라운드 타이머 시작
        startRoundTimer(io, roomCode, room);
      }
      countdown--;
    }, 1000);
  }

  // 라운드 타이머
  function startRoundTimer(io: Server, roomCode: string, room: any) {
    const checkInterval = setInterval(() => {
      const timeElapsed = Date.now() - (room.gameState.roundStartTime || 0);
      io.to(roomCode).emit('time:update', timeElapsed / 1000);
      
      // 라운드 종료 확인
      const result = gameService.checkRoundEnd(room);
      if (result) {
        clearInterval(checkInterval);
        io.to(roomCode).emit('round:ended', result);
        
        // 다음 라운드 또는 게임 종료
        setTimeout(() => {
          if (room.gameState.currentRound < room.settings.totalRounds) {
            startRound(io, roomCode, room);
          } else {
            const finalResults = gameService.endGame(room);
            io.to(roomCode).emit('game:ended', finalResults);
          }
        }, 3000);
      }
    }, 100);
  }

  // 라운드 시작
  function startRound(io: Server, roomCode: string, room: any) {
    gameService.prepareNewRound(room);
    io.to(roomCode).emit('round:prepare', room.gameState.currentRound);
  }
}