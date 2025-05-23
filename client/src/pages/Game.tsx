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
  const [roundResult, setRoundResult] = useState<any>(null);
  const [wins, setWins] = useState(0);
  
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('round:prepare', (round: number) => {
      setCurrentRound(round);
      setGameStatus('prepare');
      setRoundResult(null);
    });

    socket.on('game:countdown', (seconds: number) => {
      setCountdown(seconds);
      if (seconds === 5) {
        vibrate(100);
      }
    });

    socket.on('round:started', () => {
      setGameStatus('playing');
      setCountdown(-1);
    });

    socket.on('round:ended', (result: any) => {
      setRoundResult(result);
      setGameStatus('roundEnd');
      
      if (result.winnerId === socket.id) {
        setWins(prev => prev + 1);
        vibrate([100, 50, 100]);
      }
    });

    socket.on('game:ended', (results: any) => {
      setGameStatus('ended');
      // 게임 종료 처리
    });

    return () => {
      socket.off('round:prepare');
      socket.off('game:countdown');
      socket.off('round:started');
      socket.off('round:ended');
      socket.off('game:ended');
    };
  }, [socket, vibrate]);

  const handleButtonPress = () => {
    if (!socket || gameStatus !== 'prepare') return;
    
    setIsButtonPressed(true);
    socket.emit('player:ready', roomCode);
    vibrate(50);
  };

  const handleButtonRelease = () => {
    if (!socket || gameStatus !== 'playing') return;
    
    setIsButtonPressed(false);
    socket.emit('player:bid', roomCode);
    vibrate(30);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-4 bg-gray-800">
        <div className="flex justify-between items-center">
          <div>라운드 {currentRound}/19</div>
          <div>승리: {wins}</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {gameStatus === 'prepare' && (
          <div className="text-center">
            <h2 className="text-2xl mb-8">준비하세요!</h2>
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
              {isButtonPressed ? '준비 완료' : '버튼 누르기'}
            </button>
            {countdown > 0 && (
              <div className="mt-8 text-6xl font-bold">{countdown}</div>
            )}
          </div>
        )}

        {gameStatus === 'playing' && (
          <div className="text-center">
            <h2 className="text-2xl mb-8">경매 진행 중!</h2>
            <button
              onTouchEnd={handleButtonRelease}
              onMouseUp={handleButtonRelease}
              className="w-48 h-48 rounded-full bg-red-600 text-2xl font-bold"
            >
              입찰하기
            </button>
          </div>
        )}

        {gameStatus === 'roundEnd' && roundResult && (
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">
              {roundResult.winnerId === socket.id 
                ? '🎉 낙찰!' 
                : roundResult.isDraw 
                  ? '⚖️ 유찰' 
                  : '❌ 실패'}
            </h2>
            {roundResult.winnerName && (
              <p className="text-xl">낙찰자: {roundResult.winnerName}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}