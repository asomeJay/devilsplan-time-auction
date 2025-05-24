import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/RoomService';
import { GameService } from '../services/GameService';
import { TimerService } from '../services/TimerService';

const GLOBAL_ROOM_CODE = 'global_game_room';

export function setupSocketHandlers(io: Server) {
  const roomService = new RoomService();
  const gameService = new GameService(roomService);
  const timerService = new TimerService();

  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // 게임 참가 (새로운 통합 이벤트)
    socket.on('game:join', (playerName: string, role: 'player' | 'display') => {
      console.log('게임 참가 요청:', { socketId: socket.id, playerName, role });
      
      // 글로벌 룸이 없으면 생성, 있으면 참가
      let room = roomService.getRoom(GLOBAL_ROOM_CODE);
      if (!room) {
        room = roomService.createGlobalRoom(socket.id, playerName, role);
      } else {
        room = roomService.joinRoom(GLOBAL_ROOM_CODE, socket.id, playerName, role);
      }
      
      if (room) {
        console.log('게임 참가 성공:', { playerId: socket.id, playerName });
        socket.join(GLOBAL_ROOM_CODE);
        socket.emit('game:joined');
        io.to(GLOBAL_ROOM_CODE).emit('room:updated', room);
      } else {
        console.log('게임 참가 실패:', { playerId: socket.id });
        socket.emit('error', '게임 참가에 실패했습니다');
      }
    });

    // 게임 재참가 (페이지 새로고침 등)
    socket.on('game:rejoin', () => {
      console.log('게임 재참가 요청:', { socketId: socket.id });
      
      const room = roomService.getRoom(GLOBAL_ROOM_CODE);
      if (room) {
        socket.join(GLOBAL_ROOM_CODE);
        
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
        console.log('게임 재참가 실패 - 룸을 찾을 수 없음:', { playerId: socket.id });
        socket.emit('error', '게임을 찾을 수 없습니다');
      }
    });

    // 룸 정보 조회
    socket.on('room:getInfo', () => {
      const room = roomService.getRoom(GLOBAL_ROOM_CODE);
      if (room) {
        socket.emit('room:updated', room);
      } else {
        socket.emit('error', '게임을 찾을 수 없습니다');
      }
    });

    // 게임 설정 업데이트
    socket.on('game:updateSettings', (settings: any) => {
      const room = roomService.updateSettings(GLOBAL_ROOM_CODE, settings);
      if (room) {
        io.to(GLOBAL_ROOM_CODE).emit('room:updated', room);
      }
    });

    // 게임 시작
    socket.on('game:start', () => {
      console.log('게임 시작 요청:', { socketId: socket.id });
      
      const room = roomService.getRoom(GLOBAL_ROOM_CODE);
      if (room && room.hostId === socket.id) {
        console.log('게임 시작:', { hostId: socket.id });
        gameService.startGame(room);
        io.to(GLOBAL_ROOM_CODE).emit('game:started', room);
        
        // 첫 라운드 시작
        startRound(io, room);
      } else {
        console.log('게임 시작 실패:', { 
          socketId: socket.id, 
          roomExists: !!room, 
          isHost: room ? room.hostId === socket.id : false 
        });
      }
    });

    // 버튼 누르기 시작
    socket.on('button:press', () => {
      console.log('버튼 누르기 시작:', { playerId: socket.id });
      const result = gameService.startButtonPress(GLOBAL_ROOM_CODE, socket.id);
      if (result) {
        io.to(GLOBAL_ROOM_CODE).emit('room:updated', result.room);
        
        // 모든 플레이어가 버튼을 누르고 5초 카운트다운 시작해야 하는 경우
        if (result.shouldStartCountdown) {
          console.log('모든 플레이어가 버튼을 누름 - 5초 카운트다운 시작');
          startButtonCountdown(io, result.room);
        }
      }
    });

    // 버튼 누르기 종료 (입찰 또는 포기)
    socket.on('button:release', () => {
      console.log('버튼 누르기 종료:', { playerId: socket.id });
      const result = gameService.endButtonPress(GLOBAL_ROOM_CODE, socket.id);
      const room = roomService.getRoom(GLOBAL_ROOM_CODE);
      io.to(GLOBAL_ROOM_CODE).emit('room:updated', room);
      if (result && room) {
        const player = room.players.find(p => p.id === socket.id);
        
        if (result.isGiveUp) {
          // 포기한 경우
          console.log('플레이어 포기:', { playerId: socket.id, playerName: player?.name });
          socket.emit('player:giveup');
          
          // 다른 플레이어들에게 포기 알림
          socket.to(GLOBAL_ROOM_CODE).emit('player:gaveup', {
            playerId: socket.id,
            playerName: player?.name || 'Unknown'
          });
          
          // 카운트다운 중 포기했으므로 모든 플레이어가 버튼을 누르고 있는지 다시 확인
          if (room.gameState.isWaitingForCountdown) {
            const stillHoldingPlayers = room.players.filter(p => p.role === 'player' && p.isHoldingButton);
            if (stillHoldingPlayers.length === 0) {
              // 아무도 버튼을 누르고 있지 않으면 카운트다운 중단
              console.log('모든 플레이어가 포기 - 카운트다운 중단');
              stopCurrentCountdown();
              room.gameState.isWaitingForCountdown = false;
              room.gameState.countdownStartTime = undefined;

              handleAllPlayersGaveUp(io, room);

            }
          }
          
          io.to(GLOBAL_ROOM_CODE).emit('room:updated', room);
        }
        else if (result.bidTime !== undefined) {
          // 입찰한 경우
          console.log('플레이어 입찰 완료:', { 
            playerId: socket.id, 
            playerName: player?.name, 
            bidTime: result.bidTime 
          });
          socket.emit('bid:confirmed', { bidTime: result.bidTime });
          
          // 다른 플레이어들에게 입찰 알림
          socket.to(GLOBAL_ROOM_CODE).emit('player:bid', {
            playerId: socket.id,
            playerName: player?.name || 'Unknown',
            bidTime: result.bidTime
          });
          
          // 입찰 후 즉시 라운드 종료 확인
          const roundResult = gameService.checkRoundEnd(room);
          if (roundResult) {
            console.log('라운드 종료:', { roundResult });
            // 타이머 중지
            timerService.stopTimer(GLOBAL_ROOM_CODE);
            stopCurrentCountdown();
            
            // 라운드 종료 알림
            io.to(GLOBAL_ROOM_CODE).emit('round:ended', roundResult);
            
            // 다음 라운드 또는 게임 종료
            setTimeout(() => {
              if (room.gameState.currentRound < room.settings.totalRounds) {
                startRound(io, room);
              } else {
                const finalResults = gameService.endGame(room);
                io.to(GLOBAL_ROOM_CODE).emit('game:ended', finalResults);
              }
            }, 3000);
          }
        }
      }
    });

    // 플레이어 준비 토글 (룸에서 사용)
    socket.on('player:toggleReady', () => {
      const room = gameService.togglePlayerReady(GLOBAL_ROOM_CODE, socket.id);
      if (room) {
        console.log('플레이어 준비 상태 토글:', { playerId: socket.id });
        io.to(GLOBAL_ROOM_CODE).emit('room:updated', room);
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log('플레이어 연결 해제:', socket.id);
      const room = roomService.removePlayer(socket.id);
      if (room) {
        // 플레이어가 나간 후 게임 상태 확인
        const activePlayers = room.players.filter(p => p.role === 'player');
        if (activePlayers.length === 0) {
          // 모든 플레이어가 나갔으면 타이머 정리
          console.log('모든 플레이어가 나감 - 타이머 정리:', room.code);
          timerService.stopTimer(GLOBAL_ROOM_CODE);
          stopCurrentCountdown();
        }
        io.to(GLOBAL_ROOM_CODE).emit('room:updated', room);
      }
    });
  });

  // 시간 추적 시작
  function startTimeTracking(io: Server, room: any) {
    const startTime = Date.now();
    const maxRoundTime = 30000; // 30초 최대 시간
    
    const updateTime = () => {
      const room = roomService.getRoom(GLOBAL_ROOM_CODE);
      if (!room || !room.gameState.roundStartTime || !room.gameState.commonTimerStarted) {
        console.log('시간 추적 중단:', { reason: 'room or timer stopped' });
        timerService.stopTimer(GLOBAL_ROOM_CODE);
        return;
      }
      
      const timeElapsed = Date.now() - room.gameState.roundStartTime;
      io.to(GLOBAL_ROOM_CODE).emit('time:update', timeElapsed / 1000);
      
      // 라운드 종료 확인
      const result = gameService.checkRoundEnd(room);
      if (result) {
        console.log('라운드 자연 종료:', { result });
        // 타이머 중지
        timerService.stopTimer(GLOBAL_ROOM_CODE);
        io.to(GLOBAL_ROOM_CODE).emit('round:ended', result);
        
        // 다음 라운드 또는 게임 종료
        setTimeout(() => {
          if (room.gameState.currentRound < room.settings.totalRounds) {
            startRound(io, room);
          } else {
            const finalResults = gameService.endGame(room);
            io.to(GLOBAL_ROOM_CODE).emit('game:ended', finalResults);
          }
        }, 3000);
        return;
      }
      
      // 최대 시간 체크
      if (timeElapsed >= maxRoundTime) {
        console.log('시간 초과로 라운드 강제 종료:', { timeElapsed });
        // 시간 초과로 라운드 강제 종료
        const timeoutResult = gameService.endRoundByTimeout(room);
        timerService.stopTimer(GLOBAL_ROOM_CODE);
        io.to(GLOBAL_ROOM_CODE).emit('round:ended', timeoutResult);
        
        setTimeout(() => {
          if (room.gameState.currentRound < room.settings.totalRounds) {
            startRound(io, room);
          } else {
            const finalResults = gameService.endGame(room);
            io.to(GLOBAL_ROOM_CODE).emit('game:ended', finalResults);
          }
        }, 3000);
        return;
      }
    };
    
    // interval로 지속적인 체크 시작
    console.log('시간 추적 시작');
    timerService.startInterval(GLOBAL_ROOM_CODE, updateTime, 100);
  }

  // 라운드 시작
  function startRound(io: Server, room: any) {
    // 첫 라운드가 아닌 경우에만 라운드 증가
    if (room.gameState.currentRound === 0) {
      room.gameState.currentRound = 1;
    } else {
      room.gameState.currentRound++;
    }
    
    gameService.prepareNewRound(room);
    console.log('라운드 시작:', { round: room.gameState.currentRound, status: room.gameState.status });
    
    // 라운드 준비 이벤트와 함께 룸 상태 업데이트 전송
    io.to(GLOBAL_ROOM_CODE).emit('round:prepare', room.gameState.currentRound);
    io.to(GLOBAL_ROOM_CODE).emit('room:updated', room);
  }

  // 버튼 누르기 후 5초 카운트다운 및 공통 타이머 시작
  function startButtonCountdown(io: Server, room: any) {
    let countdown = 5;
    
    const countdownTick = () => {
      const currentRoom = roomService.getRoom(GLOBAL_ROOM_CODE);
      // 카운트다운 중에 상태가 변경되었으면 중단
      if (!currentRoom || !currentRoom.gameState.isWaitingForCountdown) {
        console.log('카운트다운 중단됨:', { hasRoom: !!currentRoom });
        return;
      }
      
      console.log('카운트다운:', { countdown });
      io.to(GLOBAL_ROOM_CODE).emit('game:countdown', countdown);
      
      if (countdown === 0) {
        // 공통 타이머 시작
        console.log('카운트다운 완료 - 공통 타이머 시작');
        const result = gameService.startCommonTimer(GLOBAL_ROOM_CODE);
        if (result) {
          console.log('공통 타이머 시작됨:', { 
            playersStillHolding: result.playersStillHolding 
          });
          
          // 중요: playersStillHolding 정보를 포함하여 round:started 이벤트 전송
          io.to(GLOBAL_ROOM_CODE).emit('round:started', {
            round: result.room.gameState.currentRound,
            playersStillHolding: result.playersStillHolding
          });
          
          // 시간 업데이트 시작
          startTimeTracking(io, result.room);
        }
      } else {
        countdown--;
        // 1초 후 다음 카운트다운
        timerService.startTimer(GLOBAL_ROOM_CODE + '_countdown', countdownTick, 1000);
      }
    };
    
    // 첫 카운트다운 시작
    countdownTick();
  }

  // 카운트다운 중단
  function stopCurrentCountdown() {
    console.log('카운트다운 중단');
    timerService.stopTimer(GLOBAL_ROOM_CODE + '_countdown');
  }
  // ✅ 새로 추가: 모든 플레이어가 포기했을 때 처리 함수
function handleAllPlayersGaveUp(io: Server, room: any) {
    console.log('모든 플레이어가 포기함 - 라운드 처리 시작');
    
    // 현재 라운드를 유찰로 처리
    const roundResult = {
      round: room.gameState.currentRound,
      isDraw: true,
      bids: [],
      reason: 'all_players_gave_up' // 포기로 인한 유찰임을 명시
    };
    
    // 라운드 히스토리에 추가
    room.gameState.roundHistory.push(roundResult);
    
    // 라운드 결과 전송
    io.to(GLOBAL_ROOM_CODE).emit('round:ended', roundResult);
    
    // 3초 후 다음 라운드 시작 또는 게임 종료
    setTimeout(() => {
      if (room.gameState.currentRound < room.settings.totalRounds) {
        console.log('다음 라운드 시작 (포기로 인한 유찰 후)');
        startRound(io, room);
      } else {
        console.log('게임 종료 (포기로 인한 유찰 후)');
        const finalResults = gameService.endGame(room);
        io.to(GLOBAL_ROOM_CODE).emit('game:ended', finalResults);
      }
    }, 3000);
  }
}