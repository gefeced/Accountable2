import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useActivePreviews } from '@/hooks/useActivePreviews';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const MOVEMENT_INTERVAL_MS = 30000;

const PET_CONFIGS = {
  'Mop Pet': {
    image: '/pets/mop_pet.png',
    label: 'Mop',
    messages: [
      'Mop says the floor is cleaner than your excuses.',
      'Quick win: one task at a time still counts.',
      'I would help fold laundry, but I have no arms.',
      'You are building momentum. Keep it moving.',
    ],
  },
  'Book Pet': {
    image: '/pets/notebook_pet.png',
    label: 'Notebook',
    messages: [
      'Notebook says tiny focus sessions still stack up.',
      'A good study block beats a perfect plan.',
      'Plot twist: the notes were inside you all along.',
      'Keep going. Future you likes this version of you.',
    ],
  },
  'Dove Pet': {
    image: '/pets/dove_pet.png',
    label: 'Dove',
    messages: [
      'Dove says peace and progress can happen together.',
      'Small faithful steps still count as steps.',
      'I checked. Grace still covers messy days.',
      'Breathe, reset, continue.',
    ],
  },
  'Chef Hat Pet': {
    image: '/pets/chef_pet.png',
    label: 'Chef',
    messages: [
      'Chef says the secret ingredient is showing up.',
      'If dinner gets weird, call it experimental.',
      'Progress tastes better than perfection.',
      'You cook, I supervise dramatically.',
    ],
  },
};

const CORNER_POSITIONS = [
  { x: 0, y: 0, rotate: 0, scale: 1 },
  { x: -18, y: -12, rotate: -4, scale: 1.02 },
  { x: -6, y: 8, rotate: 3, scale: 0.98 },
  { x: -28, y: 4, rotate: -2, scale: 1.01 },
];

const getRandomMessage = (petName) => {
  const config = PET_CONFIGS[petName];
  if (!config) {
    return '';
  }
  const index = Math.floor(Math.random() * config.messages.length);
  return config.messages[index];
};

export default function PetAnimation() {
  const { user, token, refreshUser } = useAuth();
  const { activePreviews, previewTimers } = useActivePreviews(token);
  const [ownedPets, setOwnedPets] = useState([]);
  const [cornerPosition, setCornerPosition] = useState(CORNER_POSITIONS[0]);
  const [speechMessage, setSpeechMessage] = useState('');
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setOwnedPets([]);
      return undefined;
    }

    const fetchOwnedPets = async () => {
      try {
        const response = await axios.get(`${API}/pets/owned`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOwnedPets(response.data.pets || []);
      } catch (error) {
        console.error('Failed to fetch owned pets:', error);
      }
    };

    fetchOwnedPets();
  }, [user, token]);

  const previewPets = useMemo(
    () => Object.values(activePreviews)
      .map((preview) => preview.item)
      .filter((item) => item.type === 'pet' && PET_CONFIGS[item.name]),
    [activePreviews]
  );

  const activePet = useMemo(() => {
    if (previewPets.length > 0) {
      return previewPets[0];
    }

    if (user?.equipped_pet_item_id) {
      const equipped = ownedPets.find((pet) => pet.id === user.equipped_pet_item_id);
      if (equipped && PET_CONFIGS[equipped.name]) {
        return equipped;
      }
    }

    return ownedPets.find((pet) => PET_CONFIGS[pet.name]) || null;
  }, [ownedPets, previewPets, user?.equipped_pet_item_id]);

  useEffect(() => {
    if (!activePet) {
      setSpeechMessage('');
      setShowBubble(false);
      return undefined;
    }

    let bubbleTimeout = null;

    const triggerPetMoment = () => {
      const nextPosition = CORNER_POSITIONS[Math.floor(Math.random() * CORNER_POSITIONS.length)];
      setCornerPosition(nextPosition);
      setSpeechMessage(getRandomMessage(activePet.name));
      setShowBubble(true);

      if (bubbleTimeout) {
        clearTimeout(bubbleTimeout);
      }
      bubbleTimeout = setTimeout(() => {
        setShowBubble(false);
      }, 8000);
    };

    triggerPetMoment();
    const interval = setInterval(triggerPetMoment, MOVEMENT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (bubbleTimeout) {
        clearTimeout(bubbleTimeout);
      }
    };
  }, [activePet]);

  const handlePetClick = async () => {
    if (!activePet || !token) {
      return;
    }

    try {
      const response = await axios.post(
        `${API}/pets/interact`,
        { pet_id: activePet.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        confetti({
          particleCount: 24,
          spread: 45,
          origin: { x: 0.9, y: 0.85 },
        });
        setSpeechMessage(`${getRandomMessage(activePet.name)} +${response.data.xp_awarded} XP`);
        setShowBubble(true);
        toast.success(`${PET_CONFIGS[activePet.name].label} is cheering for you.`, { duration: 2500 });
        await refreshUser();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Pet interaction failed');
    }
  };

  if (!activePet || !PET_CONFIGS[activePet.name]) {
    return null;
  }

  const config = PET_CONFIGS[activePet.name];
  const previewRemaining = previewTimers[activePet.id];

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      <AnimatePresence mode="wait">
        <motion.div
          key={activePet.id}
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{
            opacity: 1,
            scale: cornerPosition.scale,
            x: cornerPosition.x,
            y: cornerPosition.y,
            rotate: cornerPosition.rotate,
          }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="relative"
        >
          <AnimatePresence>
            {showBubble && speechMessage && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute -top-24 right-2 max-w-[240px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-xl"
              >
                <p>{speechMessage}</p>
                {previewRemaining ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Preview ends in {Math.floor(previewRemaining / 60)}:{String(previewRemaining % 60).padStart(2, '0')}
                  </p>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={handlePetClick}
            className="pointer-events-auto rounded-full bg-white/90 p-2 shadow-xl transition-transform hover:scale-105"
            data-testid="pet-animation"
          >
            <img
              src={config.image}
              alt={config.label}
              className="h-24 w-24 object-contain"
            />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
