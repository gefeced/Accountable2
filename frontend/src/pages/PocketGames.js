import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export default function PocketGames() {
  const { user, token, refreshUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPlayful = theme === 'playful';

  const [activeGame, setActiveGame] = useState(searchParams.get('tab') || 'tictactoe');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveGame(tab);
  }, [searchParams]);

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">🎮 Pocket Games</h1>
          <div className="w-10"></div>
        </div>

        <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Play games to earn small coin rewards and have fun!
          </p>

          <Tabs value={activeGame} onValueChange={setActiveGame} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tictactoe">Tic-Tac-Toe</TabsTrigger>
              <TabsTrigger value="chess">Chess</TabsTrigger>
              <TabsTrigger value="checkers">Checkers</TabsTrigger>
            </TabsList>

            <TabsContent value="tictactoe">
              <TicTacToe isPlayful={isPlayful} user={user} token={token} refreshUser={refreshUser} />
            </TabsContent>

            <TabsContent value="chess">
              <ChessGame isPlayful={isPlayful} user={user} token={token} refreshUser={refreshUser} />
            </TabsContent>

            <TabsContent value="checkers">
              <CheckersGame isPlayful={isPlayful} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// Tic-Tac-Toe Component
function TicTacToe({ isPlayful, user, token, refreshUser }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [winner, setWinner] = useState(null);

  const calculateWinner = (squares) => {
    for (let line of WINNING_LINES) {
      const [a, b, c] = line;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const awardCoins = async (amount) => {
    if (!user || !token) {
      return;
    }
    try {
      await axios.post(
        `${API}/user/coins`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshUser();
    } catch (error) {
      console.error('Failed to award coins:', error);
    }
  };

  const getBotMove = (squares) => {
    const available = squares
      .map((cell, index) => (cell ? null : index))
      .filter((value) => value !== null);

    const findWinningMove = (player) => {
      for (const line of WINNING_LINES) {
        const values = line.map((index) => squares[index]);
        const playerCount = values.filter((value) => value === player).length;
        const emptyIndex = line.find((index) => !squares[index]);
        if (playerCount === 2 && emptyIndex !== undefined) {
          return emptyIndex;
        }
      }
      return null;
    };

    return (
      findWinningMove('O')
      ?? findWinningMove('X')
      ?? (available.includes(4) ? 4 : null)
      ?? [0, 2, 6, 8].find((index) => available.includes(index))
      ?? available[0]
    );
  };

  const handleClick = async (index) => {
    if (board[index] || winner) return;

    const playerBoard = [...board];
    playerBoard[index] = 'X';
    setBoard(playerBoard);

    const playerWinner = calculateWinner(playerBoard);
    if (playerWinner) {
      setWinner(playerWinner);
      toast.success('You won! +5 coins');
      await awardCoins(5);
      return;
    }

    if (playerBoard.every(Boolean)) {
      setWinner('draw');
      return;
    }

    const botMove = getBotMove(playerBoard);
    if (botMove === null || botMove === undefined) {
      setWinner('draw');
      return;
    }

    const botBoard = [...playerBoard];
    botBoard[botMove] = 'O';
    setBoard(botBoard);

    const botWinner = calculateWinner(botBoard);
    if (botWinner) {
      setWinner(botWinner);
    } else if (botBoard.every(Boolean)) {
      setWinner('draw');
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setWinner(null);
  };

  return (
    <div className="py-6">
      <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto mb-4">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className={`h-24 text-4xl font-bold border-2 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'} ${
              cell === 'X' ? 'text-primary' : cell === 'O' ? 'text-accent' : 'text-muted-foreground'
            } hover:bg-secondary transition-colors`}
            data-testid={`ttt-cell-${index}`}
          >
            {cell}
          </button>
        ))}
      </div>

      {winner && (
        <div className="text-center mb-4">
          <p className="text-xl font-bold">
            {winner === 'X' ? '🎉 You Won!' : winner === 'draw' ? 'It\'s a draw!' : 'Computer Won!'}
          </p>
        </div>
      )}

      <div className="text-center">
        <Button onClick={resetGame} className={isPlayful ? 'rounded-full' : 'rounded-md'}>
          New Game
        </Button>
      </div>
    </div>
  );
}

// Chess Component
function ChessGame({ isPlayful, user, token, refreshUser }) {
  const [game, setGame] = useState(new Chess());
  const [gamePosition, setGamePosition] = useState(game.fen());
  const [boardWidth, setBoardWidth] = useState(380);

  useEffect(() => {
    const updateBoardWidth = () => {
      setBoardWidth(Math.max(260, Math.min(400, window.innerWidth - 48)));
    };

    updateBoardWidth();
    window.addEventListener('resize', updateBoardWidth);
    return () => window.removeEventListener('resize', updateBoardWidth);
  }, []);

  const awardCoins = async (amount) => {
    if (!user || !token) {
      return;
    }
    try {
      await axios.post(
        `${API}/user/coins`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshUser();
    } catch (error) {
      console.error('Failed to award coins:', error);
    }
  };

  function onDrop({ sourceSquare, targetSquare }) {
    const gameCopy = new Chess(game.fen());
    
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (move === null) return false;

      setGame(gameCopy);
      setGamePosition(gameCopy.fen());
      
      if (gameCopy.isCheckmate()) {
        toast.success('Checkmate! +10 coins');
        awardCoins(10);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGamePosition(newGame.fen());
  };

  return (
    <div className="py-6">
      <div className="max-w-md mx-auto mb-4">
        <Chessboard
          options={{
            id: 'accountable-chessboard',
            position: gamePosition,
            onPieceDrop: onDrop,
            boardStyle: {
              width: `${boardWidth}px`,
              maxWidth: '100%',
              borderRadius: isPlayful ? '1.5rem' : '0.5rem',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
            }
          }}
        />
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          {game.isCheckmate() ? '🏆 Checkmate!' : game.isCheck() ? '⚠️ Check!' : `${game.turn() === 'w' ? 'White' : 'Black'} to move`}
        </p>
        <Button onClick={resetGame} className={isPlayful ? 'rounded-full' : 'rounded-md'}>
          New Game
        </Button>
      </div>
    </div>
  );
}

// Checkers Component (Simplified)
function CheckersGame({ isPlayful }) {
  return (
    <div className="py-6 text-center">
      <div className="grid grid-cols-8 gap-1 max-w-md mx-auto mb-4 aspect-square">
        {Array(64).fill(null).map((_, index) => {
          const row = Math.floor(index / 8);
          const col = index % 8;
          const isDark = (row + col) % 2 === 1;
          return (
            <div
              key={index}
              className={`aspect-square ${
                isDark ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            >
              {/* Simplified checkers board */}
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground mb-4">Checkers game coming soon!</p>
      <p className="text-sm text-muted-foreground">Full implementation with AI opponent will be available in the next update.</p>
    </div>
  );
}
