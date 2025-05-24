import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function Display() {
  const { socket } = useSocket();
  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [currentRound, setCurrentRound] = useState(1);
  const [countdown, setCountdown] = useState(-1);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [playerBids, setPlayerBids] = useState<Map<string, number>>(new Map());
  const [showHistory, setShowHistory] = useState(false);
  const [finalResults, setFinalResults] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

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

    socket.on('player:bid', (data: { playerId: string, playerName: string, bidTime: number }) => {
      setPlayerBids(prev => new Map(prev.set(data.playerId, data.bidTime / 1000)));
    });

    socket.on('round:ended', (result: any) => {
      setRoundResult(result);
      setGameStatus('roundEnd');
      setCountdown(-1);
      setRoundHistory(prev => [...prev, result]);
      setElapsedTime(0);
    });

    socket.on('game:ended', (results: any) => {
      console.log('Game ended:', results);
      setFinalResults(results);
      setGameStatus('ended');
    });

    socket.on('game:updated', (game: any) => {
      console.log('game:updated', game);
      console.log('game.players', game.players);
      console.log('game.gameState', game.gameState);
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
  }, [socket]);

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
  };

  const startGame = () => {
    if (!socket || !isHost) return;
    socket.emit('game:start');
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-2xl">연결 중...</div>
      </div>
    );
  }

  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady);

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

      {/* 호스트 컨트롤 패널 - waiting 상태에서만 표시 */}
      {isHost && gameStatus === 'waiting' && (
        <div className="bg-gray-900 p-4 border-b border-gray-700">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">플레이어 대기 중</h2>
            
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">현재 설정</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>1인당 제공 시간: {game.settings.timePerPlayer}초</div>
                <div>총 라운드 수: {game.settings.totalRounds}라운드</div>
              </div>
            </div>

            <button
              onClick={startGame}
              disabled={!allPlayersReady}
              className={`px-8 py-4 text-xl font-bold rounded-lg transition-colors ${
                allPlayersReady 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              게임 시작
            </button>

            {!allPlayersReady && (
              <p className="text-sm text-gray-400 mt-4 text-center">
                모든 플레이어가 준비되어야 게임을 시작할 수 있습니다 (최소 2명)
              </p>
            )}
          </div>
        </div>
      )}

      {/* 메인 게임 화면 */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
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

          {gameStatus !== 'configuring' && gameStatus !== 'waiting' && (
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
                    <div className="text-xs mt-2 text-gray-200">
                      남은 시간: {Math.max(0, player.remainingTime || 0).toFixed(1)}초
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
                        const timeExhausted = player && player.remainingTime <= 0;
                        return (
                          <div key={playerId} className="flex justify-between items-center">
                            <span className={`${timeExhausted ? 'text-red-400' : ''}`}>
                              {player?.name || 'Unknown'}
                              {timeExhausted && ' (시간 소진)'}
                            </span>
                            <span className="font-mono text-yellow-400">{bidTime.toFixed(2)}초</span>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}
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

          {gameStatus === 'ended' && finalResults && (
            <div className="space-y-8">
              <div className="text-6xl mb-4">🏆</div>
              <div className="text-4xl mb-6">게임 종료!</div>
              
              {/* 최종 우승자 */}
              <div className="bg-yellow-600 p-6 rounded-lg">
                <h2 className="text-3xl font-bold mb-2">🥇 최종 우승자</h2>
                <div className="text-2xl">{finalResults.winner.name}</div>
                <div className="text-lg text-yellow-200">총 {finalResults.winner.wins}승</div>
              </div>
              
              {/* 전체 순위 */}
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-2xl font-bold mb-4">최종 순위</h3>
                <div className="space-y-3">
                  {finalResults.allPlayers.map((player: any, index: number) => (
                    <div 
                      key={player.id} 
                      className={`flex justify-between items-center p-3 rounded ${
                        index === 0 ? 'bg-yellow-600' : 
                        index === 1 ? 'bg-gray-600' : 
                        index === 2 ? 'bg-amber-700' : 'bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                        </span>
                        <span className="text-lg">{player.name}</span>
                      </div>
                      <span className="text-lg font-bold">{player.wins}승</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 게임 통계 */}
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-2xl font-bold mb-4">게임 통계</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-400">{finalResults.rounds.length}</div>
                    <div className="text-sm text-gray-400">총 라운드</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">
                      {finalResults.rounds.filter((r: any) => r.isDraw).length}
                    </div>
                    <div className="text-sm text-gray-400">유찰 라운드</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">
                      {finalResults.rounds.filter((r: any) => !r.isDraw).length}
                    </div>
                    <div className="text-sm text-gray-400">성공 라운드</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {finalResults.rounds.length > 0 && finalResults.rounds.some((r: any) => !r.isDraw) ? (
                        (finalResults.rounds
                          .filter((r: any) => !r.isDraw && r.winTime)
                          .reduce((acc: number, r: any) => acc + (r.winTime || 0), 0) / 
                         finalResults.rounds.filter((r: any) => !r.isDraw && r.winTime).length).toFixed(1)
                      ) : '0.0'}초
                    </div>
                    <div className="text-sm text-gray-400">평균 입찰시간</div>
                  </div>
                </div>
              </div>
              
              {/* 새 게임 시작 버튼 (호스트만) */}
              {isHost && (
                <div className="mt-8">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-4 text-2xl font-bold bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    새 게임 시작
                  </button>
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