import { Room, Player, GameSettings } from '../../../shared/types';

export class RoomService {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map();

  createRoom(playerId: string, playerName: string, role: 'player' | 'display'): Room {
    const roomCode = this.generateRoomCode();
    const player: Player = {
      id: playerId,
      name: playerName,
      remainingTime: 600, // 10분
      wins: 0,
      isReady: false,
      isBidding: false,
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
        currentBids: new Map()
      }
    };

    this.rooms.set(roomCode, room);
    this.playerRoomMap.set(playerId, roomCode);
    return room;
  }

  joinRoom(roomCode: string, playerId: string, playerName: string, role: 'player' | 'display'): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player: Player = {
      id: playerId,
      name: playerName,
      remainingTime: room.settings.timePerPlayer,
      wins: 0,
      isReady: false,
      isBidding: false,
      role
    };

    room.players.push(player);
    this.playerRoomMap.set(playerId, roomCode);
    return room;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  updateSettings(roomCode: string, settings: Partial<GameSettings>): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.settings = { ...room.settings, ...settings };
    
    // 모든 플레이어의 시간 업데이트
    room.players.forEach(player => {
      player.remainingTime = room.settings.timePerPlayer;
    });
    
    return room;
  }

  removePlayer(playerId: string): Room | null {
    const roomCode = this.playerRoomMap.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.players = room.players.filter(p => p.id !== playerId);
    this.playerRoomMap.delete(playerId);

    // 룸이 비었으면 삭제
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
    }

    return room;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}