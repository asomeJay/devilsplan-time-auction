import { Server, Socket } from 'socket.io';
import { GameStateService } from '../services/GameStateService';
import { GameService } from '../services/GameService';
import { TimerService } from '../services/TimerService';

export function setupSocketHandlers(io: Server) {
  const gameStateService = new GameStateService();
  const gameService = new GameService(gameStateService);
  const timerService = new TimerService();

  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // 게임 참가 (새로운 통합 이벤트)
    socket.on('game:join', (playerName: string, role: 'player' | 'display') => {
      console.log('게임 참가 요청:', { socketId: socket.id, playerName, role });
      
      const game = gameStateService.createOrJoinGame(socket.id, playerName, role);
      
      if (game) {
        console.log('게임 참가 성공:', { playerId: socket.id, playerName });
        socket.join('global_game');
        socket.emit('game:joined');
        io.to('global_game').emit('game:updated', game);
      } else {
        console.log('게임 참가 실패:', { playerId: socket.id });
        socket.emit('error', '게임 참가에 실패했습니다');
      }
    });

    // 게임 재참가 (페이지 새로고침 등)
    socket.on('game:rejoin', () => {
      console.log('게임 재참가 요청:', { socketId: socket.id });
      
      const game = gameStateService.getGame();
      if (game) {
        socket.join('global_game');
        
        // 현재 게임 상태에 따라 적절한 이벤트 전송
        if (game.gameState.status === 'playing') {
          if (game.gameState.currentRound > 0) {
            // 게임이 진행 중이면 현재 라운드 정보 전송
            socket.emit('round:prepare', game.gameState.currentRound);
          }
        }
        
        // 게임 상태 업데이트
        socket.emit('game:updated', game);
      } else {
        console.log('게임 재참가 실패 - 게임을 찾을 수 없음:', { playerId: socket.id });
        socket.emit('error', '게임을 찾을 수 없습니다');
      }
    });

    // 게임 정보 조회
    socket.on('game:getInfo', () => {
      const game = gameStateService.getGame();
      if (game) {
        socket.emit('game:updated', game);
      } else {
        socket.emit('error', '게임을 찾을 수 없습니다');
      }
    });

    // 게임 설정 업데이트
    socket.on('game:updateSettings', (settings: any) => {
      const game = gameStateService.updateSettings(settings);
      if (game) {
        io.to('global_game').emit('game:updated', game);
      }
    });

    // 호스트가 설정 완료하고 플레이어 대기 단계로 전환
    socket.on('game:finishConfiguration', () => {
      console.log('설정 완료 요청:', { socketId: socket.id });
      
      const game = gameStateService.getGame();
      if (game && game.hostId === socket.id) {
        console.log('설정 완료:', { hostId: socket.id });
        gameService.finishConfiguration(game);
        io.to('global_game').emit('game:updated', game);
      } else {
        console.log('설정 완료 실패:', { 
          socketId: socket.id, 
          gameExists: !!game, 
          isHost: game ? game.hostId === socket.id : false 
        });
      }
    });

    // 게임 시작
    socket.on('game:start', () => {
      console.log('게임 시작 요청:', { socketId: socket.id });
      
      const game = gameStateService.getGame();
      if (game && game.hostId === socket.id) {
        console.log('게임 시작:', { hostId: socket.id });
        gameService.startGame(game);
        io.to('global_game').emit('game:started', game);
        
        // 첫 라운드 시작
        startRound(io, game);
      } else {
        console.log('게임 시작 실패:', { 
          socketId: socket.id, 
          gameExists: !!game, 
          isHost: game ? game.hostId === socket.id : false 
        });
      }
    });

    // 버튼 누르기 시작
    socket.on('button:press', () => {
      console.log('버튼 누르기 시작:', { playerId: socket.id });
      const result = gameService.startButtonPress(socket.id);
      if (result) {
        io.to('global_game').emit('game:updated', result.game);
        
        // 모든 플레이어가 버튼을 누르고 5초 카운트다운 시작해야 하는 경우
        if (result.shouldStartCountdown) {
          console.log('모든 플레이어가 버튼을 누름 - 5초 카운트다운 시작');
          startButtonCountdown(io, result.game);
        }
      }
    });

    // 버튼 누르기 종료 (입찰 또는 포기)
    socket.on('button:release', () => {
      console.log('버튼 누르기 종료:', { playerId: socket.id });
      const result = gameService.endButtonPress(socket.id);
      const game = gameStateService.getGame();
      io.to('global_game').emit('game:updated', game);
      
      if (result && game) {
        const player = game.players.find(p => p.id === socket.id);
        
        if (result.isGiveUp) {
          // 포기한 경우
          console.log('플레이어 포기:', { 
            playerId: socket.id, 
            playerName: player?.name,
            remainingTime: player?.remainingTime
          });
          socket.emit('player:giveup');
          socket.to('global_game').emit('player:gaveup', {
            playerId: socket.id,
            playerName: player?.name || 'Unknown'
          });
          io.to('global_game').emit('game:updated', game);
          
        } else if (result.bidTime !== undefined) {
          // 입찰한 경우
          console.log('플레이어 입찰 완료:', { 
            playerId: socket.id, 
            playerName: player?.name, 
            bidTime: result.bidTime,
            bidTimeSeconds: (result.bidTime / 1000).toFixed(3),
            remainingTimeAfter: player?.remainingTime
          });
          
          socket.emit('bid:confirmed', { bidTime: result.bidTime });
          socket.to('global_game').emit('player:bid', {
            playerId: socket.id,
            playerName: player?.name || 'Unknown',
            bidTime: result.bidTime
          });
          
          // === 동점 가능성 실시간 체크 ===
          const currentBids = Array.from(game.gameState.currentBids.entries()).map(([id, time]) => {
            const p = game.players.find(pl => pl.id === id);
            return {
              playerId: id,
              playerName: p?.name || 'Unknown',
              bidTime: time
            };
          });
          
          if (currentBids.length >= 2) {
            // 현재까지의 입찰 중 동점이 있는지 확인
            const maxTime = Math.max(...currentBids.map(b => b.bidTime));
            const playersAtMaxTime = currentBids.filter(b => Math.abs(b.bidTime - maxTime) < 1);
            
            if (playersAtMaxTime.length > 1) {
              console.log('⚠️  동점 상황 감지!');
              console.log(`현재 최고 입찰 시간: ${(maxTime/1000).toFixed(3)}초`);
              console.log(`동점자 수: ${playersAtMaxTime.length}명`);
              playersAtMaxTime.forEach((p, index) => {
                console.log(`  ${index + 1}. ${p.playerName}: ${(p.bidTime/1000).toFixed(3)}초`);
              });
              console.log('※ 추가 입찰이 없으면 이 라운드는 동점 유찰 처리됩니다');
            }
          }
          
          // 입찰 후 즉시 라운드 종료 확인
          const roundResult = gameService.checkRoundEnd(game);
          if (roundResult) {
            console.log('=== 라운드 종료 트리거 ===');
            console.log('트리거 원인: 플레이어 입찰 완료');
            console.log('라운드 결과:', {
              round: roundResult.round,
              isDraw: roundResult.isDraw,
              winnerId: roundResult.winnerId,
              winnerName: roundResult.winnerName,
              winTime: roundResult.winTime,
              totalBids: roundResult.bids.length
            });
            
            // 동점 상황 상세 로깅
            if (roundResult.isDraw) {
              const maxTime = Math.max(...roundResult.bids.map(b => b.bidTime));
              const tiedPlayers = roundResult.bids.filter(b => Math.abs(b.bidTime - maxTime) < 1);
              
              console.log('🏆 동점 유찰 확정!');
              console.log(`동점 시간: ${(maxTime/1000).toFixed(3)}초`);
              console.log(`동점자 ${tiedPlayers.length}명:`);
              tiedPlayers.forEach((p, index) => {
                console.log(`  ${index + 1}. ${p.playerName} (${(p.bidTime/1000).toFixed(3)}초)`);
              });
              
              // 동점이 아닌 다른 입찰자들도 표시
              const nonTiedPlayers = roundResult.bids.filter(b => Math.abs(b.bidTime - maxTime) >= 1);
              if (nonTiedPlayers.length > 0) {
                console.log('기타 입찰자:');
                nonTiedPlayers
                  .sort((a, b) => b.bidTime - a.bidTime)
                  .forEach((p, index) => {
                    console.log(`  ${index + 1}. ${p.playerName} (${(p.bidTime/1000).toFixed(3)}초)`);
                  });
              }
            } else {
              console.log('🏆 단독 승리 확정!');
              console.log(`승리자: ${roundResult.winnerName} (${roundResult.winTime?.toFixed(3)}초)`);
              
              if (roundResult.bids.length > 1) {
                console.log('전체 순위:');
                roundResult.bids
                  .sort((a, b) => b.bidTime - a.bidTime)
                  .forEach((bid, index) => {
                    const isWinner = bid.playerId === roundResult.winnerId;
                    console.log(`  ${index + 1}위: ${bid.playerName} (${(bid.bidTime/1000).toFixed(3)}초) ${isWinner ? '👑' : ''}`);
                  });
              }
            }
            
            console.log('=========================');
            
            // 타이머 중지
            timerService.stopTimer('global_timer');
            stopCurrentCountdown();
            
            // 라운드 종료 알림
            io.to('global_game').emit('round:ended', roundResult);
          }
        }
      }
    });    

    // 플레이어 준비 토글
    socket.on('player:toggleReady', () => {
      const game = gameService.togglePlayerReady(socket.id);
      if (game) {
        console.log('플레이어 준비 상태 토글:', { playerId: socket.id });
        io.to('global_game').emit('game:updated', game);
      }
    });

    socket.on('round:next', () => {
      const game = gameStateService.getGame();
      if (game && game.hostId === socket.id) {
        if (game.gameState.currentRound < game.settings.totalRounds) {
          console.log('호스트가 다음 라운드 시작 요청:', { currentRound: game.gameState.currentRound });
          startRound(io, game);
        } else {
          console.log('호스트가 게임 종료 요청');
          const finalResults = gameService.endGame(game);
          io.to('global_game').emit('game:ended', finalResults);
        }
      } else {
        console.log('다음 라운드 요청 실패:', { 
          socketId: socket.id, 
          gameExists: !!game, 
          isHost: game ? game.hostId === socket.id : false 
        });
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log('플레이어 연결 해제:', socket.id);
      const game = gameStateService.removePlayer(socket.id);
      if (game) {
        // 플레이어가 나간 후 게임 상태 확인
        const activePlayers = game.players.filter(p => p.role === 'player');
        if (activePlayers.length === 0) {
          // 모든 플레이어가 나갔으면 타이머 정리
          console.log('모든 플레이어가 나감 - 타이머 정리');
          timerService.stopTimer('global_timer');
          stopCurrentCountdown();
        }
        io.to('global_game').emit('game:updated', game);
      }
    });
  });

  // 시간 추적 시작 (수정된 버전)
  function startTimeTracking(io: Server, game: any) {
    const updateTime = () => {
      const currentGame = gameStateService.getGame();
      if (!currentGame || !currentGame.gameState.roundStartTime || !currentGame.gameState.commonTimerStarted) {
        console.log('시간 추적 중단:', { reason: 'game or timer stopped' });
        timerService.stopTimer('global_timer');
        return;
      }      
  
      // 현재 경과 시간 계산
      const currentTime = Date.now();
      const elapsedTime = (currentTime - currentGame.gameState.roundStartTime) / 1000; // 초 단위
  
      // 시간이 소진된 플레이어들 자동 처리 (입찰 완료)
      const autoCompleteResult = gameService.autoCompleteExpiredPlayers(currentGame);

      // 시간 소진으로 자동 입찰 완료된 플레이어들이 있다면 알림
      if (autoCompleteResult.expiredPlayers.length > 0) {
        autoCompleteResult.expiredPlayers.forEach(playerId => {
          const player = currentGame.players.find(p => p.id === playerId);
          
          if (player) {
            // 해당 플레이어의 입찰 시간 가져오기
            const bidTime = currentGame.gameState.currentBids.get(playerId);
            
            console.log(`플레이어 ${player.name} 시간 소진으로 자동 입찰 완료 (${bidTime}ms)`);
            
            // 해당 플레이어에게 입찰 완료 알림
            io.to(playerId).emit('bid:confirmed', { 
              bidTime: bidTime,
              autoCompleted: true,
              reason: 'time_exhausted'
            });
            
            // 다른 플레이어들에게 입찰 알림 (포기가 아닌 입찰 완료)
            io.to('global_game').emit('player:bid', {
              playerId: playerId,
              playerName: player.name,
              bidTime: bidTime,
              autoCompleted: true,
              reason: 'time_exhausted'
            });
          }
        });
        
        // 게임 상태 업데이트 전송 (입찰 완료한 플레이어 상태 반영)
        io.to('global_game').emit('game:updated', currentGame);
      }
  
      // 자동 처리 후 라운드 종료 확인
      if (autoCompleteResult.shouldEndRound) {
        const roundResult = gameService.checkRoundEnd(currentGame);
        if (roundResult) {
          console.log('시간 소진으로 라운드 자동 종료:', { roundResult });
          timerService.stopTimer('global_timer');
          stopCurrentCountdown();
          io.to('global_game').emit('round:ended', roundResult);
          return;
        }
      }
  
      // 각 플레이어의 정확한 남은 시간 계산 (표시용)
      const playersWithEstimatedTime = currentGame.players.map(p => {
        let estimatedRemainingTime = p.remainingTime;
        
        if (p.role === 'player' && p.isHoldingButton && p.isBidding) {
          const buttonPressStartTime = currentGame.gameState.buttonPressStartTimes.get(p.id);
          if (buttonPressStartTime) {
            const timeUsedSincePress = (currentTime - buttonPressStartTime) / 1000;
            const calculatedRemainingTime = p.remainingTime - timeUsedSincePress;
            
            // 0에 가까우면 정확히 0으로 설정 (0.01초 이하는 0으로 처리)
            estimatedRemainingTime = calculatedRemainingTime < 0.01 ? 0 : Math.max(0, calculatedRemainingTime);
          }
        }
        
        // 이미 0인 경우 정확히 0 유지
        if (p.remainingTime <= 0) {
          estimatedRemainingTime = 0;
        }
        
        return {
          id: p.id,
          name: p.name,
          remainingTime: estimatedRemainingTime,
          isHoldingButton: p.isHoldingButton,
          isBidding: p.isBidding,
          role: p.role
        };
      });
  
      // 클라이언트에 현재 경과 시간과 플레이어 정보 전송
      io.to('global_game').emit('game:timeUpdate', {
        elapsedTime: elapsedTime,
        roundStartTime: currentGame.gameState.roundStartTime,
        players: playersWithEstimatedTime
      });
  
      // 일반적인 라운드 종료 확인 (자동 처리가 없었던 경우)
      if (autoCompleteResult.expiredPlayers.length === 0) {
        const result = gameService.checkRoundEnd(currentGame);
        if (result) {
          console.log('라운드 자연 종료:', { result });
          timerService.stopTimer('global_timer');
          io.to('global_game').emit('round:ended', result);
          return;
        }
      }
    };
    
    // 서버에서만 라운드 상태 체크
    console.log('시간 추적 시작 (서버 전용)');
    timerService.startInterval('global_timer', updateTime, 100); // 100ms로 더 자주 업데이트
  }

  function nextRound(io: Server, game: any) {
    if (game.gameState.currentRound < game.settings.totalRounds) {
        startRound(io, game);
      } else {
        const finalResults = gameService.endGame(game);
        io.to('global_game').emit('game:ended', finalResults);
      }
  }
  
  // 라운드 시작
  function startRound(io: Server, game: any) {
    // 첫 라운드가 아닌 경우에만 라운드 증가
    if (game.gameState.currentRound === 0) {
      game.gameState.currentRound = 1;
    } else {
      game.gameState.currentRound++;
    }
    
    gameService.prepareNewRound(game);
    console.log('라운드 시작:', { round: game.gameState.currentRound, status: game.gameState.status });
    
    // 라운드 준비 이벤트와 함께 게임 상태 업데이트 전송
    io.to('global_game').emit('round:prepare', game.gameState.currentRound);
    io.to('global_game').emit('game:updated', game);
  }

  // 버튼 누르기 후 5초 카운트다운 및 공통 타이머 시작
  function startButtonCountdown(io: Server, game: any) {
    let countdown = 5;
    
      const countdownTick = () => {
        const currentGame = gameStateService.getGame();
        // 카운트다운 중에 상태가 변경되었으면 중단
        if (!currentGame || !currentGame.gameState.isWaitingForCountdown) {
          console.log('카운트다운 중단됨:', { hasGame: !!currentGame });
          return;
        }
        
        console.log('카운트다운:', { countdown });
        io.to('global_game').emit('game:countdown', countdown);
        
        if (countdown === 0) {
          // 공통 타이머 시작 시점에서 참여자 확인
          console.log('카운트다운 완료 - 참여자 확인 후 공통 타이머 시작');
          
          // 여전히 버튼을 누르고 있는 플레이어들 확인
          const playersStillHolding = currentGame.players
            .filter(p => p.role === 'player' && p.isHoldingButton)
            .map(p => p.id);
          
          if (playersStillHolding.length === 0) {
            // 아무도 참여하지 않으면 유찰 처리
            console.log('카운트다운 완료했지만 참여자 없음 - 유찰 처리');
            currentGame.gameState.isWaitingForCountdown = false;
            currentGame.gameState.countdownStartTime = undefined;
            handleAllPlayersGaveUp(io, currentGame);
          } else {
            // 참여자가 있으면 공통 타이머 시작
            const result = gameService.startCommonTimer();
            if (result) {
              console.log('공통 타이머 시작됨:', { 
                playersStillHolding: result.playersStillHolding 
              });
              
              // 중요: playersStillHolding 정보를 포함하여 round:started 이벤트 전송
              io.to('global_game').emit('round:started', {
                round: result.game.gameState.currentRound,
                playersStillHolding: result.playersStillHolding
              });
              
              // 시간 업데이트 시작
              startTimeTracking(io, result.game);
            }
          }
        } else {
          countdown--;
          // 1초 후 다음 카운트다운
          timerService.startTimer('global_countdown', countdownTick, 1000);
        }
      };
      
      // 첫 카운트다운 시작
      countdownTick();
    }

    // 카운트다운 중단
    function stopCurrentCountdown() {
      console.log('카운트다운 중단');
      timerService.stopTimer('global_countdown');
    }
    
    // 모든 플레이어가 포기했을 때 처리 함수
    function handleAllPlayersGaveUp(io: Server, game: any) {
      console.log('모든 플레이어가 포기함 - 라운드 처리 시작');
      
      // 현재 라운드를 유찰로 처리
      const roundResult = {
        round: game.gameState.currentRound,
        isDraw: true,
        bids: [],
        reason: 'all_players_gave_up' // 포기로 인한 유찰임을 명시
      };
      
      // 라운드 히스토리에 추가
      game.gameState.roundHistory.push(roundResult);
      
      // 라운드 결과 전송
      io.to('global_game').emit('round:ended', roundResult);
    }
}