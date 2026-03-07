import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, ArrowLeft, ShoppingBag, Sparkles, Coins, Clock } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import confetti from 'canvas-confetti';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SECTOR_CONFIG = {
  chores: { name: 'Chores', icon: '🧹', color: 'from-blue-500 to-cyan-500' },
  fitness: { name: 'Fitness', icon: '💪', color: 'from-red-500 to-orange-500' },
  learning: { name: 'Learning', icon: '📚', color: 'from-purple-500 to-pink-500' },
  mind: { name: 'Mind', icon: '🧠', color: 'from-indigo-500 to-blue-500' },
  faith: { name: 'Faith', icon: '🙏', color: 'from-yellow-500 to-amber-500' },
  cooking: { name: 'Cooking', icon: '🍳', color: 'from-green-500 to-emerald-500' }
};

export default function GenericSectorPage() {
  const { sector } = useParams();
  const { user, token, refreshUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isPlayful = theme === 'playful';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logType, setLogType] = useState('timer');
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const intervalRef = useRef(null);

  const sectorConfig = SECTOR_CONFIG[sector] || SECTOR_CONFIG.chores;
  const sectorXpField = `${sector}_xp`;
  const sectorLevelField = `${sector}_level`;
  const sectorCoinsField = `${sector}_coins`;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchRecentActivities();
  }, [user, sector]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime(t => t + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const fetchRecentActivities = async () => {
    try {
      const response = await axios.get(`${API}/activities/${sector}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentActivities(response.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  const handleStartStop = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleComplete = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    let durationSeconds = 0;
    
    if (logType === 'timer') {
      if (time === 0) {
        toast.error('Timer must be greater than 0');
        return;
      }
      durationSeconds = time;
    } else {
      const hours = parseInt(manualHours) || 0;
      const minutes = parseInt(manualMinutes) || 0;
      if (hours === 0 && minutes === 0) {
        toast.error('Please enter a valid duration');
        return;
      }
      durationSeconds = (hours * 3600) + (minutes * 60);
    }

    const oldLevel = user[sectorLevelField];

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/activities`,
        { title, description, duration: durationSeconds, sector },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const activity = response.data;
      toast.success(
        `Activity completed! +${activity.xp_earned} XP, +${activity.coins_earned} Coins`,
        { duration: 4000 }
      );

      await refreshUser();
      
      const updatedUser = await axios.get(`${API}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (updatedUser.data[sectorLevelField] > oldLevel) {
        triggerConfetti();
        toast.success(`🎉 Level Up! You're now Level ${updatedUser.data[sectorLevelField]}!`, { duration: 5000 });
      }

      await fetchRecentActivities();

      setTitle('');
      setDescription('');
      setTime(0);
      setManualHours('');
      setManualMinutes('');
      setIsRunning(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete activity');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) return null;

  const sectorXpForNextLevel = Math.pow(user[sectorLevelField], 2) * 100;
  const sectorXpProgress = (user[sectorXpField] % sectorXpForNextLevel) / sectorXpForNextLevel * 100;

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-3xl">{sectorConfig.icon}</span>
            <h1 className="text-3xl font-bold">{sectorConfig.name}</h1>
          </div>
          <Button
            onClick={() => navigate(`/shop/${sector}`)}
            className={`${isPlayful ? 'rounded-full' : 'rounded-md'} px-6`}
            data-testid="shop-button"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Shop
          </Button>
        </div>

        {/* Sector Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`} data-testid="sector-xp-card">
            <Sparkles className="w-8 h-8 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{sectorConfig.name} XP</p>
            <p className="text-2xl font-bold text-foreground">{user[sectorXpField]}</p>
          </div>

          <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`} data-testid="sector-coins-card">
            <Coins className="w-8 h-8 text-accent mb-2" />
            <p className="text-sm text-muted-foreground">{sectorConfig.name} Coins</p>
            <p className="text-2xl font-bold text-foreground">{user[sectorCoinsField]}</p>
          </div>

          <div className={`col-span-2 bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`} data-testid="sector-level-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{sectorConfig.name} Level</p>
              <p className="text-2xl font-bold">Level {user[sectorLevelField]}</p>
            </div>
            <Progress value={sectorXpProgress} className="h-4" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.floor(sectorXpProgress)}% to Level {user[sectorLevelField] + 1}
            </p>
          </div>
        </div>

        {/* Activity Form */}
        <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
          <h2 className="text-xl font-bold mb-4">Log an Activity</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Activity Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`e.g., ${sector === 'fitness' ? 'Morning workout' : sector === 'learning' ? 'Study session' : `${sectorConfig.name} activity`}`}
                data-testid="activity-title-input"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                data-testid="activity-description-input"
                className="mt-1"
              />
            </div>

            <Tabs value={logType} onValueChange={setLogType} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="timer" data-testid="timer-tab">
                  <Play className="w-4 h-4 mr-2" />
                  Timer
                </TabsTrigger>
                <TabsTrigger value="manual" data-testid="manual-tab">
                  <Clock className="w-4 h-4 mr-2" />
                  Manual Entry
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timer" className="mt-4">
                <div className="text-center py-6">
                  <motion.div
                    animate={isPlayful && isRunning ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-6xl font-bold mb-6"
                    data-testid="timer-display"
                  >
                    {formatTime(time)}
                  </motion.div>

                  <div className="flex gap-4 justify-center">
                    <Button
                      onClick={handleStartStop}
                      className={isPlayful ? 'rounded-full' : 'rounded-md'}
                      data-testid="timer-start-stop-button"
                    >
                      {isRunning ? (
                        <><Pause className="w-4 h-4 mr-2" /> Pause</>
                      ) : (
                        <><Play className="w-4 h-4 mr-2" /> Start</>
                      )}
                    </Button>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className={isPlayful ? 'rounded-full' : 'rounded-md'}
                      data-testid="timer-reset-button"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" /> Reset
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <div className="py-6 space-y-4">
                  <div className="text-center mb-4">
                    <Clock className="w-12 h-12 text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Enter the time you spent</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="manual-hours">Hours</Label>
                      <Input
                        id="manual-hours"
                        type="number"
                        min="0"
                        value={manualHours}
                        onChange={(e) => setManualHours(e.target.value)}
                        placeholder="0"
                        data-testid="manual-hours-input"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="manual-minutes">Minutes</Label>
                      <Input
                        id="manual-minutes"
                        type="number"
                        min="0"
                        max="59"
                        value={manualMinutes}
                        onChange={(e) => setManualMinutes(e.target.value)}
                        placeholder="0"
                        data-testid="manual-minutes-input"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {(manualHours || manualMinutes) && (
                    <div className="text-center text-sm text-muted-foreground">
                      Total: {manualHours || '0'}h {manualMinutes || '0'}m
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Button
              onClick={handleComplete}
              className={`w-full ${isPlayful ? 'rounded-full' : 'rounded-md'}`}
              disabled={loading || !title.trim() || (logType === 'timer' && time === 0) || (logType === 'manual' && !manualHours && !manualMinutes)}
              data-testid="complete-activity-button"
            >
              {loading ? 'Completing...' : 'Complete Activity'}
            </Button>
          </div>
        </div>

        {/* Recent Activities */}
        {recentActivities.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Recent Activities</h2>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`bg-card p-4 border ${isPlayful ? 'playful-border rounded-[1.5rem]' : 'clean-border rounded-lg'}`}
                  data-testid={`recent-activity-${activity.id}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{activity.title}</p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-primary font-semibold">+{activity.xp_earned} XP</p>
                      <p className="text-accent font-semibold">+{activity.coins_earned} Coins</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatTime(activity.duration)} • {new Date(activity.completed_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}