import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';
import { Sparkles, Coins, Flame, TrendingUp, Settings, Trophy, Award, ShoppingBag, Package } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

const sectors = [
  { id: 'chores', name: 'Chores', icon: '🧹', active: true },
  { id: 'fitness', name: 'Fitness', icon: '💪', active: true },
  { id: 'learning', name: 'Learning', icon: '📚', active: true },
  { id: 'cooking', name: 'Cooking', icon: '🍳', active: true },
  { id: 'mind', name: 'Mind', icon: '🧠', active: true },
  { id: 'faith', name: 'Faith', icon: '🙏', active: true }
];

const CORE_SECTORS = ['chores', 'fitness', 'learning', 'cooking'];
const OPTIONAL_SECTORS = ['mind', 'faith'];

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isPlayful = theme === 'playful';
  const [enabledExtraSectors, setEnabledExtraSectors] = useState(() => {
    const saved = localStorage.getItem('accountable-extra-sectors');
    if (!saved) {
      return [];
    }
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((value) => OPTIONAL_SECTORS.includes(value)) : [];
    } catch (error) {
      return [];
    }
  });
  const [showExplorePanel, setShowExplorePanel] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    localStorage.setItem('accountable-extra-sectors', JSON.stringify(enabledExtraSectors));
  }, [enabledExtraSectors]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const xpForNextLevel = Math.pow((user.accountable_level), 2) * 100;
  const xpProgress = (user.accountable_xp % xpForNextLevel) / xpForNextLevel * 100;
  const visibleSectors = sectors.filter((sector) => (
    CORE_SECTORS.includes(sector.id) || enabledExtraSectors.includes(sector.id)
  ));

  const handleToggleExtraSector = (sectorId) => {
    setEnabledExtraSectors((current) => (
      current.includes(sectorId)
        ? current.filter((value) => value !== sectorId)
        : [...current, sectorId]
    ));
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">Welcome back,</h1>
            <p className="text-xl text-muted-foreground">{user.username}</p>
          </div>
          <motion.div
            animate={isPlayful ? { rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            <Sparkles className="w-10 h-10 text-primary" />
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* XP Card */}
          <motion.div
            whileHover={isPlayful ? { scale: 1.02 } : {}}
            className={`col-span-2 bg-primary p-6 ${isPlayful ? 'rounded-[1.5rem] playful-shadow' : 'rounded-lg clean-shadow'}`}
            data-testid="xp-card"
          >
            <div className="flex items-center justify-between text-primary-foreground">
              <div>
                <p className="text-sm opacity-90">Total Accountable XP</p>
                <p className="text-4xl font-bold">{user.accountable_xp}</p>
              </div>
              <TrendingUp className="w-12 h-12 opacity-80" />
            </div>
          </motion.div>

          {/* Level Card */}
          <div className={`col-span-2 bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`} data-testid="level-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Accountable Level</p>
              <p className="text-2xl font-bold">Level {user.accountable_level}</p>
            </div>
            <Progress value={xpProgress} className="h-4" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.floor(xpProgress)}% to Level {user.accountable_level + 1}
            </p>
          </div>

          {/* Coins Card */}
          <motion.div
            whileHover={isPlayful ? { scale: 1.05 } : {}}
            className={`col-span-2 bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}
            data-testid="coins-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Coins className="w-10 h-10 text-accent" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Coins</p>
                  <p className="text-3xl font-bold text-foreground">{user.coins}</p>
                </div>
              </div>
              <Coins className="w-8 h-8 text-accent/70" />
            </div>
          </motion.div>

          {/* Streak Card */}
          <motion.div
            whileHover={isPlayful ? { scale: 1.05 } : {}}
            className={`col-span-2 bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}
            data-testid="streak-card"
          >
            <Flame className="w-8 h-8 text-orange-500 mb-2" />
            <p className="text-sm text-muted-foreground">Daily Streak</p>
            <p className="text-2xl font-bold text-foreground">{user.streak} days</p>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate('/main-shop')}
              className={`${isPlayful ? 'rounded-full' : 'rounded-md'} h-14`}
              data-testid="main-shop-button"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Shop
            </Button>
            <Button
              onClick={() => navigate('/leaderboard')}
              className={`${isPlayful ? 'rounded-full' : 'rounded-md'} h-14`}
              variant="outline"
              data-testid="leaderboard-button"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Board
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate('/achievements')}
              className={`${isPlayful ? 'rounded-full' : 'rounded-md'} h-14`}
              variant="outline"
              data-testid="achievements-button"
            >
              <Award className="w-5 h-5 mr-2" />
              Awards
            </Button>
            <Button
              onClick={() => navigate('/settings')}
              className={`${isPlayful ? 'rounded-full' : 'rounded-md'} h-14`}
              variant="outline"
              data-testid="settings-button"
            >
              <Settings className="w-5 h-5 mr-2" />
              Settings
            </Button>
          </div>
          <Button
            onClick={() => navigate('/inventory')}
            className={`${isPlayful ? 'rounded-full' : 'rounded-md'} h-14 w-full`}
            variant="outline"
            data-testid="inventory-button"
          >
            <Package className="w-5 h-5 mr-2" />
            Inventory
          </Button>
        </div>

        {/* Sectors */}
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Sectors</h2>
            <Button
              variant="outline"
              onClick={() => setShowExplorePanel((current) => !current)}
              className={isPlayful ? 'rounded-full' : 'rounded-md'}
            >
              Explore More Sectors
            </Button>
          </div>

          {showExplorePanel ? (
            <div className={`mb-4 border p-4 ${isPlayful ? 'rounded-[1.5rem]' : 'rounded-lg'}`}>
              <p className="mb-3 text-sm text-muted-foreground">
                Enable or hide the optional sectors on your dashboard.
              </p>
              <div className="flex flex-wrap gap-2">
                {OPTIONAL_SECTORS.map((sectorId) => {
                  const sector = sectors.find((item) => item.id === sectorId);
                  const enabled = enabledExtraSectors.includes(sectorId);
                  return (
                    <Button
                      key={sectorId}
                      variant={enabled ? 'default' : 'outline'}
                      onClick={() => handleToggleExtraSector(sectorId)}
                      className={isPlayful ? 'rounded-full' : 'rounded-md'}
                    >
                      <span className="mr-2">{sector.icon}</span>
                      {enabled ? `Hide ${sector.name}` : `Show ${sector.name}`}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            {visibleSectors.map((sector) => (
              <motion.div
                key={sector.id}
                whileHover={sector.active && isPlayful ? { scale: 1.05 } : {}}
                whileTap={sector.active ? { scale: 0.95 } : {}}
                onClick={() => sector.active && navigate(`/sector/${sector.id}`)}
                className={`relative bg-card p-6 border cursor-pointer transition-all ${
                  isPlayful ? 'rounded-[1.5rem] playful-border' : 'rounded-lg clean-border'
                } ${
                  sector.active
                    ? isPlayful ? 'playful-shadow hover:shadow-lg' : 'clean-shadow hover:shadow-md'
                    : 'opacity-50 cursor-not-allowed grayscale'
                }`}
                data-testid={`sector-${sector.id}`}
              >
                <div className="text-4xl mb-2">{sector.icon}</div>
                <p className="font-bold text-lg">{sector.name}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Pocket Tools */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Pocket Accountable Tools</h2>
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              whileHover={isPlayful ? { scale: 1.05 } : {}}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/tools?tab=calendar')}
              className={`bg-card p-6 border cursor-pointer ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'} text-center hover:bg-secondary/50 transition-colors`}
              data-testid="tool-calendar"
            >
              <div className="text-4xl mb-2">📅</div>
              <p className="font-bold text-lg">Calendar</p>
            </motion.div>
            <motion.div
              whileHover={isPlayful ? { scale: 1.05 } : {}}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/tools?tab=calculator')}
              className={`bg-card p-6 border cursor-pointer ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'} text-center hover:bg-secondary/50 transition-colors`}
              data-testid="tool-calculator"
            >
              <div className="text-4xl mb-2">🔢</div>
              <p className="font-bold text-lg">Calculator</p>
            </motion.div>
            <motion.div
              whileHover={isPlayful ? { scale: 1.05 } : {}}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/tools?tab=calories')}
              className={`bg-card p-6 border cursor-pointer ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'} text-center hover:bg-secondary/50 transition-colors`}
              data-testid="tool-calories"
            >
              <div className="text-4xl mb-2">🔥</div>
              <p className="font-bold text-lg">Calorie Tracker</p>
            </motion.div>
          </div>
        </div>

        {/* Pocket Games */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Pocket Games</h2>
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              whileHover={isPlayful ? { scale: 1.05 } : {}}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/games?tab=tictactoe')}
              className={`bg-card p-6 border cursor-pointer ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'} text-center hover:bg-secondary/50 transition-colors`}
              data-testid="game-tictactoe"
            >
              <div className="text-4xl mb-2">⭕</div>
              <p className="font-bold text-lg">Tic-Tac-Toe</p>
            </motion.div>
            <motion.div
              whileHover={isPlayful ? { scale: 1.05 } : {}}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/games?tab=chess')}
              className={`bg-card p-6 border cursor-pointer ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'} text-center hover:bg-secondary/50 transition-colors`}
              data-testid="game-chess"
            >
              <div className="text-4xl mb-2">♟️</div>
              <p className="font-bold text-lg">Chess</p>
            </motion.div>
            <motion.div
              whileHover={isPlayful ? { scale: 1.05 } : {}}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/games?tab=checkers')}
              className={`bg-card p-6 border cursor-pointer ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'} text-center hover:bg-secondary/50 transition-colors opacity-60`}
              data-testid="game-checkers"
            >
              <div className="text-4xl mb-2">⚫</div>
              <p className="font-bold text-lg">Checkers</p>
              <p className="text-xs text-muted-foreground mt-1">Coming Soon</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
