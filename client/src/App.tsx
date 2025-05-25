import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Game from './pages/Game';
import Display from './pages/Display';
import Results from './pages/Results';
import { SocketProvider } from './contexts/SocketContext';

function App() {
  return (
    <SocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<Game />} />
            <Route path="/display" element={<Display />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </div>
      </Router>
    </SocketProvider>
  );
}

export default App;