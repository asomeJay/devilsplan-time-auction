import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useVibration } from '../hooks/useVibration';

export default function Game() {
  const { socket } = useSocket();
  const vibrate = useVibration();
  
  const [gameStatus, setGameStatus] = useState('waiting');
  const [currentRound, setCurrentRound] = useState(1);
  const [countdown, setCountdown] = useState(-1);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [hasBid, setHasBid] = useState(false);
  const [hasGivenUp, setHasGivenUp] = useState(false);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [wins, setWins] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState('none');
  const [isParticipating, setIsParticipating] = useState(false); // 현재 라운드 참여 여부
  const [finalResults, setFinalResults] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState(600); // 플레이어의 남은 시간
  const [elapsedTime, setElapsedTime] = useState(0); // 라운드 경과 시간
  
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 정확한 시간 표시를 위한 헬퍼 함수
  const formatTime = (time: number): string => {
    // 0.01초 미만은 0으로 표시
    const displayTime = time < 0.01 ? 0 : time;
    return displayTime.toFixed(1);
  };

  // 시간 소진 여부 확인
  const isTimeExhausted = remainingTime <= 0.01;

  // 게임 참여 알림
  useEffect(() => {
    if (!socket) return;
    
    console.log('Joining game');
    socket.emit('game:rejoin');
    
  }, [socket]);

  // 모바일 뷰포트 높이 조정
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  // 소켓 연결 상태 확인
  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => {
      console.log('Socket connected');
      setSocketConnected(true);
    };
    
    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    setSocketConnected(socket.connected);
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on('round:prepare', (round: number) => {
      console.log('Received round:prepare event', round);
      setLastEvent('round:prepare');
      setCurrentRound(round);
      setGameStatus('prepare');
      setRoundResult(null);
      setHasBid(false);
      setHasGivenUp(false);
      setIsGameActive(false);
      setIsButtonPressed(false);
      setIsParticipating(false); // 새 라운드 시작 시 참여 상태 초기화
      setCountdown(5);
    });

    socket.on('game:countdown', (seconds: number) => {
      console.log('Received game:countdown event', seconds);
      setLastEvent('game:countdown');
      setCountdown(seconds);
      if (seconds === 5) {
        vibrate(100);
      }
    });

    socket.on('round:started', (data: { playersStillHolding: string[] }) => {
      console.log('Received round:started event', data);
      setLastEvent('round:started');
      setGameStatus('playing');
      setIsGameActive(true);
      setCountdown(-1);
      
      // 시간이 소진된 상태에서 게임이 시작되면 자동으로 포기 처리
      if (isTimeExhausted) {
        console.log('Player has no time remaining, automatically giving up');
        setIsButtonPressed(false);
        setIsParticipating(false);
        setHasGivenUp(true);
        return;
      }
      
      // 서버에서 알려준 버튼을 누르고 있는 플레이어 목록에 내가 포함되어 있다면
      // 버튼을 누르고 있는 상태를 유지
      if (data.playersStillHolding && socket.id && data.playersStillHolding.includes(socket.id)) {
        console.log('Player is still holding button, maintaining pressed state');
        setIsButtonPressed(true);
        setIsParticipating(true);
      } else {
        console.log('Player is not holding button or gave up during countdown');
        setIsButtonPressed(false);
        setIsParticipating(false);
        setHasGivenUp(true);
      }
    });

    socket.on('bid:confirmed', (data: { bidTime: number, autoCompleted?: boolean, reason?: string }) => {
      console.log('Received bid:confirmed event', data);
      setLastEvent('bid:confirmed');
      setHasBid(true);
      setIsButtonPressed(false);
      setIsGameActive(false);
      setIsParticipating(false);
      vibrate(50);
    });

    socket.on('player:giveup', () => {
      console.log('Received player:giveup event');
      setLastEvent('player:giveup');
      setHasGivenUp(true);
      setIsButtonPressed(false);
      setIsParticipating(false);
      vibrate(30);
    });

    socket.on('round:ended', (result: any) => {
      console.log('Received round:ended event', result);
      setLastEvent('round:ended');
      setRoundResult(result);
      setGameStatus('roundEnd');
      setIsGameActive(false);
      setIsButtonPressed(false);
      setIsParticipating(false);
      
      if (result.winnerId === socket.id) {
        setWins(prev => prev + 1);
        vibrate([100, 50, 100]);
      }
    });

    socket.on('game:ended', (results: any) => {
      console.log('Received game:ended event', results);
      setLastEvent('game:ended');
      setGameStatus('ended');
      setFinalResults(results);
      setIsGameActive(false);
      setIsButtonPressed(false);
      setIsParticipating(false);
    });

    socket.on('game:timeUpdate', (data: { elapsedTime: number, roundStartTime: number, players?: any[] }) => {
      setElapsedTime(data.elapsedTime);
      
      // 내 플레이어 정보 업데이트 (시간 정보)
      if (data.players && socket.id) {
        const myPlayer = data.players.find(p => p.id === socket.id);
        if (myPlayer) {
          // 0.01초 미만은 0으로 설정
          const displayTime = myPlayer.remainingTime < 0.01 ? 0 : myPlayer.remainingTime;
          setRemainingTime(displayTime);
        }
      }
    });

    // 게임 상태 업데이트 (상태 동기화만)
    socket.on('game:updated', (game: any) => {
      // 게임 상태 동기화만 수행
      if (game.gameState?.status) {
        setGameStatus(game.gameState.status);
      }
    });

    return () => {
      socket.off('round:prepare');
      socket.off('game:countdown');
      socket.off('round:started');
      socket.off('bid:confirmed');
      socket.off('player:giveup');
      socket.off('round:ended');
      socket.off('game:ended');
      socket.off('game:timeUpdate');
      socket.off('game:updated');
    };
  }, [socket, vibrate, isTimeExhausted]);

  const handleButtonPress = () => {
    if (!socket || hasBid || hasGivenUp) return;
    
    // 게임 진행 중에 시간이 소진된 경우 버튼 누르기 불가
    if (isGameActive && isTimeExhausted) {
      console.log('Cannot press button - time exhausted during game');
      return;
    }
    
    console.log('Button pressed');
    setIsButtonPressed(true);
    setIsParticipating(true);
    socket.emit('button:press');
    vibrate(50);
  };

  const handleButtonRelease = () => {
    if (!socket || !isButtonPressed || !isParticipating) return;
    
    console.log('Button release', { 
      countdown, 
      isGameActive, 
      hasBid, 
      hasGivenUp,
      isParticipating,
      isTimeExhausted 
    });
    
    // 카운트다운 중에 버튼을 놓으면 포기
    if (countdown > 0 && isParticipating && !hasGivenUp) {
      console.log('Giving up during countdown');
      socket.emit('button:release');
      setIsButtonPressed(false);
      setIsParticipating(false);
      vibrate(30);
    }
    // 입찰 단계에서 버튼을 놓으면 입찰 완료
    else if (isGameActive && isParticipating && !hasBid && !hasGivenUp) {
      console.log('Placing bid');
      setIsButtonPressed(false);
      setIsParticipating(false);
      socket.emit('button:release');
      vibrate(30);
      // 서버 응답을 기다리므로 여기서는 상태를 바꾸지 않음
    }
    // 그 외의 경우 (준비 단계에서 놓기)
    else if (!isGameActive && countdown === -1) {
      console.log('Button released during prepare phase');
      socket.emit('button:release');
      setIsButtonPressed(false);
      setIsParticipating(false);
    }
  };

  return (
    <div className="flex-container-mobile overflow-hidden">
      <div className="p-4 bg-gray-800 flex-shrink-0 safe-top">
        <div className="flex justify-between items-center">
          <div>라운드 {currentRound}/19</div>
          <div>승리: {wins}</div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="text-sm text-yellow-400">
            남은 시간: {formatTime(Math.max(0, remainingTime))}초
          </div>
          <div className={`text-xs px-2 py-1 rounded ${isTimeExhausted ? 'bg-red-600' : 'bg-green-600'}`}>
            {isTimeExhausted ? '시간 소진' : '사용 가능'}
          </div>
        </div>
        <div className="text-xs text-gray-300 mt-2">
          Status: {gameStatus} | Socket: {socketConnected ? 'Connected' : 'Disconnected'} | Last: {lastEvent}
        </div>
        <div className="text-xs text-gray-300">
          Participating: {isParticipating ? 'Yes' : 'No'} | Pressed: {isButtonPressed ? 'Yes' : 'No'}
        </div>
      </div>

      <div className="flex-main-mobile flex items-center justify-center p-4 safe-bottom touch-manipulation">
        {gameStatus!='roundEnd' && (
          <div className="text-center w-full">
            {gameStatus === 'configuring' && (
              <div className="space-y-6">
                <div className="text-4xl">⏳</div>
                <div className="text-2xl">호스트가 게임을 설정 중입니다</div>
                <div className="text-lg text-gray-400">잠시만 기다려주세요</div>
              </div>
            )}
            
            {gameStatus === 'waiting' && (
              <div className="space-y-6">
                <div className="text-4xl">👥</div>
                <div className="text-2xl">게임 시작 대기 중</div>
                <div className="text-lg text-gray-400">
                  모든 플레이어가 준비되면 호스트가 게임을 시작합니다
                </div>
              </div>
            )}
            
            {/* 시간 소진으로 자동 포기된 경우 */}
            {hasGivenUp && isGameActive && isTimeExhausted && (
              <div className="space-y-4">
                <div className="w-48 h-48 rounded-full bg-red-700 flex items-center justify-center mx-auto border-4 border-red-500">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-200">시간 소진</div>
                    <div className="text-lg text-red-300">자동 포기</div>
                  </div>
                </div>
                <div className="text-lg text-red-400">
                  시간이 모두 소진되어 이번 라운드에서 자동으로 포기되었습니다
                </div>
              </div>
            )}
            
            {/* 일반적인 포기 상태 */}
            {hasGivenUp && !(isGameActive && isTimeExhausted) && gameStatus !== 'configuring' && gameStatus !== 'waiting' && (
                <button
                disabled={true}
                className={`w-72 h-72 md:w-[28rem] md:h-[28rem] rounded-full text-4xl font-bold ${
                    isButtonPressed && isParticipating
                        ? (isTimeExhausted ? 'bg-orange-600 scale-95' : 'bg-red-600 scale-95')
                        : isTimeExhausted && isGameActive
                          ? 'bg-gray-500 cursor-not-allowed opacity-50'
                          : isTimeExhausted
                            ? 'bg-orange-600 hover:bg-orange-500'
                            : 'bg-gray-700 hover:bg-gray-600'
                }`}
                style={{ maxWidth: '90vw', maxHeight: '60vh' }}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold">포기</div>
                  <div className="text-lg">이번 라운드 불참</div>
                </div>
              </button>
            )}
            
            {!hasGivenUp && gameStatus !== 'configuring' && gameStatus !== 'waiting' && (
              <>
                <div className="space-y-4">
                  {gameStatus=='prepare' && countdown === -1 && (
                    <p className="text-lg mb-4 text-yellow-400">
                      모든 플레이어가 버튼을 누르면 5초 카운트다운이 시작됩니다
                    </p>
                  )}
                  
                  {/* 시간 소진 경고 - 준비 단계에서는 참여 가능하다고 알림 */}
                  {isTimeExhausted && !isGameActive && (
                    <p className="text-sm mb-4 text-orange-400">
                      ⚠️ 시간이 소진되었습니다. 준비 단계에는 참여할 수 있지만 게임이 시작되면 자동으로 포기됩니다.
                    </p>
                  )}
                  
                  {/* 시간 소진 경고 - 게임 진행 중에는 버튼 사용 불가 */}
                  {isTimeExhausted && isGameActive && (
                    <p className="text-sm mb-4 text-red-400">
                      ⚠️ 시간이 소진되어 더 이상 참여할 수 없습니다.
                    </p>
                  )}
                  
                  <button
                    ref={buttonRef}
                    onTouchStart={handleButtonPress}
                    onTouchEnd={handleButtonRelease}
                    onMouseDown={handleButtonPress}
                    onMouseUp={handleButtonRelease}
                    className={`w-72 h-72 md:w-[28rem] md:h-[28rem] rounded-full text-4xl font-bold transition-all ${
                        isButtonPressed && isParticipating
                            ? (isTimeExhausted ? 'bg-orange-600 scale-95' : 'bg-red-600 scale-95')
                            : isTimeExhausted && isGameActive
                              ? 'bg-gray-500 cursor-not-allowed opacity-50'
                              : isTimeExhausted
                                ? 'bg-orange-600 hover:bg-orange-500'
                                : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    style={{ maxWidth: '90vw', maxHeight: '60vh' }}
                    disabled={hasGivenUp || (isTimeExhausted && isGameActive)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {gameStatus === 'roundEnd' && roundResult && (
        <div className="text-center w-full">
            {roundResult.isDraw ? (
            <div className="space-y-4">
                {/* 유찰 아이콘과 메시지 */}
                <div className="text-6xl mb-4">
                    ⚖️
                </div>
                <h2 className="text-4xl font-bold mb-4">
                유찰
                </h2>
            </div>
            ) : (
            <div className="space-y-4">
                {/* 낙찰 성공 */}
                <h2 className="text-4xl font-bold mb-4">
                {roundResult.winnerId === socket?.id 
                    ? '🎉 낙찰 성공!' 
                    : '❌ 낙찰 실패'}
                </h2>
                
                <div className="space-y-2">
                <p className="text-xl">낙찰자: {roundResult.winnerName}</p>
                <p className="text-lg text-gray-400">
                    낙찰 시간: {roundResult.winTime?.toFixed(3)}초
                </p>
                </div>
            </div>
            )}
            
            {/* 다음 라운드 대기 메시지 */}
            <div className="mt-8">
            <div className="text-lg text-yellow-400">
                호스트가 다음 라운드를 시작하기를 기다리는 중...
            </div>
            </div>
        </div>
        )}

        {gameStatus === 'ended' && finalResults && (
          <div className="text-center w-full">
            <h2 className="text-4xl font-bold mb-4">🏆 게임 종료!</h2>
            
            {/* 최종 결과 */}
            <div className="space-y-4">
              <div className="bg-yellow-600 p-4 rounded-lg">
                <h3 className="text-2xl font-bold mb-2">🥇 최종 우승자</h3>
                <div className="text-xl">{finalResults.winner.name}</div>
                <div className="text-sm text-yellow-200">총 {finalResults.winner.wins}승</div>
              </div>
              
              {/* 내 순위 */}
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-bold mb-2">내 결과</h3>
                <div className="text-lg">총 {wins}승</div>
                <div className="text-sm text-gray-400">
                  순위: {finalResults.allPlayers.findIndex((p: any) => p.id === socket?.id) + 1}위
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  홈으로 돌아가기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}