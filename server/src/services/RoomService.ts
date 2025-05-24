import { Room, Player, GameSettings } from '../types';

export class RoomService {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map();

  createGlobalRoom(playerId: string, playerName: string, role: 'player' | 'display'): Room {
    const roomCode = 'global_game_room';
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

    const room: Room = {
      code: roomCode,
      players: [player],
      hostId: playerId,
      settings: {
        timePerPlayer: 600,
        totalRounds: 19
      },
      gameState: {
        status: 'waiting',
        currentRound: 0,
        countdownSeconds: 5,
        buttonPressStartTimes: new Map(),
        currentBids: new Map(),
        roundHistory: []
      }
    };

    this.rooms.set(roomCode, room);
    this.playerRoomMap.set(playerId, roomCode);
    return room;
  }

  createRoom(playerId: string, playerName: string, role: 'player' | 'display'): Room {
    const roomCode = this.generateRoomCode();
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

    const room: Room = {
      code: roomCode,
      players: [player],
      hostId: playerId,
      settings: {
        timePerPlayer: 600,
        totalRounds: 19
      },
      gameState: {
        status: 'waiting',
        currentRound: 0,
        countdownSeconds: 5,
        buttonPressStartTimes: new Map(),
        currentBids: new Map(),
        roundHistory: []
      }
    };

    this.rooms.set(roomCode, room);
    this.playerRoomMap.set(playerId, roomCode);
    return room;
  }

  joinRoom(roomCode: string, playerId: string, playerName: string, role: 'player' | 'display'): Room | undefined {
    const room = this.rooms.get(roomCode);
    if (!room) return undefined;

    // 이미 참가한 플레이어인지 확인
    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer) {
      // 이미 참가한 플레이어라면 정보만 업데이트
      existingPlayer.name = playerName;
      existingPlayer.role = role;
      this.playerRoomMap.set(playerId, roomCode);
      return room;
    }

    const player: Player = {
      id: playerId,
      name: playerName,
      remainingTime: room.settings.timePerPlayer,
      wins: 0,
      isReady: false,
      isBidding: false,
      isHoldingButton: false,
      role
    };

    room.players.push(player);
    this.playerRoomMap.set(playerId, roomCode);
    return room;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  updateSettings(roomCode: string, settings: Partial<GameSettings>): Room | undefined {
    const room = this.rooms.get(roomCode);
    if (!room) return undefined;

    room.settings = { ...room.settings, ...settings };
    
    // 모든 플레이어의 시간 업데이트
    room.players.forEach(player => {
      player.remainingTime = room.settings.timePerPlayer;
    });
    
    return room;
  }

  removePlayer(playerId: string): Room | undefined {
    const roomCode = this.playerRoomMap.get(playerId);
    if (!roomCode) return undefined;

    const room = this.rooms.get(roomCode);
    if (!room) return undefined;

    room.players = room.players.filter(p => p.id !== playerId);
    this.playerRoomMap.delete(playerId);

    // 글로벌 룸이 아닌 경우에만 빈 룸 삭제
    if (room.players.length === 0 && roomCode !== 'global_game_room') {
      this.rooms.delete(roomCode);
    }

    return room;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // 중복 확인
    if (this.rooms.has(result)) {
      return this.generateRoomCode();
    }
    
    return result;
  }
}