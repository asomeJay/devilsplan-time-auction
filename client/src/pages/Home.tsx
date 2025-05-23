import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [role, setRole] = useState<'player' | 'display'>('player');
  const navigate = useNavigate();
  const { socket } = useSocket();

  const createRoom = () => {
    if (!playerName.trim() || !socket) return;

    socket.emit('room:create', playerName, role);
    socket.once('room:created', (room) => {
      if (role === 'display') {
        navigate(`/display/${room.code}`);
      } else {
        navigate(`/room/${room.code}`);
      }
    });
  };

  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim() || !socket) return;

    socket.emit('room:join', roomCode.toUpperCase(), playerName, role);
    socket.once('room:joined', (room) => {
      if (role === 'display') {
        navigate(`/display/${room.code}`);
      } else {
        navigate(`/room/${room.code}`);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">시간경매</h1>
          <p className="text-gray-400">Time Auction Game</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">이름</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-md"
              placeholder="플레이어 이름"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">역할 선택</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="player"
                  checked={role === 'player'}
                  onChange={(e) => setRole(e.target.value as 'player')}
                  className="mr-2"
                />
                플레이어
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="display"
                  checked={role === 'display'}
                  onChange={(e) => setRole(e.target.value as 'display')}
                  className="mr-2"
                />
                전광판
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={createRoom}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium"
            >
              방 만들기
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">또는</span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded-md"
                placeholder="룸 코드 입력"
              />
              <button
                onClick={joinRoom}
                className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-md font-medium"
              >
                방 참가하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}