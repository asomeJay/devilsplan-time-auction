import { Room, RoundResult, GameResults } from '../types';
import { RoomService } from './RoomService';

export class GameService {
  constructor(private roomService: RoomService) {}

  startGame(room: Room) {
    room.gameState.status = 'playing';
    room.gameState.currentRound = 0;
    room.gameState.currentBids.clear();
    room.gameState.buttonPressStartTimes.clear();
    room.gameState.roundStartTime = undefined;
    room.gameState.roundHistory = [];
    room.gameState.isWaitingForCountdown = false;
    room.gameState.commonTimerStarted = false;
    
    // 모든 플레이어 상태 초기화
    room.players.forEach(player => {
      if (player.role === 'player') {
        player.isReady = false;
        player.isBidding = false;
        player.isHoldingButton = false;
        player.wins = 0;
      }
    });
  }

  prepareNewRound(room: Room) {
    room.players.forEach(player => {
      player.isReady = false;
      player.isBidding = false;
      player.isHoldingButton = false;
    });
    room.gameState.currentBids.clear();
    room.gameState.buttonPressStartTimes.clear();
    room.gameState.status = 'playing';
    room.gameState.isWaitingForCountdown = false;
    room.gameState.commonTimerStarted = false;
    room.gameState.roundStartTime = undefined;
    room.gameState.countdownStartTime = undefined;
  }

  // 버튼 누르기 시작
  startButtonPress(roomCode: string, playerId: string): { shouldStartCountdown: boolean, room: Room } | undefined {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return undefined;

    const player = room.players.find(p => p.id === playerId);
    if (player && player.role === 'player') {
      player.isHoldingButton = true;
      console.log(`플레이어 ${player.name} (${playerId}) 버튼 누르기 시작`);
      
      // 모든 플레이어가 버튼을 누르고 있는지 확인
      if (this.areAllPlayersHoldingButton(room) && !room.gameState.isWaitingForCountdown && !room.gameState.commonTimerStarted) {
        // 5초 카운트다운 시작
        room.gameState.isWaitingForCountdown = true;
        room.gameState.countdownStartTime = Date.now(); // 카운트다운 시작 시간 기록
        console.log(`모든 플레이어가 버튼을 누름. 카운트다운 시작`);
        return { shouldStartCountdown: true, room };
      }
    }

    return { shouldStartCountdown: false, room };
  }

  // 5초 카운트다운 후 공통 타이머 시작
  startCommonTimer(roomCode: string): { room: Room, playersStillHolding: string[] } | undefined {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return undefined;

    // 카운트다운이 끝난 시점에서 여전히 버튼을 누르고 있는 플레이어들 확인
    const playersStillHolding = room.players
      .filter(p => p.role === 'player' && p.isHoldingButton)
      .map(p => p.id);

    console.log(`카운트다운 종료. 여전히 버튼을 누르고 있는 플레이어들:`, playersStillHolding);

    // 공통 타이머 시작
    room.gameState.roundStartTime = Date.now();
    room.gameState.commonTimerStarted = true;
    room.gameState.isWaitingForCountdown = false;

    // 여전히 버튼을 누르고 있는 플레이어들을 입찰 상태로 전환
    room.players.forEach(player => {
      if (player.role === 'player' && player.isHoldingButton) {
        player.isBidding = true;
        console.log(`플레이어 ${player.name} 입찰 상태로 전환`);
      } else if (player.role === 'player') {
        // 버튼을 누르지 않고 있는 플레이어는 이미 포기한 상태
        console.log(`플레이어 ${player.name} 이미 포기함`);
      }
    });

    return { room, playersStillHolding };
  }

  // 버튼 누르기 종료 (입찰 또는 포기)
  endButtonPress(roomCode: string, playerId: string): { bidTime?: number, isGiveUp?: boolean } | undefined {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return undefined;

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      console.log(`플레이어 ${playerId} 찾을 수 없음`);
      return undefined;
    }

    console.log(`플레이어 ${player.name} 버튼 릴리즈. 현재 상태:`, {
      isHoldingButton: player.isHoldingButton,
      isBidding: player.isBidding,
      isWaitingForCountdown: room.gameState.isWaitingForCountdown,
      commonTimerStarted: room.gameState.commonTimerStarted
    });

    // 카운트다운 중에 손을 뗀 경우 = 입찰 포기
    if (room.gameState.isWaitingForCountdown && room.gameState.countdownStartTime) {
      player.isHoldingButton = false;
      player.isBidding = false;
      console.log(`플레이어 ${player.name} 입찰 포기 (카운트다운 중 버튼 릴리즈)`);
      return { isGiveUp: true };
    }
    // 공통 타이머가 시작된 후에 손을 뗀 경우 = 입찰
    else if (room.gameState.commonTimerStarted && room.gameState.roundStartTime && player.isBidding) {
      const bidTime = Date.now() - room.gameState.roundStartTime;
      room.gameState.currentBids.set(playerId, bidTime);
      
      // 플레이어 상태 업데이트
      player.isHoldingButton = false;
      player.isBidding = false;
      
      console.log(`플레이어 ${player.name} 입찰 완료: ${bidTime}ms`);
      return { bidTime };
    }
    // 그 외의 경우는 단순히 버튼 상태만 해제 (준비 단계에서 놓기)
    else {
      player.isHoldingButton = false;
      player.isBidding = false;
      console.log(`플레이어 ${player.name} 버튼 상태 해제 (준비 단계)`);
      return undefined;
    }
  }

  // 모든 플레이어가 버튼을 누르고 있는지 확인
  areAllPlayersHoldingButton(room: Room): boolean {
    const players = room.players.filter(p => p.role === 'player');
    const holdingPlayers = players.filter(p => p.isHoldingButton);
    
    console.log(`전체 플레이어: ${players.length}, 버튼 누르고 있는 플레이어: ${holdingPlayers.length}`);
    console.log('버튼 누르고 있는 플레이어들:', holdingPlayers.map(p => p.name));
    
    return players.length > 0 && players.every(p => p.isHoldingButton);
  }

  setPlayerReady(roomCode: string, playerId: string): Room | undefined {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return undefined;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = true;
    }

    return room;
  }

  togglePlayerReady(roomCode: string, playerId: string): Room | undefined {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return undefined;

    const player = room.players.find(p => p.id === playerId);
    if (player && player.role === 'player') {
      player.isReady = !player.isReady;
    }

    return room;
  }

  areAllPlayersReady(room: Room): boolean {
    const players = room.players.filter(p => p.role === 'player');
    return players.every(p => p.isReady);
  }

  startRound(room: Room) {
    room.gameState.roundStartTime = Date.now();
    room.players.forEach(player => {
      if (player.role === 'player' && player.isReady) {
        player.isBidding = true;
      }
    });
  }

  placeBid(roomCode: string, playerId: string): { bidTime: number } | undefined {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return undefined;

    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.isBidding || !room.gameState.roundStartTime) return undefined;

    // 라운드 시작 시간으로부터 경과 시간 계산
    const bidTime = Date.now() - room.gameState.roundStartTime;
    room.gameState.currentBids.set(playerId, bidTime);
    
    // 플레이어를 입찰 완료 상태로 변경
    player.isBidding = false;
    
    return { bidTime };
  }

  checkRoundEnd(room: Room): RoundResult | undefined {
    const activePlayers = room.players.filter(p => p.role === 'player');
    
    // 아직 입찰 중인 플레이어들 (버튼을 누르고 있는 플레이어들)
    const playersStillBidding = activePlayers.filter(p => p.isBidding || p.isHoldingButton);
    
    console.log(`라운드 종료 체크:`, {
      totalPlayers: activePlayers.length,
      stillBidding: playersStillBidding.length,
      bidsReceived: room.gameState.currentBids.size
    });
    
    // 모든 플레이어가 입찰을 완료했거나 포기한 경우
    if (playersStillBidding.length === 0) {
      return this.determineRoundWinner(room);
    }

    return undefined;
  }

  private determineRoundWinner(room: Room): RoundResult {
    const activePlayers = room.players.filter(p => p.role === 'player');
    
    // 입찰한 플레이어들만 필터링
    const biddedPlayers = activePlayers.filter(p => 
      room.gameState.currentBids.has(p.id)
    );

    // 모든 입찰 정보 수집
    const bids = biddedPlayers.map(player => ({
      playerId: player.id,
      playerName: player.name,
      bidTime: room.gameState.currentBids.get(player.id) || 0
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
        round: room.gameState.currentRound,
        isDraw: true,
        bids: []
      };
      console.log('유찰 - 아무도 입찰하지 않음');
    } else {
      // 가장 늦게 입찰한 플레이어 찾기 (가장 큰 bidTime)
      let latestBidder = biddedPlayers[0];
      let latestBidTime = room.gameState.currentBids.get(latestBidder.id) || 0;

      biddedPlayers.forEach(player => {
        const bidTime = room.gameState.currentBids.get(player.id) || 0;
        if (bidTime > latestBidTime) {
          latestBidder = player;
          latestBidTime = bidTime;
        }
      });

      // 승리자의 승수 증가
      latestBidder.wins++;

      result = {
        round: room.gameState.currentRound,
        winnerId: latestBidder.id,
        winnerName: latestBidder.name,
        winTime: latestBidTime / 1000, // 밀리초를 초로 변환
        isDraw: false,
        bids
      };

      console.log(`승리자: ${latestBidder.name}, 입찰 시간: ${latestBidTime}ms`);
    }

    // 라운드 결과를 히스토리에 저장
    room.gameState.roundHistory.push(result);
    
    return result;
  }

  // 시간 초과로 라운드 종료 (입찰하지 않은 플레이어들은 자동 탈락)
  endRoundByTimeout(room: Room): RoundResult {
    console.log('시간 초과로 라운드 종료');
    
    // 아직 입찰하지 않은 플레이어들을 입찰 완료로 처리 (단, 입찰 기록은 남기지 않음)
    room.players.forEach(player => {
      if (player.role === 'player' && (player.isBidding || player.isHoldingButton)) {
        player.isBidding = false;
        player.isHoldingButton = false;
        console.log(`플레이어 ${player.name} 시간 초과로 자동 종료`);
      }
    });

    return this.determineRoundWinner(room);
  }

  endGame(room: Room): GameResults {
    const players = room.players.filter(p => p.role === 'player');
    const sortedPlayers = [...players].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.remainingTime - a.remainingTime;
    });

    return {
      winner: sortedPlayers[0],
      loser: sortedPlayers[sortedPlayers.length - 1],
      allPlayers: sortedPlayers,
      rounds: room.gameState.roundHistory
    };
  }
}