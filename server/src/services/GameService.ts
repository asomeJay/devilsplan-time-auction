import { Room, RoundResult, GameResults } from '../../../shared/types';

export class GameService {
  startGame(room: Room) {
    room.gameState.status = 'playing';
    room.gameState.currentRound = 1;
  }

  prepareNewRound(room: Room) {
    room.players.forEach(player => {
      player.isReady = false;
      player.isBidding = false;
    });
    room.gameState.currentBids.clear();
    room.gameState.status = 'playing';
  }

  setPlayerReady(roomCode: string, playerId: string): Room | null {
    // RoomService에서 room을 가져와야 하지만, 예시를 위해 단순화
    // 실제로는 RoomService 인스턴스를 주입받아 사용
    return null;
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
    // 입찰 시간 기록
    const bidTime = Date.now();
    // room.gameState.currentBids.set(playerId, bidTime);
    return { bidTime };
  }

  checkRoundEnd(room: Room): RoundResult | null {
    const activePlayers = room.players.filter(
      p => p.role === 'player' && p.isBidding && p.remainingTime > 0
    );

    // 한 명만 남았거나 모두 시간을 소진했을 때
    if (activePlayers.length <= 1) {
      const winner = activePlayers[0];
      
      if (winner) {
        winner.wins++;
        return {
          round: room.gameState.currentRound,
          winnerId: winner.id,
          winnerName: winner.name,
          isDraw: false
        };
      } else {
        return {
          round: room.gameState.currentRound,
          isDraw: true
        };
      }
    }

    return null;
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