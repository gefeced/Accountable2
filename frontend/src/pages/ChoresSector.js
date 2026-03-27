import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckSquare, Clock, Coins, Flame, Pause, Play, RotateCcw, ShoppingBag, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import confetti from 'canvas-confetti';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formatTimer = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatSummaryTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
};

export default function ChoresSector() {
  const { user, token, refreshUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isPlayful = theme === 'playful';

  const [description, setDescription] = useState('');
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [recentChores, setRecentChores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logType, setLogType] = useState('timer');
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [choreTemplates, setChoreTemplates] = useState([]);
  const [completedChores, setCompletedChores] = useState([]);
  const [newChoreName, setNewChoreName] = useState('');
  const [sessionSummary, setSessionSummary] = useState(null);

  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchRecentChores();
    fetchChoreTemplates();
  }, [user, token, navigate]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime((current) => current + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const fetchRecentChores = async () => {
    try {
      const response = await axios.get(`${API}/activities/chores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentChores(response.data);
    } catch (error) {
      console.error('Failed to fetch chores:', error);
    }
  };

  const fetchChoreTemplates = async () => {
    try {
      const response = await axios.get(`${API}/chores/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChoreTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to fetch chore templates:', error);
    }
  };

  const persistTemplates = async (nextTemplates) => {
    const response = await axios.patch(
      `${API}/chores/templates`,
      { templates: nextTemplates },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setChoreTemplates(response.data.templates || []);
  };

  const handleAddChoreTemplate = async () => {
    const nextName = newChoreName.trim();
    if (!nextName) {
      toast.error('Enter a chore name first');
      return;
    }

    if (choreTemplates.some((chore) => chore.toLowerCase() === nextName.toLowerCase())) {
      toast.error('That chore is already in your list');
      return;
    }

    try {
      await persistTemplates([...choreTemplates, nextName]);
      setCompletedChores((current) => [...current, nextName]);
      setNewChoreName('');
      toast.success('Chore added to your menu');
    } catch (error) {
      toast.error('Failed to save your chore menu');
    }
  };

  const handleToggleChore = (chore) => {
    setCompletedChores((current) => (
      current.includes(chore)
        ? current.filter((item) => item !== chore)
        : [...current, chore]
    ));
  };

  const handleStartStop = () => {
    setIsRunning((current) => !current);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
  };

  const durationSeconds = useMemo(() => {
    if (logType === 'timer') {
      return time;
    }
    const hours = parseInt(manualHours, 10) || 0;
    const minutes = parseInt(manualMinutes, 10) || 0;
    return (hours * 3600) + (minutes * 60);
  }, [logType, time, manualHours, manualMinutes]);

  const summaryPreview = useMemo(() => {
    const timeXp = durationSeconds > 0 ? Math.max(10, Math.floor(durationSeconds / 60)) : 0;
    const choreXp = completedChores.length * 10;
    const dailyBonusXp = user?.last_chores_date === new Date().toISOString().slice(0, 10) ? 0 : 20;
    const totalXp = timeXp + choreXp + dailyBonusXp;

    return {
      timeXp,
      choreXp,
      dailyBonusXp,
      totalXp,
    };
  }, [completedChores.length, durationSeconds, user?.last_chores_date]);

  const handleComplete = async () => {
    if (durationSeconds === 0) {
      toast.error('Track some time first');
      return;
    }

    if (completedChores.length === 0) {
      toast.error('Select at least one completed chore');
      return;
    }

    const generatedTitle = completedChores.length === 1
      ? completedChores[0]
      : `Chore session (${completedChores.length} chores)`;

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/activities`,
        {
          title: generatedTitle,
          description,
          duration: durationSeconds,
          sector: 'chores',
          activity_meta: {
            completed_chores: completedChores,
            session_label: generatedTitle,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const activity = response.data;
      setSessionSummary(activity);

      toast.success(`Session saved! +${activity.xp_earned} XP, +${activity.coins_earned} coins`);

      await refreshUser();
      await fetchRecentChores();
      await fetchChoreTemplates();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.65 } });

      setDescription('');
      setTime(0);
      setManualHours('');
      setManualMinutes('');
      setCompletedChores([]);
      setIsRunning(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save chore session');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const choreXpForNextLevel = Math.pow(user.chores_level, 2) * 100;
  const choreXpProgress = (user.chores_xp % choreXpForNextLevel) / choreXpForNextLevel * 100;
  const sessionCard = sessionSummary || {
    xp_earned: summaryPreview.totalXp,
    coins_earned: summaryPreview.totalXp,
    duration: durationSeconds,
    completed_at: new Date().toISOString(),
    activity_meta: {
      completed_chores: completedChores,
      time_xp: summaryPreview.timeXp,
      chore_xp: summaryPreview.choreXp,
      daily_bonus_xp: summaryPreview.dailyBonusXp,
      base_xp: summaryPreview.totalXp,
      multipliers: [],
    },
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">Chores</h1>
          <Button
            onClick={() => navigate('/shop/chores')}
            className={`${isPlayful ? 'rounded-full' : 'rounded-md'} px-6`}
            data-testid="shop-button"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Shop
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className={`bg-card p-5 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
            <Sparkles className="w-8 h-8 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Chore XP</p>
            <p className="text-2xl font-bold">{user.chores_xp}</p>
          </div>
          <div className={`bg-card p-5 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
            <Coins className="w-8 h-8 text-accent mb-2" />
            <p className="text-sm text-muted-foreground">Chore Coins</p>
            <p className="text-2xl font-bold">{user.chores_coins}</p>
          </div>
          <div className={`bg-card p-5 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
            <Flame className="w-8 h-8 text-orange-500 mb-2" />
            <p className="text-sm text-muted-foreground">Daily Chore Streak</p>
            <p className="text-2xl font-bold">{user.chores_streak || 0} days</p>
          </div>
          <div className={`bg-card p-5 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
            <p className="text-sm text-muted-foreground mb-2">Chore Level</p>
            <p className="text-2xl font-bold mb-3">Level {user.chores_level}</p>
            <Progress value={choreXpProgress} className="h-3" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
          <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Chore Session</h2>
                <p className="text-sm text-muted-foreground">Check off completed chores, track the time, then save the session.</p>
              </div>
              <CheckSquare className="w-8 h-8 text-primary" />
            </div>

            <div className="space-y-5">
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
                  <div className="rounded-2xl border p-6 text-center">
                    <motion.div
                      animate={isPlayful && isRunning ? { scale: [1, 1.02, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="mb-5 text-5xl font-bold"
                      data-testid="timer-display"
                    >
                      {formatTimer(time)}
                    </motion.div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button
                        onClick={handleStartStop}
                        className={isPlayful ? 'rounded-full' : 'rounded-md'}
                        data-testid="timer-start-stop-button"
                      >
                        {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {isRunning ? 'Pause' : 'Start'}
                      </Button>
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className={isPlayful ? 'rounded-full' : 'rounded-md'}
                        data-testid="timer-reset-button"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="manual" className="mt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="manual-hours">Hours</Label>
                      <Input
                        id="manual-hours"
                        type="number"
                        min="0"
                        value={manualHours}
                        onChange={(event) => setManualHours(event.target.value)}
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
                        onChange={(event) => setManualMinutes(event.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Chores completed</Label>
                  <p className="text-sm text-muted-foreground">{completedChores.length} selected</p>
                </div>
                <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {choreTemplates.map((chore) => {
                    const checked = completedChores.includes(chore);
                    return (
                      <button
                        key={chore}
                        type="button"
                        onClick={() => handleToggleChore(chore)}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                          checked ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/40'
                        }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                          {checked ? '✓' : ''}
                        </div>
                        <span className="font-medium">{chore}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={newChoreName}
                  onChange={(event) => setNewChoreName(event.target.value)}
                  placeholder="e.g., Take out trash"
                  data-testid="new-chore-input"
                />
                <Button
                  type="button"
                  onClick={handleAddChoreTemplate}
                  className={isPlayful ? 'rounded-full' : 'rounded-md'}
                  data-testid="add-chore-button"
                >
                  Add
                </Button>
              </div>

              <div>
                <Label htmlFor="description">Notes (Optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Anything worth remembering about this session?"
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleComplete}
                className={`w-full ${isPlayful ? 'rounded-full' : 'rounded-md'}`}
                disabled={loading}
                data-testid="complete-chore-button"
              >
                {loading ? 'Saving session...' : 'Save Session'}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Session Summary</h2>
                <p className="text-sm text-muted-foreground">
                  {new Date(sessionCard.completed_at).toLocaleString()}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border p-4">
                  <p className="text-sm text-muted-foreground">Time Spent</p>
                  <p className="text-2xl font-bold">{formatSummaryTime(sessionCard.duration)}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-sm text-muted-foreground">XP Earned</p>
                  <p className="text-2xl font-bold">+{sessionCard.xp_earned}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-sm text-muted-foreground">Coins Earned</p>
                  <p className="text-2xl font-bold">+{sessionCard.coins_earned}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-sm text-muted-foreground">Chores Done</p>
                  <p className="text-2xl font-bold">{sessionCard.activity_meta.completed_chores?.length || 0}</p>
                </div>
              </div>

              <div className="mt-5 space-y-1 text-sm">
                <p><span className="font-semibold">Chores:</span> {(sessionCard.activity_meta.completed_chores?.length || 0)} x 10 = +{sessionCard.activity_meta.chore_xp || 0} XP</p>
                <p><span className="font-semibold">Time:</span> {formatSummaryTime(sessionCard.duration)} = +{sessionCard.activity_meta.time_xp || 0} XP</p>
                <p><span className="font-semibold">Daily bonus:</span> +{sessionCard.activity_meta.daily_bonus_xp || 0} XP</p>
                <p><span className="font-semibold">Total:</span> {sessionCard.activity_meta.base_xp || sessionCard.xp_earned}</p>
              </div>

              <div className="mt-5 rounded-2xl border p-4">
                <p className="mb-3 text-sm font-semibold text-muted-foreground">Completed chores</p>
                <div className="flex flex-wrap gap-2">
                  {(sessionCard.activity_meta.completed_chores || []).length > 0 ? (
                    sessionCard.activity_meta.completed_chores.map((chore) => (
                      <span key={chore} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        {chore}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Select chores to see the session breakdown here.</p>
                  )}
                </div>
              </div>
            </div>

            <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
              <h2 className="text-xl font-bold mb-4">Recent Sessions</h2>
              <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-2">
                {recentChores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No chore sessions logged yet.</p>
                ) : (
                  recentChores.map((activity) => (
                    <div key={activity.id} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{activity.title}</p>
                          <p className="text-sm text-muted-foreground">{new Date(activity.completed_at).toLocaleString()}</p>
                        </div>
                        <p className="font-bold text-primary">+{activity.xp_earned} XP</p>
                      </div>
                      {activity.activity_meta?.completed_chores?.length > 0 && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {activity.activity_meta.completed_chores.join(', ')}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
