import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Coins,
  Dumbbell,
  Pause,
  Play,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TimerReset,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SECTOR_CONFIG = {
  fitness: { name: 'Fitness', icon: '💪', title: 'Log a Workout' },
  learning: { name: 'Learning', icon: '📚', title: 'Log a Study Session' },
  mind: { name: 'Mind', icon: '🧠', title: 'Log an Activity' },
  faith: { name: 'Faith', icon: '🙏', title: 'Log an Activity' },
  cooking: { name: 'Cooking', icon: '🍳', title: 'Log an Activity' }
};

const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function GenericSectorPage() {
  const { sector } = useParams();
  const { user, token, refreshUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isPlayful = theme === 'playful';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logType, setLogType] = useState(sector === 'learning' ? 'pomodoro' : 'stopwatch');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');

  const [exerciseType, setExerciseType] = useState('strength');
  const [effortScore, setEffortScore] = useState('7');
  const [intensity, setIntensity] = useState('moderate');

  const [studyTopic, setStudyTopic] = useState('');
  const [pomodoroMinutes, setPomodoroMinutes] = useState('25');
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);

  const intervalRef = useRef(null);
  const pomodoroIntervalRef = useRef(null);

  const sectorConfig = SECTOR_CONFIG[sector] || SECTOR_CONFIG.fitness;
  const sectorXpField = `${sector}_xp`;
  const sectorLevelField = `${sector}_level`;
  const sectorCoinsField = `${sector}_coins`;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchRecentActivities();
  }, [user, sector, token, navigate]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return undefined;
    }

    intervalRef.current = setInterval(() => {
      setElapsedTime((current) => current + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  useEffect(() => {
    if (sector !== 'learning') {
      return undefined;
    }

    if (!pomodoroRunning) {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current);
      }
      return undefined;
    }

    pomodoroIntervalRef.current = setInterval(() => {
      setPomodoroSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(pomodoroIntervalRef.current);
          setPomodoroRunning(false);
          toast.success('Pomodoro finished. Save the session when you are ready.');
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current);
      }
    };
  }, [pomodoroRunning, sector]);

  useEffect(() => {
    if (sector === 'learning') {
      const nextSeconds = (parseInt(pomodoroMinutes, 10) || 25) * 60;
      setPomodoroSecondsLeft(nextSeconds);
      setPomodoroRunning(false);
    }
  }, [pomodoroMinutes, sector]);

  const fetchRecentActivities = async () => {
    try {
      const response = await axios.get(`${API}/activities/${sector}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentActivities(response.data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  const resetStopwatch = () => {
    setIsRunning(false);
    setElapsedTime(0);
  };

  const resetPomodoro = () => {
    setPomodoroRunning(false);
    setPomodoroSecondsLeft((parseInt(pomodoroMinutes, 10) || 25) * 60);
  };

  const durationSeconds = useMemo(() => {
    if (logType === 'manual') {
      return ((parseInt(manualHours, 10) || 0) * 3600) + ((parseInt(manualMinutes, 10) || 0) * 60);
    }
    if (logType === 'pomodoro') {
      return ((parseInt(pomodoroMinutes, 10) || 25) * 60) - pomodoroSecondsLeft;
    }
    return elapsedTime;
  }, [elapsedTime, logType, manualHours, manualMinutes, pomodoroMinutes, pomodoroSecondsLeft]);

  const handleComplete = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (durationSeconds <= 0) {
      toast.error('Please track some time first');
      return;
    }

    const activityMeta = {};

    if (sector === 'fitness') {
      activityMeta.exercise_type = exerciseType;
      activityMeta.effort_score = parseInt(effortScore, 10);
      activityMeta.intensity = intensity;
      activityMeta.log_type = logType;
    }

    if (sector === 'learning') {
      activityMeta.study_topic = studyTopic;
      activityMeta.log_type = logType;
      activityMeta.pomodoro_minutes = parseInt(pomodoroMinutes, 10) || 25;
      activityMeta.pomodoro_completed = logType === 'pomodoro' && pomodoroSecondsLeft === 0;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/activities`,
        { title, description, duration: durationSeconds, sector, activity_meta: activityMeta },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const activity = response.data;
      toast.success(`Activity completed! +${activity.xp_earned} XP, +${activity.coins_earned} Coins`, { duration: 4000 });

      await refreshUser();
      await fetchRecentActivities();
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });

      setTitle('');
      setDescription('');
      setElapsedTime(0);
      setIsRunning(false);
      setManualHours('');
      setManualMinutes('');
      setStudyTopic('');
      resetPomodoro();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete activity');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const sectorXpForNextLevel = Math.pow(user[sectorLevelField], 2) * 100;
  const sectorXpProgress = (user[sectorXpField] % sectorXpForNextLevel) / sectorXpForNextLevel * 100;

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={() => navigate('/')} variant="ghost" className={isPlayful ? 'rounded-full' : 'rounded-md'}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-3xl">{sectorConfig.icon}</span>
            <h1 className="text-3xl font-bold">{sectorConfig.name}</h1>
          </div>
          <Button
            onClick={() => navigate(`/main-shop?sector=${sector}`)}
            className={`${isPlayful ? 'rounded-full' : 'rounded-md'} px-6`}
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Shop
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
            <Sparkles className="w-8 h-8 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{sectorConfig.name} XP</p>
            <p className="text-2xl font-bold">{user[sectorXpField]}</p>
          </div>
          <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
            <Coins className="w-8 h-8 text-accent mb-2" />
            <p className="text-sm text-muted-foreground">{sectorConfig.name} Coins</p>
            <p className="text-2xl font-bold">{user[sectorCoinsField]}</p>
          </div>
          <div className={`col-span-2 bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{sectorConfig.name} Level</p>
              <p className="text-2xl font-bold">Level {user[sectorLevelField]}</p>
            </div>
            <Progress value={sectorXpProgress} className="h-4" />
          </div>
        </div>

        <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
          <h2 className="text-xl font-bold mb-4">{sectorConfig.title}</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={sector === 'fitness' ? 'Morning strength session' : sector === 'learning' ? 'Deep work session' : `${sectorConfig.name} activity`}
                className="mt-1"
              />
            </div>

            {sector === 'fitness' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Exercise Type</Label>
                  <Select value={exerciseType} onValueChange={setExerciseType}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strength">Strength</SelectItem>
                      <SelectItem value="cardio">Cardio</SelectItem>
                      <SelectItem value="mobility">Mobility</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Effort Score</Label>
                  <Select value={effortScore} onValueChange={setEffortScore}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, index) => (
                        <SelectItem key={index + 1} value={String(index + 1)}>{index + 1}/10</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Intensity</Label>
                  <Select value={intensity} onValueChange={setIntensity}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="max">Max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {sector === 'learning' && (
              <div>
                <Label htmlFor="study-topic">Study Topic</Label>
                <Input
                  id="study-topic"
                  value={studyTopic}
                  onChange={(event) => setStudyTopic(event.target.value)}
                  placeholder="Math, reading, coding, language study..."
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="description">Notes</Label>
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Anything useful to remember?"
                className="mt-1"
              />
            </div>

            <Tabs value={logType} onValueChange={setLogType} className="w-full">
              <TabsList className={`grid w-full ${sector === 'learning' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="stopwatch">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Stopwatch
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Clock className="w-4 h-4 mr-2" />
                  Manual
                </TabsTrigger>
                {sector === 'learning' && (
                  <TabsTrigger value="pomodoro">
                    <TimerReset className="w-4 h-4 mr-2" />
                    Pomodoro
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="stopwatch" className="mt-4">
                <div className="rounded-2xl border p-6 text-center">
                  {sector === 'fitness' && <Dumbbell className="w-10 h-10 text-primary mx-auto mb-3" />}
                  <motion.div
                    animate={isPlayful && isRunning ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-5xl font-bold mb-6"
                  >
                    {formatTime(elapsedTime)}
                  </motion.div>
                  <div className="flex justify-center gap-3">
                    <Button onClick={() => setIsRunning((current) => !current)} className={isPlayful ? 'rounded-full' : 'rounded-md'}>
                      {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      {isRunning ? 'Pause' : 'Start'}
                    </Button>
                    <Button onClick={resetStopwatch} variant="outline" className={isPlayful ? 'rounded-full' : 'rounded-md'}>
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
                    <Input id="manual-hours" type="number" min="0" value={manualHours} onChange={(event) => setManualHours(event.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="manual-minutes">Minutes</Label>
                    <Input id="manual-minutes" type="number" min="0" max="59" value={manualMinutes} onChange={(event) => setManualMinutes(event.target.value)} className="mt-1" />
                  </div>
                </div>
              </TabsContent>

              {sector === 'learning' && (
                <TabsContent value="pomodoro" className="mt-4">
                  <div className="rounded-2xl border p-6 text-center space-y-4">
                    <div className="max-w-xs mx-auto">
                      <Label htmlFor="pomodoro-minutes">Focus Minutes</Label>
                      <Select value={pomodoroMinutes} onValueChange={setPomodoroMinutes}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="25">25 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">60 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <motion.div
                      animate={isPlayful && pomodoroRunning ? { scale: [1, 1.02, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-5xl font-bold"
                    >
                      {formatTime(pomodoroSecondsLeft)}
                    </motion.div>
                    <div className="flex justify-center gap-3">
                      <Button onClick={() => setPomodoroRunning((current) => !current)} className={isPlayful ? 'rounded-full' : 'rounded-md'}>
                        {pomodoroRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {pomodoroRunning ? 'Pause' : 'Start'}
                      </Button>
                      <Button onClick={resetPomodoro} variant="outline" className={isPlayful ? 'rounded-full' : 'rounded-md'}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            <Button onClick={handleComplete} disabled={loading} className={`w-full ${isPlayful ? 'rounded-full' : 'rounded-md'}`}>
              {loading ? 'Saving...' : 'Save Activity'}
            </Button>
          </div>
        </div>

        <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
          <h2 className="text-xl font-bold mb-4">Recent {sectorConfig.name} Sessions</h2>
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-2">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent sessions yet.</p>
            ) : recentActivities.map((activity) => (
              <div key={activity.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{new Date(activity.completed_at).toLocaleString()}</p>
                    {activity.activity_meta?.exercise_type && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {activity.activity_meta.exercise_type} • effort {activity.activity_meta.effort_score}/10 • {activity.activity_meta.intensity}
                      </p>
                    )}
                    {activity.activity_meta?.study_topic && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {activity.activity_meta.study_topic} • {activity.activity_meta.log_type}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-primary">+{activity.xp_earned} XP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
