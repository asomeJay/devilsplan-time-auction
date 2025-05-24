import { GlobalGame, RoundResult, GameResults } from '../types';
import { GameStateService } from './RoomService';

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

  // 플레이어들의 사용한 시간 업데이트 (실시간으로 호출됨)
  // 이 함수는 UI 표시용으로만 사용하고, 실제 시간 차감은 endButtonPress에서 수행
  updatePlayerTimes(game: GlobalGame): void {
    // 실시간 업데이트는 클라이언트 표시용으로만 사용
    // 실제 정확한 시간 계산은 endButtonPress에서 수행됨
    const currentTime = Date.now();
    
    game.players.forEach(player => {
      if (player.role === 'player' && player.isHoldingButton && player.isBidding) {
        const buttonPressStartTime = game.gameState.buttonPressStartTimes.get(player.id);
        if (buttonPressStartTime) {
          const elapsedTime = (currentTime - buttonPressStartTime) / 1000; // 초 단위
          
          // 표시용으로만 업데이트 (실제 차감은 하지 않음)
          // endButtonPress에서 정확한 계산 수행
        }
      }
    });
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
        player.isBidding = true;
        // 입찰 시작 시간을 다시 기록 (정확한 입찰 시간 계산을 위해)
        game.gameState.buttonPressStartTimes.set(player.id, Date.now());
        console.log(`플레이어 ${player.name} 입찰 상태로 전환`);
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

    console.log(`플레이어 ${player.name} 버튼 릴리즈. 현재 상태:`, {
      isHoldingButton: player.isHoldingButton,
      isBidding: player.isBidding,
      remainingTime: player.remainingTime,
      isWaitingForCountdown: game.gameState.isWaitingForCountdown,
      commonTimerStarted: game.gameState.commonTimerStarted
    });

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
      
      // 이번 입찰에서 실제 사용한 시간 계산
      const timeUsedThisPress = (currentTime - buttonPressStartTime) / 1000; // 초 단위
      
      // 플레이어가 가진 시간으로 입찰 시간 제한
      // 만약 사용한 시간이 남은 시간을 초과하면, 남은 시간만큼만 입찰 시간으로 인정
      let effectiveBidTime: number;
      let playerTimeExhausted = false;
      
      if (timeUsedThisPress > player.remainingTime) {
        // 시간을 초과한 경우: 남은 시간만큼만 입찰 시간으로 인정
        effectiveBidTime = Math.max(player.remainingTime * 1000, 100); // 최소 0.1초는 보장
        playerTimeExhausted = true;
        
        // 플레이어의 남은 시간을 0으로 설정
        player.remainingTime = 0;
      } else {
        // 시간 내에 입찰한 경우: 실제 입찰 시간 사용
        effectiveBidTime = actualBidTime;
        
        // 플레이어의 남은 시간에서 사용한 시간 차감
        player.remainingTime = Math.max(0, player.remainingTime - timeUsedThisPress);
      }
      
      game.gameState.currentBids.set(playerId, effectiveBidTime);
      
      // 플레이어 상태 업데이트
      player.isHoldingButton = false;
      player.isBidding = false;
      game.gameState.buttonPressStartTimes.delete(playerId);
      
      console.log(`플레이어 ${player.name} 입찰 완료:`, {
        actualBidTime: actualBidTime,
        timeUsedThisPress: timeUsedThisPress,
        effectiveBidTime: effectiveBidTime,
        timeExhausted: playerTimeExhausted,
        remainingTimeAfter: player.remainingTime
      });
      
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
    
    console.log(`라운드 종료 체크:`, {
      totalPlayers: activePlayers.length,
      stillBidding: playersStillBidding.length,
      bidsReceived: game.gameState.currentBids.size
    });
    
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

    console.log('라운드 결과 계산:', {
      totalPlayers: activePlayers.length,
      biddedPlayers: biddedPlayers.length,
      bids: bids.map(b => ({ name: b.playerName, time: b.bidTime }))
    });

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
      // 가장 늦게 입찰한 플레이어 찾기 (가장 큰 bidTime)
      let latestBidder = biddedPlayers[0];
      let latestBidTime = game.gameState.currentBids.get(latestBidder.id) || 0;

      biddedPlayers.forEach(player => {
        const bidTime = game.gameState.currentBids.get(player.id) || 0;
        if (bidTime > latestBidTime) {
          latestBidder = player;
          latestBidTime = bidTime;
        }
      });

      // 승리자의 승수 증가
      latestBidder.wins++;

      result = {
        round: game.gameState.currentRound,
        winnerId: latestBidder.id,
        winnerName: latestBidder.name,
        winTime: latestBidTime / 1000, // 밀리초를 초로 변환
        isDraw: false,
        bids
      };

      console.log(`승리자: ${latestBidder.name}, 입찰 시간: ${latestBidTime}ms`);
    }

    // 라운드 결과를 히스토리에 저장
    game.gameState.roundHistory.push(result);
    
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

    return {
      winner: sortedPlayers[0],
      loser: sortedPlayers[sortedPlayers.length - 1],
      allPlayers: sortedPlayers,
      rounds: game.gameState.roundHistory
    };
  }
}