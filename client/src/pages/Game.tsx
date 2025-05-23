import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useVibration } from '../hooks/useVibration';

export default function Game() {
  const { roomCode } = useParams();
  const { socket } = useSocket();
  const vibrate = useVibration();
  
  const [gameStatus, setGameStatus] = useState('waiting');
  const [currentRound, setCurrentRound] = useState(1);
  const [countdown, setCountdown] = useState(-1);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [hasBid, setHasBid] = useState(false);
  const [bidTime, setBidTime] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [wins, setWins] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState('none');
  
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 게임 참여 알림
  useEffect(() => {
    if (!socket || !roomCode) return;
    
    console.log('Joining game room:', roomCode);
    socket.emit('game:join', roomCode);
    
  }, [socket, roomCode]);

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
    if (!socket || !roomCode) return;

    socket.on('round:prepare', (round: number) => {
      console.log('Received round:prepare event', round);
      setLastEvent('round:prepare');
      setCurrentRound(round);
      setGameStatus('prepare');
      setRoundResult(null);
      setHasBid(false);
      setBidTime(null);
      setElapsedTime(0);
      setIsGameActive(false);
      setIsButtonPressed(false);
    });

    socket.on('game:countdown', (seconds: number) => {
      console.log('Received game:countdown event', seconds);
      setLastEvent('game:countdown');
      setCountdown(seconds);
      if (seconds === 5) {
        vibrate(100);
      }
    });

    socket.on('round:started', () => {
      console.log('Received round:started event');
      setLastEvent('round:started');
      setGameStatus('playing');
      setIsGameActive(true);
      setCountdown(-1);
    });

    socket.on('time:update', (time: number) => {
      setLastEvent('time:update');
      setElapsedTime(time);
    });

    socket.on('bid:confirmed', (data: { bidTime: number }) => {
      console.log('Received bid:confirmed event', data);
      setLastEvent('bid:confirmed');
      setHasBid(true);
      setBidTime(data.bidTime / 1000);
      setIsButtonPressed(false);
      setIsGameActive(false);
      vibrate(50);
    });

    socket.on('round:ended', (result: any) => {
      console.log('Received round:ended event', result);
      setLastEvent('round:ended');
      setRoundResult(result);
      setGameStatus('roundEnd');
      setIsGameActive(false);
      setIsButtonPressed(false);
      
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
    });

    return () => {
      socket.off('round:prepare');
      socket.off('game:countdown');
      socket.off('round:started');
      socket.off('time:update');
      socket.off('bid:confirmed');
      socket.off('round:ended');
      socket.off('game:ended');
    };
  }, [socket, vibrate, roomCode]);

  const handleButtonPress = () => {
    if (!socket || !roomCode || hasBid) return;
    
    setIsButtonPressed(true);
    socket.emit('button:press', roomCode);
    vibrate(50);
  };

  const handleButtonRelease = () => {
    if (!socket || !roomCode || !isButtonPressed) return;
    
    setIsButtonPressed(false);
    
    // 게임이 활성화된 상태에서만 입찰 처리
    if (isGameActive && !hasBid) {
      socket.emit('button:release', roomCode);
      vibrate(30);
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
          Room: {roomCode} | Round: {currentRound} | Active: {isGameActive ? 'Yes' : 'No'}
        </div>
      </div>

      <div className="flex-main-mobile flex items-center justify-center p-4 safe-bottom touch-manipulation">
        {gameStatus === 'waiting' && (
          <div className="text-center w-full">
            <h2 className="text-2xl mb-4">게임 대기 중...</h2>
            <p className="text-gray-400">다른 플레이어들을 기다리고 있습니다.</p>
          </div>
        )}

        {gameStatus === 'prepare' && !isGameActive && (
          <div className="text-center w-full">
            <h2 className="text-2xl mb-8">준비하세요!</h2>
            <p className="text-lg mb-4 text-yellow-400">
              모든 플레이어가 버튼을 누르면 게임이 시작됩니다
            </p>
            <button
              ref={buttonRef}
              onTouchStart={handleButtonPress}
              onTouchEnd={handleButtonRelease}
              onMouseDown={handleButtonPress}
              onMouseUp={handleButtonRelease}
              className={`w-48 h-48 rounded-full text-2xl font-bold transition-all ${
                isButtonPressed 
                  ? 'bg-green-600 scale-95' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {isButtonPressed ? '대기 중...' : '버튼 누르기'}
            </button>
            {countdown > 0 && (
              <div className="mt-8 text-6xl font-bold">{countdown}</div>
            )}
          </div>
        )}

        {(gameStatus === 'prepare' || gameStatus === 'playing') && isGameActive && (
          <div className="text-center w-full">
            <h2 className="text-2xl mb-4">경매 진행 중!</h2>
            <div className="text-4xl font-mono mb-8">
              {elapsedTime.toFixed(1)}초
            </div>
            
            {!hasBid ? (
              <div className="space-y-4">
                <button
                  onTouchStart={handleButtonPress}
                  onTouchEnd={handleButtonRelease}
                  onMouseDown={handleButtonPress}
                  onMouseUp={handleButtonRelease}
                  className={`w-48 h-48 rounded-full text-2xl font-bold transition-all ${
                    isButtonPressed 
                      ? 'bg-red-800 scale-95' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isButtonPressed ? '누르는 중...' : '버튼 누르기'}
                </button>
                <p className="text-sm text-gray-400">
                  버튼을 누르고 있는 동안 시간이 흘러갑니다!<br/>
                  가장 늦게 손을 떼는 사람이 승리합니다!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-48 h-48 rounded-full bg-green-600 flex items-center justify-center mx-auto">
                  <div className="text-center">
                    <div className="text-2xl font-bold">입찰 완료</div>
                    <div className="text-lg">{bidTime?.toFixed(2)}초</div>
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  다른 플레이어들을 기다리는 중...
                </p>
              </div>
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