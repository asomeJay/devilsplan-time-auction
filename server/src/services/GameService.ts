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
  }

  // 버튼 누르기 시작
  startButtonPress(roomCode: string, playerId: string): Room | null {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player && player.role === 'player') {
      player.isHoldingButton = true;
      
      // 모든 플레이어가 버튼을 누르고 있는지 확인
      if (this.areAllPlayersHoldingButton(room)) {
        // 라운드 시작 시간 기록
        room.gameState.roundStartTime = Date.now();
        // 각 플레이어의 버튼 누르기 시작 시간 기록
        room.players.forEach(p => {
          if (p.role === 'player' && p.isHoldingButton) {
            room.gameState.buttonPressStartTimes.set(p.id, Date.now());
          }
        });
      }
    }

    return room;
  }

  // 버튼 누르기 종료 (입찰)
  endButtonPress(roomCode: string, playerId: string): { bidTime: number } | null {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.isHoldingButton || !room.gameState.roundStartTime) return null;

    // 버튼 누르기 시작 시간 가져오기
    const startTime = room.gameState.buttonPressStartTimes.get(playerId);
    if (!startTime) return null;

    // 입찰 시간 계산 (버튼을 누르고 있었던 시간)
    const bidTime = Date.now() - startTime;
    room.gameState.currentBids.set(playerId, bidTime);
    
    // 플레이어 상태 업데이트
    player.isHoldingButton = false;
    player.isBidding = false;
    
    return { bidTime };
  }

  // 모든 플레이어가 버튼을 누르고 있는지 확인
  areAllPlayersHoldingButton(room: Room): boolean {
    const players = room.players.filter(p => p.role === 'player');
    return players.length > 0 && players.every(p => p.isHoldingButton);
  }

  setPlayerReady(roomCode: string, playerId: string): Room | null {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = true;
    }

    return room;
  }

  togglePlayerReady(roomCode: string, playerId: string): Room | null {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return null;

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

  placeBid(roomCode: string, playerId: string): { bidTime: number } | null {
    const room = this.roomService.getRoom(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.isBidding || !room.gameState.roundStartTime) return null;

    // 라운드 시작 시간으로부터 경과 시간 계산
    const bidTime = Date.now() - room.gameState.roundStartTime;
    room.gameState.currentBids.set(playerId, bidTime);
    
    // 플레이어를 입찰 완료 상태로 변경
    player.isBidding = false;
    
    return { bidTime };
  }

  checkRoundEnd(room: Room): RoundResult | null {
    const activePlayers = room.players.filter(p => p.role === 'player');
    
    // 모든 플레이어가 입찰을 완료했는지 확인 (버튼에서 손을 뗐는지)
    const playersStillHolding = activePlayers.filter(p => p.isHoldingButton);
    
    if (playersStillHolding.length === 0) {
      return this.determineRoundWinner(room);
    }

    return null;
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

    let result: RoundResult;

    if (biddedPlayers.length === 0) {
      // 아무도 입찰하지 않은 경우 - 유찰
      result = {
        round: room.gameState.currentRound,
        isDraw: true,
        bids: []
      };
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
    }

    // 라운드 결과를 히스토리에 저장
    room.gameState.roundHistory.push(result);
    
    return result;
  }

  // 시간 초과로 라운드 종료 (입찰하지 않은 플레이어들은 자동 탈락)
  endRoundByTimeout(room: Room): RoundResult {
    // 아직 입찰하지 않은 플레이어들을 입찰 완료로 처리 (단, 입찰 기록은 남기지 않음)
    room.players.forEach(player => {
      if (player.role === 'player' && player.isBidding) {
        player.isBidding = false;
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
      rounds: [] // 실제로는 라운드 결과를 저장해야 함
    };
  }
}