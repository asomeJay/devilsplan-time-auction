import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState<'player' | 'display'>('player');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { socket, connected } = useSocket();

  const joinGame = () => {
    if (!playerName.trim() || !socket) {
      setError('이름을 입력해주세요.');
      return;
    }

    if (!connected) {
      setError('서버에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsJoining(true);
    setError('');

    console.log('게임 참가 시도:', { playerName, role });

    socket.emit('game:join', playerName, role);
    
    const joinTimeout = setTimeout(() => {
      setIsJoining(false);
      setError('게임 참가 요청이 시간 초과되었습니다.');
    }, 5000);

    socket.once('game:joined', () => {
      clearTimeout(joinTimeout);
      setIsJoining(false);
      console.log('게임 참가 성공');
      if (role === 'display') {
        navigate('/display');
      } else {
        navigate('/game');
      }
    });

    socket.once('error', (errorMessage) => {
      clearTimeout(joinTimeout);
      setIsJoining(false);
      setError(errorMessage || '게임 참가에 실패했습니다.');
      console.error('게임 참가 에러:', errorMessage);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">시간 경매 게임</h1>
        
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              플레이어 이름
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-md"
              placeholder="이름을 입력하세요"
              disabled={isJoining}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">참가 방식</label>
            <div className="space-y-3">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="radio"
                    value="player"
                    checked={role === 'player'}
                    onChange={(e) => setRole(e.target.value as 'player' | 'display')}
                    className="sr-only"
                    disabled={isJoining}
                  />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${
                    role === 'player' 
                      ? 'border-green-500 bg-green-500' 
                      : 'border-gray-400 bg-transparent'
                  }`}>
                    {role === 'player' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                </div>
                <span className="text-white">플레이어로 참가</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="radio"
                    value="display"
                    checked={role === 'display'}
                    onChange={(e) => setRole(e.target.value as 'player' | 'display')}
                    className="sr-only"
                    disabled={isJoining}
                  />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${
                    role === 'display' 
                      ? 'border-green-500 bg-green-500' 
                      : 'border-gray-400 bg-transparent'
                  }`}>
                    {role === 'display' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                </div>
                <span className="text-white">디스플레이로 참가 (호스트)</span>
              </label>
            </div>
            
            <div className="text-xs text-gray-400 mt-2">
              {role === 'display' 
                ? "게임 화면을 표시하고 호스트가 되어 게임을 관리합니다"
                : "게임에 직접 참여하여 입찰합니다"
              }
            </div>
          </div>

          <button
            onClick={joinGame}
            disabled={isJoining || !connected}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium"
          >
            {isJoining ? '참가 중...' : '게임 참가하기'}
          </button>

          {!connected && (
            <p className="text-sm text-yellow-400 text-center">
              서버에 연결하는 중...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}