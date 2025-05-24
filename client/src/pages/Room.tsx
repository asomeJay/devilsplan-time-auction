import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { Room as RoomType } from '../../../shared/types';

export default function Room() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [room, setRoom] = useState<RoomType | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // 방 정보 업데이트 이벤트들
    const handleRoomUpdate = (updatedRoom: RoomType) => {
      setRoom(updatedRoom);
      setIsHost(updatedRoom.hostId === socket.id);
      
      // 내 준비 상태 업데이트
      const myPlayer = updatedRoom.players.find(p => p.id === socket.id);
      if (myPlayer) {
        setIsReady(myPlayer.isReady);
      }
    };

    socket.on('room:updated', handleRoomUpdate);
    socket.on('room:created', handleRoomUpdate);
    socket.on('room:joined', handleRoomUpdate);

    socket.on('game:started', () => {
      navigate('/game');
    });

    // 컴포넌트 마운트 시 현재 방 정보 요청
    socket.emit('room:getInfo');

    return () => {
      socket.off('room:updated');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('game:started');
    };
  }, [socket, navigate]);

  const updateSettings = (key: string, value: number) => {
    if (!socket || !isHost) return;
    socket.emit('game:updateSettings', { [key]: value });
  };

  const toggleReady = () => {
    if (!socket) return;
    socket.emit('player:toggleReady');
  };

  const startGame = () => {
    if (!socket || !isHost) return;
    socket.emit('game:start');
  };

  if (!room) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  const players = room.players.filter(p => p.role === 'player');
  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h1 className="text-2xl font-bold mb-4">시간 경매 게임</h1>
          
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
                <div key={player.id} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                  <div className="flex items-center gap-3">
                    <span>{player.name}</span>
                    {player.role === 'player' && (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        player.isReady ? 'bg-green-600' : 'bg-red-600'
                      }`}>
                        {player.isReady ? '준비됨' : '대기중'}
                      </span>
                    )}
                    {player.id === room.hostId && (
                      <span className="px-2 py-1 bg-yellow-600 rounded-full text-xs">호스트</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">{player.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 플레이어용 준비 버튼 */}
          {room.players.find(p => p.id === socket?.id)?.role === 'player' && (
            <div className="mb-6">
              <button
                onClick={toggleReady}
                className={`w-full py-3 rounded-md font-medium ${
                  isReady 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isReady ? '준비 취소' : '준비 완료'}
              </button>
              {isHost && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  호스트도 준비를 완료해야 게임을 시작할 수 있습니다
                </p>
              )}
            </div>
          )}

          <div className="mb-6 bg-blue-900 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">🎯 게임 규칙</h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• 라운드가 시작되면 모든 플레이어가 입찰 버튼을 누를 수 있습니다</li>
              <li>• <strong>가장 늦게 입찰한 플레이어가 해당 라운드에서 승리</strong>합니다</li>
              <li>• 시간 제한 내에 입찰하지 않으면 자동으로 탈락됩니다</li>
              <li>• 아무도 입찰하지 않으면 유찰로 처리됩니다</li>
              <li>• 총 {room.settings.totalRounds}라운드 중 가장 많이 승리한 사람이 최종 우승자입니다</li>
            </ul>
          </div>

          {/* 디버깅 정보 */}
          <div className="mb-6 bg-gray-900 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">🔍 디버그 정보</h3>
            <div className="text-sm space-y-1 text-gray-300">
              <div>플레이어 수: {players.length}</div>
              <div>준비된 플레이어: {players.filter(p => p.isReady).length}</div>
              <div>모든 플레이어 준비됨: {allPlayersReady ? 'Yes' : 'No'}</div>
              <div>내 준비 상태: {isReady ? 'Ready' : 'Not Ready'}</div>
              <div>호스트 여부: {isHost ? 'Yes' : 'No'}</div>
            </div>
          </div>

          {/* 호스트용 게임 시작 버튼 */}
          {isHost && (
            <div className="space-y-2">
              {room.players.find(p => p.id === socket?.id)?.role === 'display' && (
                <div className="bg-blue-900 p-3 rounded-lg mb-4">
                  <p className="text-sm text-blue-300">
                    📺 전광판으로 참가하셨습니다. 게임을 진행하고 관리할 수 있습니다.
                  </p>
                </div>
              )}
              <button
                onClick={startGame}
                disabled={!allPlayersReady}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium"
              >
                게임 시작
              </button>
              {!allPlayersReady && (
                <p className="text-sm text-gray-400 text-center">
                  모든 플레이어가 준비되어야 게임을 시작할 수 있습니다 (최소 2명)
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}