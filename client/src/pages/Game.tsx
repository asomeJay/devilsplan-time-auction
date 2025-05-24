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

    socket.on('time:update', () => {
      setLastEvent('time:update');
    });

    socket.on('bid:confirmed', () => {
      console.log('Received bid:confirmed event');
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
      setIsGameActive(false);
      setIsButtonPressed(false);
      setIsParticipating(false);
    });

    return () => {
      socket.off('round:prepare');
      socket.off('game:countdown');
      socket.off('round:started');
      socket.off('time:update');
      socket.off('bid:confirmed');
      socket.off('player:giveup');
      socket.off('round:ended');
      socket.off('game:ended');
    };
  }, [socket, vibrate]);

  const handleButtonPress = () => {
    if (!socket || hasBid || hasGivenUp) return;
    
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
      isParticipating 
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
        <div className="text-xs text-gray-300 mt-2">
          Status: {gameStatus} | Socket: {socketConnected ? 'Connected' : 'Disconnected'} | Last: {lastEvent}
        </div>
        <div className="text-xs text-gray-300">
          Participating: {isParticipating ? 'Yes' : 'No'} | Pressed: {isButtonPressed ? 'Yes' : 'No'}
        </div>
      </div>

      <div className="flex-main-mobile flex items-center justify-center p-4 safe-bottom touch-manipulation">
        {gameStatus === 'waiting' && (
          <div className="text-center w-full">
            <h2 className="text-2xl mb-4">게임 대기 중...</h2>
            <p className="text-gray-400">다른 플레이어들을 기다리고 있습니다.</p>
          </div>
        )}

        {gameStatus!='roundEnd' && (
          <div className="text-center w-full">
            {hasGivenUp && (
              <div className="space-y-4">
                <div className="w-48 h-48 rounded-full bg-gray-600 flex items-center justify-center mx-auto">
                  <div className="text-center">
                    <div className="text-2xl font-bold">포기</div>
                    <div className="text-lg">이번 라운드 불참</div>
                  </div>
                </div>
              </div>
            )}
            {!hasGivenUp && (
              <>
                <div className="space-y-4">
                  {gameStatus=='prepare' && countdown === -1 && (
                    <p className="text-lg mb-4 text-yellow-400">
                      모든 플레이어가 버튼을 누르면 5초 카운트다운이 시작됩니다
                    </p>
                  )} 
                  <button
                    ref={buttonRef}
                    onTouchStart={handleButtonPress}
                    onTouchEnd={handleButtonRelease}
                    onMouseDown={handleButtonPress}
                    onMouseUp={handleButtonRelease}
                    className={`w-48 h-48 rounded-full text-2xl font-bold transition-all ${
                      isButtonPressed && isParticipating
                        ? 'bg-green-600 scale-95' 
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    disabled={hasGivenUp}
                  >
                    {hasGivenUp 
                      ? '포기함' 
                      : isButtonPressed && isParticipating
                        ? countdown > 0 ? '참여 중...' : '대기 중...'
                        : '버튼 누르기'
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {gameStatus === 'roundEnd' && roundResult && (
          <div className="text-center w-full">
            <h2 className="text-4xl font-bold mb-4">
              {roundResult.winnerId === socket?.id 
                ? '🎉 낙찰!' 
                : roundResult.isDraw 
                  ? '⚖️ 유찰' 
                  : '❌ 실패'}
            </h2>
            {roundResult.winnerName && (
              <div className="space-y-2">
                <p className="text-xl">낙찰자: {roundResult.winnerName}</p>
                <p className="text-lg text-gray-400">
                  입찰 시간: {roundResult.winTime?.toFixed(2)}초
                </p>
              </div>
            )}
            {roundResult.isDraw && (
              <p className="text-lg text-gray-400">
                아무도 입찰하지 않았습니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}