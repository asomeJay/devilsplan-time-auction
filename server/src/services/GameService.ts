// server/src/services/GameService.ts
import { GlobalGame, RoundResult, GameResults } from '../types';
import { GameStateService } from './GameStateService';

export class GameService {
  constructor(private gameStateService: GameStateService) {}

  // 호스트가 설정을 완료하고 플레이어 대기 단계로 전환
  finishConfiguration(game: GlobalGame) {
    game.gameState.status = 'waiting';
    
    // 모든 플레이어 상태 초기화
    game.players.forEach(player => {
      if (player.role === 'player') {
        player.isReady = false;
        player.isBidding = false;
        player.isHoldingButton = false;
        player.wins = 0;
      }
    });
  }

  startGame(game: GlobalGame) {
    game.gameState.status = 'playing';
    game.gameState.currentRound = 0;
    game.gameState.currentBids.clear();
    game.gameState.buttonPressStartTimes.clear();
    game.gameState.roundStartTime = undefined;
    game.gameState.roundHistory = [];
    game.gameState.isWaitingForCountdown = false;
    game.gameState.commonTimerStarted = false;
    
    // 모든 플레이어 상태 초기화
    game.players.forEach(player => {
      if (player.role === 'player') {
        player.isReady = false;
        player.isBidding = false;
        player.isHoldingButton = false;
        player.wins = 0;
      }
    });
  }

  prepareNewRound(game: GlobalGame) {
    game.players.forEach(player => {
      player.isReady = false;
      player.isBidding = false;
      player.isHoldingButton = false;
    });
    game.gameState.currentBids.clear();
    game.gameState.buttonPressStartTimes.clear();
    game.gameState.status = 'playing';
    game.gameState.isWaitingForCountdown = false;
    game.gameState.commonTimerStarted = false;
    game.gameState.roundStartTime = undefined;
    game.gameState.countdownStartTime = undefined;
  }

  // 버튼 누르기 시작
  startButtonPress(playerId: string): { shouldStartCountdown: boolean, game: GlobalGame } | undefined {
    const game = this.gameStateService.getGame();
    if (!game) return undefined;
  
    const player = game.players.find(p => p.id === playerId);
    if (player && player.role === 'player') {
      // 게임 진행 중이고 공통 타이머가 시작된 상태에서 시간이 소진된 플레이어는 버튼을 누를 수 없음
      if (game.gameState.commonTimerStarted && player.remainingTime <= 0.01) {
        console.log(`플레이어 ${player.name} 시간 소진으로 버튼 누르기 거부 (게임 진행 중)`);
        return { shouldStartCountdown: false, game };
      }
  
      player.isHoldingButton = true;
      
      // 버튼 누르기 시작 시간 기록 (시간 차감용)
      game.gameState.buttonPressStartTimes.set(playerId, Date.now());
      
      console.log(`플레이어 ${player.name} (${playerId}) 버튼 누르기 시작, 남은 시간: ${player.remainingTime}초`);
      
      // 모든 플레이어가 버튼을 누르고 있는지 확인
      if (this.areAllPlayersHoldingButton(game) && !game.gameState.isWaitingForCountdown && !game.gameState.commonTimerStarted) {
        // 5초 카운트다운 시작
        game.gameState.isWaitingForCountdown = true;
        game.gameState.countdownStartTime = Date.now(); // 카운트다운 시작 시간 기록
        console.log(`모든 플레이어가 버튼을 누름. 카운트다운 시작`);
        return { shouldStartCountdown: true, game };
      }
    }
  
    return { shouldStartCountdown: false, game };
  }

  autoCompleteExpiredPlayers(game: GlobalGame): { expiredPlayers: string[], shouldEndRound: boolean } {
    if (!game.gameState.commonTimerStarted || !game.gameState.roundStartTime) {
      return { expiredPlayers: [], shouldEndRound: false };
    }
  
    const currentTime = Date.now();
    const expiredPlayers: string[] = [];
    
    // 현재 입찰 중인 플레이어들만 확인
    const activeBiddingPlayers = game.players.filter(p => 
      p.role === 'player' && 
      p.isBidding && 
      p.isHoldingButton &&
      !game.gameState.currentBids.has(p.id)
    );
  
    console.log('시간 소진 체크:', {
      totalPlayers: game.players.filter(p => p.role === 'player').length,
      activeBiddingPlayers: activeBiddingPlayers.length,
      playersWithBids: game.gameState.currentBids.size,
      timestamp: currentTime,
      roundStartTime: game.gameState.roundStartTime
    });
  
    activeBiddingPlayers.forEach(player => {
      const buttonPressStartTime = game.gameState.buttonPressStartTimes.get(player.id);
      if (!buttonPressStartTime) return;
  
      // 이번 입찰에서 실제 사용한 시간 계산 (초 단위)
      const timeUsedThisPress = (currentTime - buttonPressStartTime) / 1000;
      
      // 플레이어의 남은 시간을 초과했는지 확인 (더 엄격한 기준 적용)
      const timeExceeded = timeUsedThisPress > (player.remainingTime + 0.001); // 1ms 오차만 허용
      
      if (timeExceeded) {
        console.log(`플레이어 ${player.name} 시간 소진 - 자동 입찰 완료 처리:`, {
          timeUsedThisPress: timeUsedThisPress.toFixed(3),
          remainingTime: player.remainingTime.toFixed(3),
          difference: (timeUsedThisPress - player.remainingTime).toFixed(3),
          buttonPressStartTime,
          currentTime,
          exactTimeUsed: timeUsedThisPress
        });
        
        expiredPlayers.push(player.id);
        
        // 정확한 입찰 시간 계산: 플레이어의 남은 시간으로 제한
        const effectiveBidTime = Math.floor(player.remainingTime * 1000); // 밀리초로 변환하고 정수화
        game.gameState.currentBids.set(player.id, effectiveBidTime);
        
        // 플레이어 상태 업데이트
        player.isHoldingButton = false;
        player.isBidding = false;
        player.remainingTime = 0;
        game.gameState.buttonPressStartTimes.delete(player.id);
        
        console.log(`플레이어 ${player.name} 시간 소진으로 자동 입찰 완료 (정확한 입찰시간: ${effectiveBidTime}ms)`);
      }
    });
  
    // 라운드 종료 확인
    const shouldEndRound = this.checkRoundEnd(game) !== undefined;
  
    return { expiredPlayers, shouldEndRound };
  }

  // 5초 카운트다운 후 공통 타이머 시작
  startCommonTimer(): { game: GlobalGame, playersStillHolding: string[] } | undefined {
    const game = this.gameStateService.getGame();
    if (!game) return undefined;

    // 카운트다운이 끝난 시점에서 여전히 버튼을 누르고 있는 플레이어들 확인
    const playersStillHolding = game.players
      .filter(p => p.role === 'player' && p.isHoldingButton)
      .map(p => p.id);

    console.log(`카운트다운 종료. 여전히 버튼을 누르고 있는 플레이어들:`, playersStillHolding);

    // 공통 타이머 시작
    game.gameState.roundStartTime = Date.now();
    game.gameState.commonTimerStarted = true;
    game.gameState.isWaitingForCountdown = false;

    // 여전히 버튼을 누르고 있는 플레이어들을 입찰 상태로 전환
    game.players.forEach(player => {
      if (player.role === 'player' && player.isHoldingButton) {
        // 시간이 소진된 플레이어는 즉시 포기 처리
        if (player.remainingTime <= 0.01) {
          console.log(`플레이어 ${player.name} 시간 소진으로 입찰 포기 처리`);
          player.isHoldingButton = false;
          player.isBidding = false;
          game.gameState.buttonPressStartTimes.delete(player.id);
        } else {
          player.isBidding = true;
          // 입찰 시작 시간을 다시 기록 (정확한 입찰 시간 계산을 위해)
          game.gameState.buttonPressStartTimes.set(player.id, Date.now());
          console.log(`플레이어 ${player.name} 입찰 상태로 전환`);
        }
      } else if (player.role === 'player') {
        // 버튼을 누르지 않고 있는 플레이어는 이미 포기한 상태
        console.log(`플레이어 ${player.name} 이미 포기함`);
      }
    });

    return { game, playersStillHolding };
  }

  // 버튼 누르기 종료 (입찰 또는 포기)
  endButtonPress(playerId: string): { bidTime?: number, isGiveUp?: boolean, playerTimeExhausted?: boolean } | undefined {
    const game = this.gameStateService.getGame();
    if (!game) return undefined;
  
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      console.log(`플레이어 ${playerId} 찾을 수 없음`);
      return undefined;
    }
  
    // 게임 진행 중에 시간이 이미 소진된 플레이어의 입찰은 포기로 처리
    if (game.gameState.commonTimerStarted && player.remainingTime <= 0.01) {
      console.log(`플레이어 ${player.name} 시간 소진으로 입찰 포기 처리`);
      player.isHoldingButton = false;
      player.isBidding = false;
      game.gameState.buttonPressStartTimes.delete(playerId);
      return { isGiveUp: true };
    }
  
    // 카운트다운 중에 손을 뗀 경우 = 입찰 포기
    if (game.gameState.isWaitingForCountdown && game.gameState.countdownStartTime) {
      player.isHoldingButton = false;
      player.isBidding = false;
      game.gameState.buttonPressStartTimes.delete(playerId);
      console.log(`플레이어 ${player.name} 입찰 포기 (카운트다운 중 버튼 릴리즈)`);
      return { isGiveUp: true };
    }
    // 공통 타이머가 시작된 후에 손을 뗀 경우 = 입찰
    else if (game.gameState.commonTimerStarted && game.gameState.roundStartTime && player.isBidding) {
      const currentTime = Date.now();
      const actualBidTime = currentTime - game.gameState.roundStartTime;
      
      // 버튼 누르기 시작 시간 가져오기
      const buttonPressStartTime = game.gameState.buttonPressStartTimes.get(playerId);
      if (!buttonPressStartTime) {
        console.log(`플레이어 ${player.name} 버튼 누르기 시작 시간을 찾을 수 없음`);
        return undefined;
      }
      
      // 이번 입찰에서 실제 사용한 시간 계산 (초 단위)
      const timeUsedThisPress = (currentTime - buttonPressStartTime) / 1000;
      
      // 플레이어가 가진 시간으로 입찰 시간 제한
      let effectiveBidTime: number;
      let playerTimeExhausted = false;
      
      // 0.01초 오차 허용하여 시간 초과 판단
      if (timeUsedThisPress > (player.remainingTime + 0.01)) {
        // 시간을 초과한 경우: 정확히 남은 시간만큼만 입찰 시간으로 인정
        effectiveBidTime = player.remainingTime * 1000; // 밀리초로 변환
        playerTimeExhausted = true;
        
        // 플레이어의 남은 시간을 정확히 0으로 설정
        player.remainingTime = 0;
        
        console.log(`플레이어 ${player.name} 시간 초과 - 제한된 입찰:`, {
          timeUsedThisPress,
          originalRemainingTime: player.remainingTime,
          effectiveBidTime
        });
      } else {
        // 시간 내에 입찰한 경우: 실제 입찰 시간 사용
        effectiveBidTime = actualBidTime;
        
        // 플레이어의 남은 시간에서 사용한 시간 차감
        const newRemainingTime = player.remainingTime - timeUsedThisPress;
        
        // 0에 가까우면 정확히 0으로 설정 (부동소수점 오차 처리)
        player.remainingTime = newRemainingTime < 0.01 ? 0 : Math.max(0, newRemainingTime);
        
        console.log(`플레이어 ${player.name} 정상 입찰:`, {
          timeUsedThisPress,
          newRemainingTime,
          finalRemainingTime: player.remainingTime
        });
      }
      
      game.gameState.currentBids.set(playerId, effectiveBidTime);
      
      // 플레이어 상태 업데이트
      player.isHoldingButton = false;
      player.isBidding = false;
      game.gameState.buttonPressStartTimes.delete(playerId);
      
      return { 
        bidTime: effectiveBidTime, 
        playerTimeExhausted 
      };
    }
    // 그 외의 경우는 단순히 버튼 상태만 해제 (준비 단계에서 놓기)
    else {
      player.isHoldingButton = false;
      player.isBidding = false;
      game.gameState.buttonPressStartTimes.delete(playerId);
      console.log(`플레이어 ${player.name} 버튼 상태 해제 (준비 단계)`);
      return undefined;
    }
  }

  // 모든 플레이어가 버튼을 누르고 있는지 확인
  areAllPlayersHoldingButton(game: GlobalGame): boolean {
    const players = game.players.filter(p => p.role === 'player');
    const holdingPlayers = players.filter(p => p.isHoldingButton);
    
    console.log(`전체 플레이어: ${players.length}, 버튼 누르고 있는 플레이어: ${holdingPlayers.length}`);
    console.log('버튼 누르고 있는 플레이어들:', holdingPlayers.map(p => p.name));
    
    return players.length > 0 && players.every(p => p.isHoldingButton);
  }

  setPlayerReady(playerId: string): GlobalGame | undefined {
    const game = this.gameStateService.getGame();
    if (!game) return undefined;

    const player = game.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = true;
    }

    return game;
  }

  togglePlayerReady(playerId: string): GlobalGame | undefined {
    const game = this.gameStateService.getGame();
    if (!game) return undefined;

    const player = game.players.find(p => p.id === playerId);
    if (player && player.role === 'player') {
      player.isReady = !player.isReady;
    }

    return game;
  }

  areAllPlayersReady(game: GlobalGame): boolean {
    const players = game.players.filter(p => p.role === 'player');
    return players.every(p => p.isReady);
  }

  startRound(game: GlobalGame) {
    game.gameState.roundStartTime = Date.now();
    game.players.forEach(player => {
      if (player.role === 'player' && player.isReady) {
        player.isBidding = true;
      }
    });
  }

  placeBid(playerId: string): { bidTime: number } | undefined {
    const game = this.gameStateService.getGame();
    if (!game) return undefined;

    const player = game.players.find(p => p.id === playerId);
    if (!player || !player.isBidding || !game.gameState.roundStartTime) return undefined;

    // 라운드 시작 시간으로부터 경과 시간 계산
    const bidTime = Date.now() - game.gameState.roundStartTime;
    game.gameState.currentBids.set(playerId, bidTime);
    
    // 플레이어를 입찰 완료 상태로 변경
    player.isBidding = false;
    
    return { bidTime };
  }

  checkRoundEnd(game: GlobalGame): RoundResult | undefined {
    const activePlayers = game.players.filter(p => p.role === 'player');
    
    // 아직 입찰 중인 플레이어들 (버튼을 누르고 있는 플레이어들)
    const playersStillBidding = activePlayers.filter(p => p.isBidding || p.isHoldingButton);
    
    // 모든 플레이어가 입찰을 완료했거나 포기한 경우
    if (playersStillBidding.length === 0) {
      return this.determineRoundWinner(game);
    }

    return undefined;
  }

  private determineRoundWinner(game: GlobalGame): RoundResult {
    const activePlayers = game.players.filter(p => p.role === 'player');
    
    // 입찰한 플레이어들만 필터링
    const biddedPlayers = activePlayers.filter(p => 
      game.gameState.currentBids.has(p.id)
    );
  
    // 모든 입찰 정보 수집
    const bids = biddedPlayers.map(player => ({
      playerId: player.id,
      playerName: player.name,
      bidTime: game.gameState.currentBids.get(player.id) || 0
    }));

    let result: RoundResult;
  
    if (biddedPlayers.length === 0) {
      // 아무도 입찰하지 않은 경우 - 유찰
      result = {
        round: game.gameState.currentRound,
        isDraw: true,
        bids: []
      };
      console.log('유찰 - 아무도 입찰하지 않음');
    } else {
      // 가장 늦게 입찰한 시간 찾기
      const maxBidTime = Math.max(...bids.map(bid => bid.bidTime));
      
      // 가장 늦게 입찰한 플레이어들 찾기 (동점자 포함)
      const winnersWithMaxTime = biddedPlayers.filter(player => {
        const bidTime = game.gameState.currentBids.get(player.id) || 0;
        return Math.abs(bidTime - maxBidTime) < 1; // 1ms 오차 허용
      });
  
      console.log('최대 입찰 시간:', maxBidTime, '동점자 수:', winnersWithMaxTime.length);
  
      if (winnersWithMaxTime.length > 1) {
        // 동점인 경우 - 유찰 처리
        result = {
          round: game.gameState.currentRound,
          isDraw: true,
          bids,
        };
        console.log(`동점 유찰 - ${winnersWithMaxTime.length}명이 ${(maxBidTime/1000).toFixed(3)}초로 동점`);
      } else {
        // 단독 승리자
        const winner = winnersWithMaxTime[0];
        winner.wins++;
  
        result = {
          round: game.gameState.currentRound,
          winnerId: winner.id,
          winnerName: winner.name,
          winTime: maxBidTime / 1000, // 밀리초를 초로 변환
          isDraw: false,
          bids
        };
  
        console.log(`승리자: ${winner.name}, 입찰 시간: ${maxBidTime}ms`);
      }
    }
  
    // 라운드 결과를 히스토리에 저장

    const existingRound = game.gameState.roundHistory.find(
      h => h.round === result.round
    );
    
    if (!existingRound) {
      game.gameState.roundHistory.push(result);
      console.log(`라운드 ${result.round} 결과를 히스토리에 추가`);
    } else {
      console.log(`라운드 ${result.round} 이미 히스토리에 존재 - 추가하지 않음`);
    }
    
    return result;
  }

  // 시간 초과로 라운드 종료 (입찰하지 않은 플레이어들은 자동 탈락)
  endRoundByTimeout(game: GlobalGame): RoundResult {
    console.log('시간 초과로 라운드 종료');
    
    // 아직 입찰하지 않은 플레이어들을 입찰 완료로 처리 (단, 입찰 기록은 남기지 않음)
    game.players.forEach(player => {
      if (player.role === 'player' && (player.isBidding || player.isHoldingButton)) {
        player.isBidding = false;
        player.isHoldingButton = false;
        game.gameState.buttonPressStartTimes.delete(player.id);
        console.log(`플레이어 ${player.name} 시간 초과로 자동 종료`);
      }
    });

    return this.determineRoundWinner(game);
  }

  endGame(game: GlobalGame): GameResults {
    const players = game.players.filter(p => p.role === 'player');
    const sortedPlayers = [...players].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.remainingTime - a.remainingTime;
    });

    game.gameState.status = 'ended';
    
    return {
      winner: sortedPlayers[0],
      loser: sortedPlayers[sortedPlayers.length - 1],
      allPlayers: sortedPlayers,
      rounds: game.gameState.roundHistory
    };
  }
}