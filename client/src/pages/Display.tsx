import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function Display() {
  const { socket } = useSocket();
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [currentRound, setCurrentRound] = useState(1);
  const [countdown, setCountdown] = useState(-1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [playerBids, setPlayerBids] = useState<Map<string, number>>(new Map());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Display로 게임 룸에 참여
    socket.emit('game:rejoin');

    socket.on('room:updated', (room: any) => {
      setRoom(room);
      setPlayers(room.players.filter((p: any) => p.role === 'player'));
      setIsHost(room.hostId === socket.id);
      setRoundHistory(room.gameState?.roundHistory || []);
    });

    socket.on('room:joined', (room: any) => {
      setRoom(room);
      setPlayers(room.players.filter((p: any) => p.role === 'player'));
      setIsHost(room.hostId === socket.id);
      setRoundHistory(room.gameState?.roundHistory || []);
    });

    socket.on('round:prepare', (round: number) => {
      setCurrentRound(round);
      setGameStatus('prepare');
      setElapsedTime(0);
      setRoundResult(null);
      setPlayerBids(new Map());
    });

    socket.on('game:countdown', (seconds: number) => {
      setCountdown(seconds);
      if (seconds === 0) {
        setGameStatus('playing');
      }
    });

    socket.on('time:update', (time: number) => {
      setElapsedTime(time);
    });

    socket.on('player:bid', (data: { playerId: string, playerName: string, bidTime: number }) => {
      setPlayerBids(prev => new Map(prev.set(data.playerId, data.bidTime / 1000)));
    });

    socket.on('round:ended', (result: any) => {
      setRoundResult(result);
      setGameStatus('roundEnd');
      setRoundHistory(prev => [...prev, result]);
    });

    socket.on('room:updated', (room: any) => {
      console.log('room:updated', room);
      console.log('room.players', room.players);
      console.log('room.gameState', room.gameState);
    });

    socket.on('player:gaveup', (player: any) => {
      console.log('player:gaveup', player);
    });

    return () => {
      socket.off('room:updated');
      socket.off('room:joined');
      socket.off('round:prepare');
      socket.off('game:countdown');
      socket.off('time:update');
      socket.off('player:bid');
      socket.off('round:ended');
    };
  }, [socket]);

  const updateSettings = (key: string, value: number) => {
    if (!socket || !isHost) return;
    socket.emit('game:updateSettings', { [key]: value });
  };

  const startGame = () => {
    if (!socket || !isHost) return;
    socket.emit('game:start');
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-2xl">연결 중...</div>
      </div>
    );
  }

  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* 호스트 컨트롤 패널 */}
      {isHost && gameStatus === 'waiting' && (
        <div className="bg-gray-900 p-4 border-b border-gray-700">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">호스트 제어판</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  1인당 제공 시간 (초)
                </label>
                <input
                  type="number"
                  value={room.settings.timePerPlayer}
                  onChange={(e) => updateSettings('timePerPlayer', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 rounded-md text-white"
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
                  className="w-full px-3 py-2 bg-gray-700 rounded-md text-white"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={startGame}
                  disabled={!allPlayersReady}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium"
                >
                  게임 시작
                </button>
              </div>
            </div>

            {!allPlayersReady && (
              <p className="text-sm text-gray-400 text-center">
                모든 플레이어가 준비되어야 게임을 시작할 수 있습니다 (최소 2명)
              </p>
            )}

            {/* 플레이어 준비 상태 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {players.map((player) => (
                <>  
                <div>{JSON.stringify(player)}</div>
                <div key={player.id} className={`p-2 rounded text-center text-sm ${
                  player.isReady ? 'bg-green-600' : 'bg-red-600'
                }`}>
                  <div className="font-medium">{player.name}</div>
                  <div className="text-xs">{player.isReady ? '준비됨' : '대기중'}</div>
                </div>
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 메인 게임 화면 */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8">라운드 {currentRound}</h1>

          {gameStatus === 'waiting' && !isHost && (
            <div className="text-3xl text-gray-400">
              호스트가 게임을 시작하기를 기다리는 중...
            </div>
          )}

          {gameStatus === 'prepare' && countdown > 0 && (
            <div className="text-9xl font-bold text-yellow-400">
              {countdown}
            </div>
          )}

          {/* ✅ 새로 추가: 준비 단계에서 버튼 누르기 상태 표시 */}
          {gameStatus === 'prepare' && countdown === -1 && (
            <div className="space-y-6">
              <div className="text-4xl text-yellow-400">
                모든 플레이어가 버튼을 누르면 게임이 시작됩니다
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {players.map((player) => (
                  <div 
                    key={player.id} 
                    className={`p-4 rounded-lg text-center transition-all ${
                      player.isHoldingButton 
                        ? 'bg-green-600 border-2 border-green-400' 
                        : 'bg-red-600 border-2 border-red-400'
                    }`}
                  >
                    <div className="text-lg font-bold">{player.name}</div>
                    <div className="text-sm mt-1">
                      {player.isHoldingButton ? '✅ 준비됨' : '❌ 대기중'}
                    </div>
                    <div className={`w-3 h-3 rounded-full mx-auto mt-2 ${
                      player.isHoldingButton ? 'bg-green-300' : 'bg-red-300'
                    }`} />
                  </div>
                ))}
              </div>
              
              <div className="text-2xl text-gray-400">
                {players.filter(p => p.isHoldingButton).length} / {players.length} 플레이어 준비됨
              </div>
            </div>
          )}

          {gameStatus === 'playing' && (
            <div className="space-y-8">
              <div className="text-6xl font-mono">
                {elapsedTime.toFixed(1)}s
              </div>
            </div>
          )}

          {gameStatus === 'roundEnd' && roundResult && (
            <div className="space-y-6">
              {roundResult.isDraw ? (
                <div>
                  <div className="text-6xl mb-4">⚖️</div>
                  <div className="text-4xl">유찰</div>
                  <div className="text-2xl text-gray-400">
                    아무도 입찰하지 않았습니다
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-6xl mb-4">🎉</div>
                  <div className="text-4xl mb-2">
                    낙찰: {roundResult.winnerName}
                  </div>
                  <div className="text-2xl text-yellow-400 mb-4">
                    입찰 시간: {roundResult.winTime?.toFixed(2)}초
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 라운드 히스토리 토글 버튼 */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="fixed top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg z-50"
      >
        {showHistory ? '히스토리 닫기' : '라운드 히스토리'}
      </button>

      {/* 라운드 히스토리 사이드 패널 */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-80 bg-gray-900 border-l border-gray-700 z-40 overflow-y-auto transition-transform duration-300 ${
          showHistory ? 'transform translate-x-0' : 'transform translate-x-full'
        }`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">라운드 히스토리</h2>
            <button 
              onClick={() => setShowHistory(false)}
              className="md:hidden text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
          
          {roundHistory.length === 0 ? (
            <p className="text-gray-400">아직 완료된 라운드가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {roundHistory.map((result, index) => (
                <div key={index} className="bg-gray-800 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">라운드 {result.round}</span>
                    <span className="text-sm text-gray-400">
                      {result.isDraw ? '유찰' : '낙찰'}
                    </span>
                  </div>
                  
                  {result.isDraw ? (
                    <p className="text-sm text-gray-400">아무도 입찰하지 않음</p>
                  ) : (
                    <div>
                      <p className="text-sm mb-2">
                        <span className="text-yellow-400 font-medium">
                          {result.winnerName}
                        </span> 승리
                        <span className="text-xs text-gray-400 ml-2">
                          {result.winTime?.toFixed(2)}초
                        </span>
                      </p>
                      
                      {result.bids && result.bids.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium text-gray-300">입찰 순위:</p>
                          {result.bids
                            .sort((a: any, b: any) => b.bidTime - a.bidTime)
                            .map((bid: any, bidIndex: number) => (
                              <div key={bid.playerId} className="text-xs flex justify-between">
                                <span className={`${
                                  bid.playerId === result.winnerId ? 'text-yellow-400 font-medium' : 'text-gray-400'
                                }`}>
                                  {index + 1}. {bid.playerName}
                                </span>
                                <span className="text-gray-500">
                                  {(bid.bidTime / 1000).toFixed(2)}s
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* 현재 플레이어 순위 */}
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-3">현재 순위</h3>
            <div className="space-y-2">
              {[...players]
                .sort((a, b) => b.wins - a.wins)
                .map((player, index) => (
                  <div key={player.id} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                    <span className="text-sm">
                      {index + 1}. {player.name}
                    </span>
                    <span className="text-sm font-bold text-yellow-400">
                      {player.wins}승
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* 게임 통계 */}
          {roundHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3">게임 통계</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>진행된 라운드:</span>
                  <span>{roundHistory.length}라운드</span>
                </div>
                <div className="flex justify-between">
                  <span>유찰 라운드:</span>
                  <span>{roundHistory.filter(r => r.isDraw).length}라운드</span>
                </div>
                <div className="flex justify-between">
                  <span>평균 입찰 시간:</span>
                  <span>
                    {roundHistory.length > 0 && roundHistory.some(r => !r.isDraw) ? (
                      (roundHistory
                        .filter(r => !r.isDraw && r.winTime)
                        .reduce((acc, r) => acc + (r.winTime || 0), 0) / 
                       roundHistory.filter(r => !r.isDraw && r.winTime).length).toFixed(2)
                    ) : '0.00'}초
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}