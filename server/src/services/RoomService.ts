import { GlobalGame, Player, GameSettings } from '../types';

export class GameStateService {
  private globalGame: GlobalGame | null = null;
  private playerGameMap: Map<string, boolean> = new Map(); // 플레이어가 게임에 참여했는지 추적

  createOrJoinGame(playerId: string, playerName: string, role: 'player' | 'display'): GlobalGame {
    // 글로벌 게임이 없으면 생성
    if (!this.globalGame) {
      const player: Player = {
        id: playerId,
        name: playerName,
        remainingTime: 600, // 10분
        wins: 0,
        isReady: false,
        isBidding: false,
        isHoldingButton: false,
        role
      };

      this.globalGame = {
        players: [player],
        hostId: playerId,
        settings: {
          timePerPlayer: 600,
          totalRounds: 19
        },
        gameState: {
          status: 'configuring',
          currentRound: 0,
          countdownSeconds: 5,
          buttonPressStartTimes: new Map(),
          currentBids: new Map(),
          roundHistory: []
        }
      };

      this.playerGameMap.set(playerId, true);
      return this.globalGame;
    }

    // 이미 참가한 플레이어인지 확인
    const existingPlayer = this.globalGame.players.find(p => p.id === playerId);
    if (existingPlayer) {
      // 이미 참가한 플레이어라면 정보만 업데이트
      existingPlayer.name = playerName;
      existingPlayer.role = role;
      this.playerGameMap.set(playerId, true);
      return this.globalGame;
    }

    // 새 플레이어 추가
    const player: Player = {
      id: playerId,
      name: playerName,
      remainingTime: this.globalGame.settings.timePerPlayer,
      wins: 0,
      isReady: false,
      isBidding: false,
      isHoldingButton: false,
      role
    };

    this.globalGame.players.push(player);
    this.playerGameMap.set(playerId, true);
    return this.globalGame;
  }

  getGame(): GlobalGame | null {
    return this.globalGame;
  }

  updateSettings(settings: Partial<GameSettings>): GlobalGame | null {
    if (!this.globalGame) return null;

    this.globalGame.settings = { ...this.globalGame.settings, ...settings };
    
    // 모든 플레이어의 시간 업데이트
    this.globalGame.players.forEach(player => {
      player.remainingTime = this.globalGame!.settings.timePerPlayer;
    });
    
    return this.globalGame;
  }

  removePlayer(playerId: string): GlobalGame | null {
    if (!this.globalGame) return null;

    this.globalGame.players = this.globalGame.players.filter(p => p.id !== playerId);
    this.playerGameMap.delete(playerId);

    // 모든 플레이어가 나가면 게임 상태 리셋
    if (this.globalGame.players.length === 0) {
      this.globalGame = null;
    }

    return this.globalGame;
  }
}