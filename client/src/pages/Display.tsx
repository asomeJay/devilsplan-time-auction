import { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';

export default function Display() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [gameStatus, setGameStatus] = useState('configuring');
  const [currentRound, setCurrentRound] = useState(1);
  const [countdown, setCountdown] = useState(-1);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [playerBids, setPlayerBids] = useState<Map<string, number>>(new Map());
  const [showHistory, setShowHistory] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 정확한 시간 표시를 위한 헬퍼 함수
  const formatTime = (time: number): string => {
    // 0.01초 미만은 0으로 표시
    const displayTime = time < 0.01 ? 0 : time;
    return displayTime.toFixed(1);
  };

  useEffect(() => {
    if (!socket) return;

    // Display로 게임에 참여
    socket.emit('game:rejoin');

    socket.on('game:updated', (game: any) => {
      setGame(game);
      setPlayers(game.players.filter((p: any) => p.role === 'player'));
      setIsHost(game.hostId === socket.id);
      setRoundHistory(game.gameState?.roundHistory || []);
    });

    socket.on('game:joined', (game: any) => {
      setGame(game);
      setPlayers(game.players.filter((p: any) => p.role === 'player'));
      setIsHost(game.hostId === socket.id);
      setRoundHistory(game.gameState?.roundHistory || []);
    });

    socket.on('round:prepare', (round: number) => {
      setCurrentRound(round);
      setGameStatus('prepare');
      setRoundResult(null);
      setPlayerBids(new Map());
      setElapsedTime(0);
    });

    socket.on('game:countdown', (seconds: number) => {
      setCountdown(seconds);
      if (seconds === 0) {
        setGameStatus('playing');
        setElapsedTime(0);
      }
    });

    socket.on('player:bid', (data: { playerId: string, playerName: string, bidTime: number, autoCompleted?: boolean }) => {
      setPlayerBids(prev => new Map(prev.set(data.playerId, data.bidTime / 1000)));
      
      // 자동 입찰인 경우 로그 출력
      if (data.autoCompleted) {
        console.log(`플레이어 ${data.playerName} 시간 소진으로 자동 입찰 완료`);
      }
    });

    socket.on('round:ended', (result: any) => {
      console.log('round:ended', result);
      setRoundResult(result);
      setGameStatus('roundEnd');
      setCountdown(-1);
      setRoundHistory(prev => [...prev, result]);
      setElapsedTime(0);
    });

    socket.on('game:ended', (results: any) => {
      console.log('Game ended, redirecting to results:', results);
      // 게임이 끝나면 Results 페이지로 리다이렉트
      navigate('/results');
    });

    socket.on('player:gaveup', (player: any) => {
      console.log('player:gaveup', player);
    });

    socket.on('game:timeUpdate', (data: { elapsedTime: number, roundStartTime: number, players?: any[] }) => {
      setElapsedTime(data.elapsedTime);
      
      // 플레이어 정보 업데이트 (시간 정보 포함)
      if (data.players) {
        setPlayers(data.players.filter((p: any) => p.role === 'player'));
      }
    });

    return () => {
      socket.off('game:updated');
      socket.off('game:joined');
      socket.off('round:prepare');
      socket.off('game:countdown');
      socket.off('player:bid');
      socket.off('round:ended');
      socket.off('game:ended');
      socket.off('game:timeUpdate');
    };
  }, [socket, navigate]);

  const nextRound = () => {
    if (!socket) return;
    socket.emit('round:next');
  };

  const updateSettings = (key: string, value: number) => {
    if (!socket || !isHost) return;
    socket.emit('game:updateSettings', { [key]: value });
  };

  const finishConfiguration = () => {
    if (!socket || !isHost) return;
    socket.emit('game:finishConfiguration');
    socket.emit('game:start');
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-2xl">연결 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* 호스트 설정 패널 - configuring 상태에서만 표시 */}
      {isHost && gameStatus === 'configuring' && (
        <div className="bg-gray-900 p-4 border-b border-gray-700">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">게임 설정</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  1인당 제공 시간 (초)
                </label>
                <input
                  type="number"
                  value={game.settings.timePerPlayer}
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
                  value={game.settings.totalRounds}
                  onChange={(e) => updateSettings('totalRounds', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 rounded-md text-white"
                />
              </div>
            </div>

            <button
              onClick={finishConfiguration}
              className="px-8 py-4 text-xl font-bold bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              설정 완료 - 플레이어 대기
            </button>
            
            <p className="text-sm text-gray-400 mt-4">
              설정을 완료하면 플레이어들이 입장하여 게임 준비를 할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 메인 게임 화면 */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">
        <div className="text-center">
          {gameStatus === 'configuring' && (
            <div className="space-y-6">
              <h1 className="text-6xl font-bold mb-8">시간 경매 게임</h1>
              <div className="text-3xl text-gray-400">
                {isHost ? (
                  <>
                    <div className="mb-4">🔧 게임 설정 중...</div>
                    <div className="text-xl">
                      위의 설정 패널에서 게임 옵션을 조정하고<br/>
                      "설정 완료" 버튼을 눌러주세요
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">⏳ 호스트가 게임을 설정 중입니다...</div>
                    <div className="text-xl text-yellow-400">
                      잠시만 기다려주세요
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {gameStatus === 'waiting' && (
            <div className="space-y-6">
              <h1 className="text-6xl font-bold mb-8">시간 경매 게임</h1>
              <div className="text-3xl text-gray-400">
                {isHost ? (
                  <>
                    <div className="mb-4">👥 플레이어 대기 중...</div>
                    <div className="text-xl">
                      플레이어들이 준비되면 게임을 시작할 수 있습니다
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">⏳ 호스트가 게임을 시작하기를 기다리는 중...</div>
                  </>
                )}
              </div>
              
              {/* 현재 플레이어 상태 표시 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {players.map((player) => (
                  <div 
                    key={player.id} 
                    className={`p-6 rounded-lg text-center transition-all ${
                      player.isReady 
                        ? 'bg-green-600 border-2 border-green-400' 
                        : 'bg-red-600 border-2 border-red-400'
                    }`}
                  >
                    <div className="text-lg font-bold">{player.name}</div>
                    <div className="text-sm mt-1">
                      {player.isReady ? '준비됨' : '대기중'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {['prepare', 'playing', 'roundEnd'].includes(gameStatus) && (
            <h1 className="text-6xl font-bold mb-8">라운드 {currentRound}</h1>
          )}

          {countdown > 0 && (
            <div className="text-9xl font-bold text-yellow-400">
              {countdown}
            </div>
          )}

          {/* 준비 단계에서 버튼 누르기 상태 표시 */}
          {(gameStatus === 'prepare' || gameStatus === 'waiting') && countdown === -1 && (
            <div className="space-y-6">              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {players.map((player) => (
                  <div 
                    key={player.id} 
                    className={`p-10 rounded-lg text-center transition-all ${
                      player.isHoldingButton 
                        ? 'bg-green-600 border-2 border-green-400' 
                        : 'bg-red-600 border-2 border-red-400'
                    }`}
                  >
                    <div className="text-lg font-bold">{player.name}</div>
                    <div className="text-sm mt-1">
                      {player.isHoldingButton ? '준비됨' : '대기중'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gameStatus === 'playing' && (
            <div className="space-y-8">
              <div className="text-4xl">
                입찰 진행 중...
              </div>
              
              {/* 경과 시간 표시 */}
              <div className="text-6xl font-mono text-yellow-400">
                {elapsedTime.toFixed(1)}초
              </div>
              
              <div className="text-lg text-gray-400">
                플레이어들이 버튼을 놓는 순간 입찰됩니다
              </div>
              
              {/* 현재 입찰한 플레이어들 표시 */}
              {playerBids.size > 0 && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">입찰 완료</h3>
                  <div className="space-y-2">
                    {Array.from(playerBids.entries())
                      .sort(([,a], [,b]) => b - a) // 늦게 입찰한 순서대로 정렬
                      .map(([playerId, bidTime]) => {
                        const player = players.find(p => p.id === playerId);
                        const timeExhausted = player && player.remainingTime <= 0.01; // 0.01초 이하는 소진으로 판단
                        return (
                          <div key={playerId} className={`flex justify-between items-center p-2 rounded ${
                            timeExhausted ? 'bg-red-900 border border-red-600' : 'bg-gray-700'
                          }`}>
                            <span className={`${timeExhausted ? 'text-red-400' : 'text-white'}`}>
                              {player?.name || 'Unknown'}
                              {timeExhausted && (
                                <span className="text-xs ml-2 px-2 py-1 bg-red-600 rounded">시간 소진</span>
                              )}
                            </span>
                            <span className="font-mono text-yellow-400">{bidTime.toFixed(2)}초</span>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}

              {/* 플레이어 시간 상태를 실시간으로 표시하는 컴포넌트 */}
              <div className="bg-gray-800 p-4 rounded-lg mt-4">
                <h3 className="text-lg font-bold mb-3">플레이어 상태</h3>
                <div className="grid grid-cols-2 gap-2">
                  {players.map(player => {
                    const displayTime = player.remainingTime < 0.01 ? 0 : player.remainingTime;
                    return (
                      <div key={player.id} className={`p-2 rounded text-sm ${
                        displayTime <= 0 
                          ? 'bg-red-900 border border-red-600' 
                          : displayTime <= 30
                            ? 'bg-yellow-900 border border-yellow-600'
                            : 'bg-gray-700'
                      }`}>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-xs">
                          {player.isHoldingButton && player.isBidding ? '입찰 중' : '대기'}
                        </div>
                        <div className={`text-xs ${
                          displayTime <= 0 ? 'text-red-400' :
                          displayTime <= 30 ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
                          남은 시간: {formatTime(displayTime)}초
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {gameStatus === 'roundEnd' && roundResult && (
            <div className="space-y-6">
              {roundResult.isDraw ? (
                <div>
                  <div className="text-6xl mb-4">⚖️</div>
                  <div className="text-4xl">유찰</div>
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
              
              {/* 호스트만 다음 라운드 진행 버튼 표시 */}
              {isHost && (
                <div className="mt-8">
                  <button
                    onClick={nextRound}
                    className="px-8 py-4 text-2xl font-bold bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    {currentRound < game.settings.totalRounds 
                      ? `다음 라운드 (${currentRound + 1}/${game.settings.totalRounds})`
                      : '최종 결과 보기'
                    }
                  </button>
                </div>
              )}
              
              {/* 호스트가 아닌 경우 대기 메시지 */}
              {!isHost && (
                <div className="mt-8">
                  <div className="text-xl text-gray-400">
                    호스트가 다음 라운드를 시작하기를 기다리는 중...
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
              {roundHistory.reduce((acc: any[], result: any) => {
                if (acc.find((r: any) => r.round === result.round)) {
                  return acc;
                }
                return [...acc, result];
              }, []).map((result: any, index: number) => (
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
                      </div>
                      
                  )}
                  <div>
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
                                  {bidIndex + 1}. {bid.playerName}
                                </span>
                                <span className="text-gray-500">
                                  {(bid.bidTime / 1000).toFixed(2)}s
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
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