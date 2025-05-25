import { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function Results() {
  const { socket } = useSocket();
  const [finalResults, setFinalResults] = useState<any>(null);

  // 정확한 시간 표시를 위한 헬퍼 함수
  const formatTime = (time: number): string => {
    const displayTime = time < 0.01 ? 0 : time;
    return displayTime.toFixed(1);
  };

  useEffect(() => {
    if (!socket) return;

    // 게임 정보 요청

    
    socket.on('game:final_results', (results: any) => {
      console.log("game:get_final_results", results);
      setFinalResults(results);
    });

    socket.emit('game:get_final_results');

    return () => {
      socket.off('game:final_results');
    };
  }, [socket]);

  if (!finalResults) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">최종 결과를 불러오는 중...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white overflow-hidden">
      <div className="h-full overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-4 md:p-8 pb-8 space-y-6">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <div className="text-4xl md:text-6xl mb-6 font-bold">게임 종료!</div>
          </div>

          {/* 2열 레이아웃 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* 왼쪽 열 */}
            <div className="space-y-6">
              {/* 최종 우승자 */}
              <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2">
                  🥇 최종 우승자
                </h2>
                <div className="text-xl md:text-2xl font-bold">{finalResults.winner.name}</div>
                <div className="text-lg text-yellow-200">총 {finalResults.winner.wins}승</div>
                <div className="text-sm text-yellow-200 mt-2">
                  남은 시간: {formatTime(finalResults.winner.remainingTime)}초
                </div>
              </div>

              {/* 최종 순위 */}
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl md:text-2xl font-bold mb-4">🏅 최종 순위</h3>
                <div className="space-y-3">
                  {finalResults.allPlayers.map((player: any, index: number) => (
                    <div 
                      key={player.id} 
                      className={`flex justify-between items-center p-4 rounded-lg transition-all hover:scale-105 ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' : 
                        index === 1 ? 'bg-gradient-to-r from-gray-500 to-gray-400' : 
                        index === 2 ? 'bg-gradient-to-r from-amber-700 to-amber-600' : 'bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl md:text-2xl font-bold">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                        </span>
                        <div>
                          <div className="font-bold text-lg">{player.name}</div>
                          <div className="text-sm opacity-75">
                            남은 시간: {formatTime(player.remainingTime)}초
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{player.wins}승</div>
                        <div className="text-sm opacity-75">
                          승률: {((player.wins / finalResults.rounds.length) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 게임 통계 */}
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl md:text-2xl font-bold mb-4">📊 게임 통계</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-600 rounded-lg">
                    <div className="text-2xl md:text-3xl font-bold">{finalResults.rounds.length}</div>
                    <div className="text-sm opacity-75">총 라운드</div>
                  </div>
                  <div className="text-center p-4 bg-red-600 rounded-lg">
                    <div className="text-2xl md:text-3xl font-bold">
                      {finalResults.rounds.filter((r: any) => r.isDraw).length}
                    </div>
                    <div className="text-sm opacity-75">유찰</div>
                  </div>
                  <div className="text-center p-4 bg-green-600 rounded-lg">
                    <div className="text-2xl md:text-3xl font-bold">
                      {finalResults.rounds.filter((r: any) => !r.isDraw).length}
                    </div>
                    <div className="text-sm opacity-75">성공</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-600 rounded-lg">
                    <div className="text-2xl md:text-3xl font-bold">
                      {finalResults.rounds.length > 0 && finalResults.rounds.some((r: any) => !r.isDraw) ? (
                        (finalResults.rounds
                          .filter((r: any) => !r.isDraw && r.winTime)
                          .reduce((acc: number, r: any) => acc + (r.winTime || 0), 0) / 
                        finalResults.rounds.filter((r: any) => !r.isDraw && r.winTime).length).toFixed(1)
                      ) : '0.0'}
                    </div>
                    <div className="text-sm opacity-75">평균시간(초)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 오른쪽 열 */}
            <div className="space-y-6">
              {/* 개별 플레이어 통계 */}
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl md:text-2xl font-bold mb-4">👤 플레이어별 통계</h3>
                <div className="space-y-4">
                  {finalResults.allPlayers.map((player: any) => {
                    const playerBids = finalResults.rounds.flatMap((r: any) => 
                      r.bids.filter((bid: any) => bid.playerId === player.id)
                    );
                    const participationRate = (playerBids.length / finalResults.rounds.length * 100).toFixed(0);
                    const avgBidTime = playerBids.length > 0 
                      ? (playerBids.reduce((acc: number, bid: any) => acc + bid.bidTime, 0) / playerBids.length / 1000).toFixed(1)
                      : '0.0';

                    return (
                      <div key={player.id} className="bg-gray-700 p-4 rounded-lg border-l-4 border-blue-500">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-lg flex items-center gap-2">
                            {player.name}
                            {player.id === finalResults.winner.id && <span className="text-yellow-400">👑</span>}
                          </h4>
                          <span className="text-green-400 font-bold text-xl">{player.wins}승</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="text-center p-2 bg-gray-600 rounded">
                            <div className="font-bold text-blue-400">{participationRate}%</div>
                            <div className="text-xs opacity-75">참여율</div>
                          </div>
                          <div className="text-center p-2 bg-gray-600 rounded">
                            <div className="font-bold text-yellow-400">{avgBidTime}초</div>
                            <div className="text-xs opacity-75">평균시간</div>
                          </div>
                          <div className="text-center p-2 bg-gray-600 rounded">
                            <div className="font-bold text-green-400">{formatTime(player.remainingTime)}초</div>
                            <div className="text-xs opacity-75">잔여시간</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 라운드별 상세 결과 */}
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl md:text-2xl font-bold mb-4">🎯 라운드별 결과</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {finalResults.rounds.map((round: any, index: number) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 transition-all hover:bg-opacity-80 ${
                      round.isDraw ? 'bg-red-900 border-red-500' : 'bg-green-900 border-green-500'
                    }`}>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-lg">라운드 {round.round}</h4>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          round.isDraw ? 'bg-red-600' : 'bg-green-600'
                        }`}>
                          {round.isDraw ? '유찰' : '낙찰'}
                        </div>
                      </div>

                      {round.isDraw ? (
                        <div className="text-gray-300">
                          {round.bids.length === 0 ? '📭 입찰 없음' : '⚖️ 동점 유찰'}
                          {round.bids.length > 0 && (
                            <div className="mt-2 text-sm">
                              동점자: {round.bids.map((bid: any) => bid.playerName).join(', ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-green-700 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="font-bold">👑 {round.winnerName}</span>
                              <span className="text-yellow-400 font-mono text-lg">
                                {round.winTime?.toFixed(2)}초
                              </span>
                            </div>
                          </div>
                          
                          {round.bids.length > 1 && (
                            <div className="bg-gray-700 p-3 rounded-lg">
                              <div className="text-sm font-medium text-gray-300 mb-2">📊 전체 순위:</div>
                              <div className="space-y-1">
                                {round.bids
                                  .sort((a: any, b: any) => b.bidTime - a.bidTime)
                                  .map((bid: any, bidIndex: number) => (
                                    <div key={bid.playerId} className="flex justify-between items-center text-sm">
                                      <span className={`${
                                        bid.playerId === round.winnerId ? 'text-yellow-400 font-bold' : 'text-gray-300'
                                      }`}>
                                        {bidIndex + 1}위. {bid.playerName}
                                        {bid.playerId === round.winnerId && ' 🏆'}
                                      </span>
                                      <span className="font-mono text-gray-400">
                                        {(bid.bidTime / 1000).toFixed(2)}초
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 커스텀 스크롤바 스타일 */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #374151;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #6b7280;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}