export interface Player {
    id: string;
    name: string;
    remainingTime: number;
    wins: number;
    isReady: boolean;
    isBidding: boolean;
    role: 'player' | 'display';
  }
  
  export interface Room {
    code: string;
    players: Player[];
    hostId: string;
    settings: GameSettings;
    gameState: GameState;
  }
  
  export interface GameSettings {
    timePerPlayer: number;
    totalRounds: number;
  }
  
  export interface GameState {
    status: 'waiting' | 'countdown' | 'playing' | 'roundEnd' | 'ended';
    currentRound: number;
    countdownSeconds: number;
    roundStartTime?: number;
    currentBids: Map<string, number>;
  }
  
  export interface RoundResult {
    round: number;
    winnerId?: string;
    winnerName?: string;
    winTime?: number;
    isDraw: boolean;
  }
  
  export interface GameResults {
    winner: Player;
    loser: Player;
    allPlayers: Player[];
    rounds: RoundResult[];
  }