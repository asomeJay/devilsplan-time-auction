export interface Player {
    id: string;
    name: string;
    remainingTime: number;
    wins: number;
    isReady: boolean;
    isBidding: boolean;
    isHoldingButton: boolean;
    role: 'player' | 'display';
  }
  
  export interface GlobalGame {
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
    status: 'configuring' | 'waiting' | 'countdown' | 'playing' | 'roundEnd' | 'ended' | 'prepare';
    currentRound: number;
    countdownSeconds: number;
    roundStartTime?: number;
    buttonPressStartTimes: Map<string, number>;
    currentBids: Map<string, number>;
    roundHistory: RoundResult[];
    isWaitingForCountdown?: boolean;
    commonTimerStarted?: boolean;
    countdownStartTime?: number;
  }
  
  export interface RoundResult {
    round: number;
    winnerId?: string;
    winnerName?: string;
    winTime?: number;
    isDraw: boolean;
    bids: Array<{
      playerId: string;
      playerName: string;
      bidTime: number;
    }>;
  }
  
  export interface GameResults {
    winner: Player;
    loser: Player;
    allPlayers: Player[];
    rounds: RoundResult[];
  } 