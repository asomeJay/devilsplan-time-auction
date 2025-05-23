import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/RoomService';
import { GameService } from '../services/GameService';
import { TimerService } from '../services/TimerService';

export function setupSocketHandlers(io: Server) {
  const roomService = new RoomService();
  const gameService = new GameService(roomService);
  const timerService = new TimerService();

  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // 룸 생성
    socket.on('room:create', (playerName: string, role: 'player' | 'display') => {
      const room = roomService.createRoom(socket.id, playerName, role);
      socket.join(room.code);
      socket.emit('room:created', room);
      io.to(room.code).emit('room:updated', room);
    });

    // 룸 참가
    socket.on('room:join', (roomCode: string, playerName: string, role: 'player' | 'display') => {
      console.log('방 참가 요청:', { socketId: socket.id, roomCode, playerName, role });
      
      const room = roomService.joinRoom(roomCode, socket.id, playerName, role);
      if (room) {
        console.log('방 참가 성공:', { roomCode, playerId: socket.id, playerName });
        socket.join(roomCode);
        socket.emit('room:joined', room);
        io.to(roomCode).emit('room:updated', room);
      } else {
        console.log('방 참가 실패 - 룸을 찾을 수 없음:', { roomCode, playerId: socket.id });
        socket.emit('error', '룸을 찾을 수 없습니다');
      }
    });

    // 룸 정보 조회
    socket.on('room:getInfo', (roomCode: string) => {
      const room = roomService.getRoom(roomCode);
      if (room) {
        socket.emit('room:updated', room);
      } else {
        socket.emit('error', '룸을 찾을 수 없습니다');
      }
    });

    // 게임 참여 (게임이 진행 중일 때)
    socket.on('game:join', (roomCode: string) => {
      console.log('게임 참여 요청:', { socketId: socket.id, roomCode });
      
      const room = roomService.getRoom(roomCode);
      if (room) {
        console.log('게임 룸 상태:', { 
          roomCode, 
          gameStatus: room.gameState.status, 
          currentRound: room.gameState.currentRound 
        });
        
        // 현재 게임 상태에 따라 적절한 이벤트 전송
        if (room.gameState.status === 'playing') {
          if (room.gameState.currentRound > 0) {
            // 게임이 진행 중이면 현재 라운드 정보 전송
            socket.emit('round:prepare', room.gameState.currentRound);
          }
        }
        
        // 룸 상태 업데이트
        socket.emit('room:updated', room);
      } else {
        console.log('게임 참여 실패 - 룸을 찾을 수 없음:', { roomCode, playerId: socket.id });
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
      console.log('게임 시작 요청:', { socketId: socket.id, roomCode });
      
      const room = roomService.getRoom(roomCode);
      if (room && room.hostId === socket.id) {
        console.log('게임 시작:', { roomCode, hostId: socket.id });
        gameService.startGame(room);
        io.to(roomCode).emit('game:started', room);
        
        // 첫 라운드 시작
        startRound(io, roomCode, room);
      } else {
        console.log('게임 시작 실패:', { 
          roomCode, 
          socketId: socket.id, 
          roomExists: !!room, 
          isHost: room ? room.hostId === socket.id : false 
        });
      }
    });

    // 버튼 누르기 시작
    socket.on('button:press', (roomCode: string) => {
      console.log('버튼 누르기 시작:', { playerId: socket.id, roomCode });
      const room = gameService.startButtonPress(roomCode, socket.id);
      if (room) {
        io.to(roomCode).emit('room:updated', room);
        
        // 모든 플레이어가 버튼을 누르고 있는지 확인
        if (gameService.areAllPlayersHoldingButton(room) && room.gameState.roundStartTime) {
          console.log('모든 플레이어가 버튼을 누름 - 라운드 시작:', { roomCode });
          io.to(roomCode).emit('round:started', room.gameState.currentRound);
          
          // 시간 업데이트 시작
          startTimeTracking(io, roomCode, room);
        }
      }
    });

    // 버튼 누르기 종료 (입찰)
    socket.on('button:release', (roomCode: string) => {
      console.log('버튼 누르기 종료:', { playerId: socket.id, roomCode });
      const result = gameService.endButtonPress(roomCode, socket.id);
      if (result) {
        const room = roomService.getRoom(roomCode);
        if (room) {
          const player = room.players.find(p => p.id === socket.id);
          socket.emit('bid:confirmed', { bidTime: result.bidTime });
          
          // 다른 플레이어들에게 입찰 알림
          socket.to(roomCode).emit('player:bid', {
            playerId: socket.id,
            playerName: player?.name || 'Unknown',
            bidTime: result.bidTime
          });
          
          // 입찰 후 즉시 라운드 종료 확인
          const roundResult = gameService.checkRoundEnd(room);
          if (roundResult) {
            // 타이머 중지
            timerService.stopTimer(roomCode);
            
            // 라운드 종료 알림
            io.to(roomCode).emit('round:ended', roundResult);
            
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
        }
      }
    });

    // 플레이어 준비 (룸에서 사용)
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

    // 플레이어 준비 토글 (룸에서 사용)
    socket.on('player:toggleReady', (roomCode: string) => {
      const room = gameService.togglePlayerReady(roomCode, socket.id);
      if (room) {
        console.log('플레이어 준비 상태 토글:', { playerId: socket.id, roomCode });
        io.to(roomCode).emit('room:updated', room);
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      const room = roomService.removePlayer(socket.id);
      if (room) {
        // 플레이어가 나간 후 게임 상태 확인
        const activePlayers = room.players.filter(p => p.role === 'player');
        if (activePlayers.length === 0) {
          // 모든 플레이어가 나갔으면 타이머 정리
          timerService.stopTimer(room.code);
        }
        io.to(room.code).emit('room:updated', room);
      }
    });
  });

  // 시간 추적 시작
  function startTimeTracking(io: Server, roomCode: string, room: any) {
    const startTime = Date.now();
    const maxRoundTime = 30000; // 30초 최대 시간
    
    const updateTime = () => {
      const room = roomService.getRoom(roomCode);
      if (!room || !room.gameState.roundStartTime) {
        timerService.stopTimer(roomCode);
        return;
      }
      
      const timeElapsed = Date.now() - room.gameState.roundStartTime;
      io.to(roomCode).emit('time:update', timeElapsed / 1000);
      
      // 라운드 종료 확인
      const result = gameService.checkRoundEnd(room);
      if (result) {
        // 타이머 중지
        timerService.stopTimer(roomCode);
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
        return;
      }
      
      // 최대 시간 체크
      if (Date.now() - startTime >= maxRoundTime) {
        // 시간 초과로 라운드 강제 종료
        const timeoutResult = gameService.endRoundByTimeout(room);
        timerService.stopTimer(roomCode);
        io.to(roomCode).emit('round:ended', timeoutResult);
        
        setTimeout(() => {
          if (room.gameState.currentRound < room.settings.totalRounds) {
            startRound(io, roomCode, room);
          } else {
            const finalResults = gameService.endGame(room);
            io.to(roomCode).emit('game:ended', finalResults);
          }
        }, 3000);
        return;
      }
    };
    
    // interval로 지속적인 체크 시작
    timerService.startInterval(roomCode, updateTime, 100);
  }

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

  // 기존 라운드 타이머 (사용하지 않을 예정이지만 호환성을 위해 유지)
  function startRoundTimer(io: Server, roomCode: string, room: any) {
    const startTime = Date.now();
    const maxRoundTime = 30000; // 30초 최대 시간
    
    const checkRoundStatus = () => {
      const room = roomService.getRoom(roomCode);
      if (!room) {
        timerService.stopTimer(roomCode);
        return;
      }
      
      const timeElapsed = Date.now() - (room.gameState.roundStartTime || 0);
      io.to(roomCode).emit('time:update', timeElapsed / 1000);
      
      // 라운드 종료 확인
      const result = gameService.checkRoundEnd(room);
      if (result) {
        // 타이머 중지
        timerService.stopTimer(roomCode);
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
        return;
      }
      
      // 최대 시간 체크
      if (Date.now() - startTime >= maxRoundTime) {
        // 시간 초과로 라운드 강제 종료
        const timeoutResult = gameService.endRoundByTimeout(room);
        timerService.stopTimer(roomCode);
        io.to(roomCode).emit('round:ended', timeoutResult);
        
        setTimeout(() => {
          if (room.gameState.currentRound < room.settings.totalRounds) {
            startRound(io, roomCode, room);
          } else {
            const finalResults = gameService.endGame(room);
            io.to(roomCode).emit('game:ended', finalResults);
          }
        }, 3000);
        return;
      }
    };
    
    // interval로 지속적인 체크 시작
    timerService.startInterval(roomCode, checkRoundStatus, 100);
  }

  // 라운드 시작
  function startRound(io: Server, roomCode: string, room: any) {
    // 첫 라운드가 아닌 경우에만 라운드 증가
    if (room.gameState.currentRound === 0) {
      room.gameState.currentRound = 1;
    } else {
      room.gameState.currentRound++;
    }
    
    gameService.prepareNewRound(room);
    console.log('라운드 시작:', { roomCode, round: room.gameState.currentRound });
    io.to(roomCode).emit('round:prepare', room.gameState.currentRound);
  }
}