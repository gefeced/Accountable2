import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useActivePreviews } from '@/hooks/useActivePreviews';
import { Button } from '@/components/ui/button';
import { Pause, Play, SkipBack, SkipForward, Music } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TRACK_LIBRARY = {
  'Chill Beats': {
    duration: 48,
    notes: [261.63, 329.63, 392.0, 329.63, 293.66, 329.63, 392.0, 440.0],
  },
  'Focus Flow': {
    duration: 52,
    notes: [220.0, 246.94, 293.66, 329.63, 293.66, 246.94, 220.0, 196.0],
  },
  'Motivational Rise': {
    duration: 44,
    notes: [293.66, 329.63, 369.99, 440.0, 493.88, 440.0, 369.99, 329.63],
  },
  'Demo Loop': {
    duration: 36,
    notes: [261.63, 293.66, 329.63, 392.0, 329.63, 293.66],
  },
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getTrackConfig = (name) => TRACK_LIBRARY[name] || TRACK_LIBRARY['Demo Loop'];

export default function MusicPlayer() {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const { activePreviews, previewTimers } = useActivePreviews(token);
  const isPlayful = theme === 'playful';

  const [mainItems, setMainItems] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const audioContextRef = useRef(null);
  const playbackRef = useRef(null);
  const lastToneStepRef = useRef(-1);
  const previousPreviewActiveRef = useRef(false);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const fetchMainItems = async () => {
      try {
        const response = await axios.get(`${API}/shop/items/main`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMainItems(response.data);
      } catch (error) {
        console.error('Failed to fetch main shop items:', error);
      }
    };

    fetchMainItems();
  }, [token]);

  const musicPlayerItem = useMemo(
    () => mainItems.find((item) => item.name === 'Music Player'),
    [mainItems]
  );

  const previewItems = useMemo(
    () => Object.values(activePreviews).map((preview) => preview.item),
    [activePreviews]
  );

  const previewedTracks = previewItems.filter((item) => item.type === 'music');
  const ownedTracks = mainItems.filter(
    (item) => item.type === 'music' && user?.music_tracks_owned?.includes(item.id)
  );

  const trackPool = useMemo(() => {
    const deduped = new Map();

    ownedTracks.forEach((track) => deduped.set(track.name, track));
    previewedTracks.forEach((track) => deduped.set(track.name, track));

    if (deduped.size === 0 && musicPlayerItem && activePreviews[musicPlayerItem.id]) {
      deduped.set('Demo Loop', { id: 'demo-loop', name: 'Demo Loop', type: 'music' });
    }

    return Array.from(deduped.values());
  }, [ownedTracks, previewedTracks, musicPlayerItem, activePreviews]);

  const hasOwnedPlayer = Boolean(user?.music_player_owned);
  const hasPreviewPlayer = Boolean(musicPlayerItem && activePreviews[musicPlayerItem.id]);
  const isVisible = (hasOwnedPlayer && user?.music_player_enabled) || hasPreviewPlayer;

  const currentTrack = trackPool[currentTrackIndex] || trackPool[0];
  const currentTrackConfig = currentTrack ? getTrackConfig(currentTrack.name) : null;
  const currentDuration = currentTrackConfig?.duration || 0;

  useEffect(() => {
    if (user?.equipped_music_item_id) {
      const equippedIndex = trackPool.findIndex((track) => track.id === user.equipped_music_item_id);
      if (equippedIndex >= 0) {
        setCurrentTrackIndex(equippedIndex);
      }
    }
  }, [trackPool, user?.equipped_music_item_id]);

  useEffect(() => {
    if (!isVisible && isPlaying) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isVisible, isPlaying]);

  useEffect(() => {
    if (trackPool.length === 0) {
      setCurrentTrackIndex(0);
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    if (currentTrackIndex > trackPool.length - 1) {
      setCurrentTrackIndex(0);
    }
  }, [trackPool, currentTrackIndex]);

  useEffect(() => {
    const previewStillActive = Boolean(musicPlayerItem && previewTimers[musicPlayerItem.id] > 0);
    if (previousPreviewActiveRef.current && !previewStillActive && !hasOwnedPlayer) {
      toast.info('Music player preview ended.');
    }
    previousPreviewActiveRef.current = previewStillActive;
  }, [musicPlayerItem, previewTimers, hasOwnedPlayer]);

  useEffect(() => {
    if (!isPlaying || !currentTrackConfig) {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
      return undefined;
    }

    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }

    const playTone = (frequency) => {
      if (!audioContextRef.current) {
        return;
      }
      const osc = audioContextRef.current.createOscillator();
      const gain = audioContextRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(audioContextRef.current.destination);
      osc.start();
      osc.stop(audioContextRef.current.currentTime + 0.18);
    };

    playbackRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.25;
        const noteStep = Math.floor(next / 0.75);

        if (noteStep !== lastToneStepRef.current) {
          lastToneStepRef.current = noteStep;
          const notes = currentTrackConfig.notes;
          playTone(notes[noteStep % notes.length]);
        }

        if (next >= currentTrackConfig.duration) {
          lastToneStepRef.current = -1;
          setCurrentTrackIndex((index) => (index + 1) % trackPool.length);
          return 0;
        }

        return next;
      });
    }, 250);

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, currentTrackConfig, trackPool.length]);

  useEffect(() => () => {
    if (playbackRef.current) {
      clearInterval(playbackRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, []);

  const handleTogglePlayback = async () => {
    if (!currentTrack) {
      toast.info('Preview or buy a track to use the music player.');
      return;
    }

    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    setIsPlaying((prev) => !prev);
  };

  const handleSkip = (direction) => {
    if (trackPool.length === 0) {
      return;
    }
    lastToneStepRef.current = -1;
    setCurrentTime(0);
    setCurrentTrackIndex((prev) => {
      if (direction === 'next') {
        return (prev + 1) % trackPool.length;
      }
      return (prev - 1 + trackPool.length) % trackPool.length;
    });
  };

  const handleScrub = (event) => {
    lastToneStepRef.current = -1;
    setCurrentTime(Number(event.target.value));
  };

  if (!isVisible) {
    return null;
  }

  const previewCountdown = hasPreviewPlayer && musicPlayerItem ? previewTimers[musicPlayerItem.id] : 0;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-[320px] border bg-card/95 p-4 shadow-2xl backdrop-blur ${
        isPlayful ? 'rounded-[1.25rem] playful-border' : 'rounded-lg clean-border'
      }`}
      data-testid="music-player"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-2">
            <Music className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Music Player</p>
            <p className="text-xs text-muted-foreground">
              {hasOwnedPlayer ? 'Owned' : `Preview active: ${formatTime(previewCountdown)}`}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {currentTrack ? currentTrack.name : 'No tracks'}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="range"
          min="0"
          max={currentDuration || 1}
          step="0.25"
          value={Math.min(currentTime, currentDuration || 1)}
          onChange={handleScrub}
          className="w-full"
          data-testid="music-progress"
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(currentDuration)}</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleSkip('previous')}
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
            data-testid="previous-track"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleTogglePlayback}
            className={`${isPlayful ? 'rounded-full' : 'rounded-md'} px-5`}
            data-testid="play-pause"
          >
            {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleSkip('next')}
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
            data-testid="next-track"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
