import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [role, setRole] = useState<'player' | 'display'>('player');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { socket, connected } = useSocket();

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
    if (!playerName.trim() || !roomCode.trim() || !socket) {
      setError('이름과 룸 코드를 모두 입력해주세요.');
      return;
    }

    if (!connected) {
      setError('서버에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsJoining(true);
    setError('');

    console.log('방 참가 시도:', { roomCode: roomCode.toUpperCase(), playerName, role });

    socket.emit('room:join', roomCode.toUpperCase(), playerName, role);
    
    const joinTimeout = setTimeout(() => {
      setIsJoining(false);
      setError('방 참가 요청이 시간 초과되었습니다.');
    }, 5000);

    socket.once('room:joined', (room) => {
      clearTimeout(joinTimeout);
      setIsJoining(false);
      console.log('방 참가 성공:', room);
      if (role === 'display') {
        navigate(`/display/${room.code}`);
      } else {
        navigate(`/room/${room.code}`);
      }
    });

    socket.once('error', (errorMessage) => {
      clearTimeout(joinTimeout);
      setIsJoining(false);
      setError(errorMessage || '방 참가에 실패했습니다.');
      console.error('방 참가 에러:', errorMessage);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">시간경매</h1>
          <p className="text-gray-400">Time Auction Game</p>
          <p className="text-sm text-gray-500 mt-2">가장 늦게 입찰한 사람이 승리하는 치킨 게임</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg space-y-4">
          {!connected && (
            <div className="bg-red-600 p-3 rounded-md text-center">
              서버에 연결되지 않았습니다.
            </div>
          )}
          
          {error && (
            <div className="bg-red-600 p-3 rounded-md text-center">
              {error}
            </div>
          )}

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
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="radio"
                    value="player"
                    checked={role === 'player'}
                    onChange={(e) => setRole(e.target.value as 'player')}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 mr-2 flex items-center justify-center ${
                    role === 'player' 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-gray-500 bg-transparent'
                  }`}>
                    {role === 'player' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                </div>
                플레이어
              </label>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="radio"
                    value="display"
                    checked={role === 'display'}
                    onChange={(e) => setRole(e.target.value as 'display')}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 mr-2 flex items-center justify-center ${
                    role === 'display' 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-gray-500 bg-transparent'
                  }`}>
                    {role === 'display' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                </div>
                전광판 (게임 진행자)
              </label>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {role === 'display' 
                ? "게임 화면을 표시하고 호스트가 되어 게임을 관리합니다"
                : "게임에 직접 참여하여 입찰합니다"
              }
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
                disabled={isJoining}
              />
              <button
                onClick={joinRoom}
                disabled={isJoining || !connected}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium"
              >
                {isJoining ? '참가 중...' : '방 참가하기'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}