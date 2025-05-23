import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { motion } from 'framer-motion';

export default function Display() {
  const { roomCode } = useParams();
  const { socket } = useSocket();
  
  const [currentRound, setCurrentRound] = useState(1);
  const [countdown, setCountdown] = useState(-1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [roundResult, setRoundResult] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('room:updated', (room: any) => {
      setPlayers(room.players.filter((p: any) => p.role === 'player'));
    });

    socket.on('round:prepare', (round: number) => {
      setCurrentRound(round);
      setGameStatus('prepare');
      setElapsedTime(0);
      setRoundResult(null);
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

    socket.on('round:ended', (result: any) => {
      setRoundResult(result);
      setGameStatus('roundEnd');
    });

    return () => {
      socket.off('room:updated');
      socket.off('round:prepare');
      socket.off('game:countdown');
      socket.off('time:update');
      socket.off('round:ended');
    };
  }, [socket]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-8">라운드 {currentRound}</h1>

        {gameStatus === 'prepare' && countdown > 0 && (
          <motion.div
            key={countdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="text-9xl font-bold text-yellow-400"
          >
            {countdown}
          </motion.div>
        )}

        {gameStatus === 'playing' && (
          <div className="space-y-8">
            <div className="text-8xl font-mono">
              {elapsedTime.toFixed(1)}s
            </div>
            <div className="text-2xl text-gray-400">
              경매 진행 중...
            </div>
          </div>
        )}

        {gameStatus === 'roundEnd' && roundResult && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-4"
          >
            {roundResult.isDraw ? (
              <div className="text-6xl">⚖️ 유찰</div>
            ) : (
              <>
                <div className="text-6xl">🎉</div>
                <div className="text-4xl">
                  낙찰: {roundResult.winnerName}
                </div>
                <div className="text-2xl text-gray-400">
                  {roundResult.winTime?.toFixed(2)}초
                </div>
              </>
            )}
          </motion.div>
        )}

        <div className="mt-12 flex justify-center gap-8">
          {players.map((player) => (
            <div key={player.id} className="text-center">
              <div className="text-xl mb-2">{player.name}</div>
              <div className="text-3xl font-bold">{player.wins} 승</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}