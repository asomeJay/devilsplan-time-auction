import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { Room as RoomType } from '../../../shared/types';

export default function Room() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [room, setRoom] = useState<RoomType | null>(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on('room:updated', (updatedRoom: RoomType) => {
      setRoom(updatedRoom);
      setIsHost(updatedRoom.hostId === socket.id);
    });

    socket.on('game:started', () => {
      navigate(`/game/${roomCode}`);
    });

    return () => {
      socket.off('room:updated');
      socket.off('game:started');
    };
  }, [socket, roomCode, navigate]);

  const updateSettings = (key: string, value: number) => {
    if (!socket || !isHost) return;
    socket.emit('game:updateSettings', roomCode, { [key]: value });
  };

  const startGame = () => {
    if (!socket || !isHost) return;
    socket.emit('game:start', roomCode);
  };

  if (!room) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h1 className="text-2xl font-bold mb-4">룸 코드: {roomCode}</h1>
          
          {isHost && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  1인당 제공 시간 (초)
                </label>
                <input
                  type="number"
                  value={room.settings.timePerPlayer}
                  onChange={(e) => updateSettings('timePerPlayer', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  총 라운드 수
                </label>
                <input
                  type="number"
                  value={room.settings.totalRounds}
                  onChange={(e) => updateSettings('totalRounds', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 rounded-md"
                />
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">참가자 목록</h2>
            <div className="space-y-2">
              {room.players.map((player) => (
                <div key={player.id} className="flex justify-between bg-gray-700 p-3 rounded">
                  <span>{player.name}</span>
                  <span className="text-sm text-gray-400">{player.role}</span>
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <button
              onClick={startGame}
              disabled={room.players.length < 3}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md font-medium"
            >
              게임 시작
            </button>
          )}
        </div>
      </div>
    </div>
  );
}