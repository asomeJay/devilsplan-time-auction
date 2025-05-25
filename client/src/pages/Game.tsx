import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function Game() {
  const { socket } = useSocket();
  
  const [gameStatus, setGameStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(-1);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [hasBid, setHasBid] = useState(false);
  const [hasGivenUp, setHasGivenUp] = useState(false);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [isBidding, setIsBidding] = useState(false); // 입찰 진행 중 상태 추가
  
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!socket) return;

    socket.on('round:prepare', (round: number) => {
      console.log('Received round:prepare event', round);
      setGameStatus('prepare');
      setRoundResult(null);
      setHasBid(false);
      setHasGivenUp(false);
      setIsGameActive(false);
      setIsButtonPressed(false);
      setIsParticipating(false);
      setIsBidding(false); // 입찰 상태 초기화
      setCountdown(5);
    });

    socket.on('game:countdown', (seconds: number) => {
      console.log('Received game:countdown event', seconds);
      setCountdown(seconds);
    });

    socket.on('round:started', (data: { playersStillHolding: string[] }) => {
      console.log('Received round:started event', data);
      setGameStatus('playing');
      setIsGameActive(true);
      setCountdown(-1);
      
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
      setHasBid(true);
      setIsButtonPressed(false);
      setIsGameActive(false);
      setIsParticipating(false);
    //   setIsBidding(false); // 입찰 완료
    });

    socket.on('player:giveup', () => {
      console.log('Received player:giveup event');
      setHasGivenUp(true);
      setIsButtonPressed(false);
      setIsParticipating(false);
      setIsBidding(false);
    });

    socket.on('round:ended', (result: any) => {
      console.log('Received round:ended event', result);
      setRoundResult(result);
      setGameStatus('roundEnd');
      setIsGameActive(false);
      setIsButtonPressed(false);
      setIsParticipating(false);
      setIsBidding(false);
    });

    socket.on('game:ended', (results: any) => {
      console.log('Received game:ended event', results);
      setGameStatus('ended');
      setIsGameActive(false);
      setIsButtonPressed(false);
      setIsParticipating(false);
      setIsBidding(false);
    });

    socket.on('game:updated', (game: any) => {
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
      socket.off('game:updated');
    };
  }, [socket]);

  const handleButtonPress = () => {
    if (!socket || hasBid || hasGivenUp || isBidding) return;
    
    console.log('Button pressed');
    setIsButtonPressed(true);
    setIsParticipating(true);
    socket.emit('button:press');
  };

  const handleButtonRelease = () => {
    if (!socket || !isButtonPressed || !isParticipating || isBidding) return;
    
    console.log('Button release', { 
      countdown, 
      isGameActive, 
      hasBid, 
      hasGivenUp,
      isParticipating,
      isBidding
    });
    
    // 카운트다운 중에 버튼을 놓으면 포기
    if (countdown > 0 && isParticipating && !hasGivenUp) {
      console.log('Giving up during countdown');
      socket.emit('button:release');
      setIsButtonPressed(false);
      setIsParticipating(false);
    }
    // 입찰 단계에서 버튼을 놓으면 입찰 완료
    else if (isGameActive && isParticipating && !hasBid && !hasGivenUp) {
      console.log('Placing bid');
      setIsBidding(true); // 입찰 진행 중 상태로 변경
      // 버튼 상태는 서버 응답 후에만 변경
      socket.emit('button:release');
    }
    // 그 외의 경우 (준비 단계에서 놓기)
    else if (!isGameActive && countdown === -1) {
      console.log('Button released during prepare phase');
      socket.emit('button:release');
      setIsButtonPressed(false);
      setIsParticipating(false);
    }
  };

  // 터치 이벤트 최적화 함수들 추가
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // 기본 터치 동작 방지
    handleButtonPress();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault(); // 기본 터치 동작 방지
    handleButtonRelease();
  };

  return (
    <div className="flex-container-mobile overflow-hidden">
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
            
            {/* 일반적인 포기 상태 */}
            {hasGivenUp  && gameStatus !== 'configuring' && gameStatus !== 'waiting' && (
                <button
                disabled={true}
                className={`w-72 h-72 md:w-[28rem] md:h-[28rem] rounded-full text-4xl font-bold ${
                    isButtonPressed && isParticipating
                            ? 'bg-red-600 scale-95'
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
            
            {/* 입찰 완료 상태 */}
            {(hasBid) && (
              <button
              disabled={true}
              className={`w-72 h-72 md:w-[28rem] md:h-[28rem] rounded-full text-4xl font-bold ${
                  isButtonPressed && isParticipating
                          ? 'bg-red-600 scale-95'
                          : 'bg-gray-700 hover:bg-gray-600'
              }`}
              style={{ maxWidth: '90vw', maxHeight: '60vh' }}
            >
              </button>
            )}
            
            {!hasGivenUp && !isBidding && gameStatus !== 'configuring' && gameStatus !== 'waiting' && gameStatus !== 'ended' && (
              <>
                <div className="space-y-4">
                  {gameStatus=='prepare' && countdown === -1 && (
                    <p className="text-lg mb-4 text-yellow-400">
                      모든 플레이어가 버튼을 누르면 5초 카운트다운이 시작됩니다
                    </p>
                  )}
                  
                  <button
                    ref={buttonRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleButtonPress}
                    onMouseUp={handleButtonRelease}
                    className={`w-80 h-80 md:w-[28rem] md:h-[28rem] rounded-full text-4xl font-bold transition-all ${
                        isButtonPressed && isParticipating
                            ? 'bg-red-600 scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    style={{ 
                      maxWidth: '90vw', 
                      maxHeight: '80vh',
                      touchAction: 'none' // 터치 동작 완전 제어
                    }}
                    disabled={hasGivenUp || isBidding}
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
                <div className="text-6xl mb-4">
                    ⚖️
                </div>
                <h2 className="text-4xl font-bold mb-4">
                유찰
                </h2>
            </div>
            ) : (
            <div className="space-y-4">
                <h2 className="text-4xl font-bold mb-4">
                {roundResult.winnerId === socket?.id 
                    ? '🎉 낙찰 성공!' 
                    : '❌ 낙찰 실패'}
                </h2>
                
                <div className="space-y-2">
                <p className="text-xl">낙찰자: {roundResult.winnerName}</p>
                <p className="text-lg text-gray-400">
                    낙찰 시간: {roundResult.winTime?.toFixed(2)}초
                </p>
                </div>
            </div>
            )}
            
            <div className="mt-8">
            <div className="text-lg text-yellow-400">
                호스트가 다음 라운드를 시작하기를 기다리는 중...
            </div>
            </div>
        </div>
        )}
      </div>
    </div>
  );
}