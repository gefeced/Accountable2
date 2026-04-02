import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Coins, Eye, Music, ShoppingCart, Timer, Trophy, Award, Sparkles, PawPrint, Palette } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const PREVIEW_COST = 10;

const SECTOR_ORDER = ['main', 'chores', 'fitness', 'learning', 'mind', 'faith', 'cooking'];
const SECTOR_LABELS = {
  main: 'Main Rewards',
  chores: 'Chores',
  fitness: 'Fitness',
  learning: 'Learning',
  mind: 'Mind',
  faith: 'Faith',
  cooking: 'Cooking',
};

export default function MainShop() {
  const { user, token, refreshUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPlayful = theme === 'playful';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [previewingItem, setPreviewingItem] = useState(null);
  const [activePreviews, setActivePreviews] = useState({});
  const [previewTimers, setPreviewTimers] = useState({});
  const [ownedItemIds, setOwnedItemIds] = useState([]);
  const [inventoryCounts, setInventoryCounts] = useState({});
  const timerIntervalRef = useRef(null);

  const selectedSector = searchParams.get('sector') || 'all';

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchShopItems();
    fetchActivePreviews();
    fetchInventory();
  }, [user, token, navigate]);

  useEffect(() => {
    if (Object.keys(activePreviews).length === 0) {
      return undefined;
    }

    timerIntervalRef.current = setInterval(() => {
      setPreviewTimers((prev) => {
        const updated = { ...prev };
        Object.keys(activePreviews).forEach((itemId) => {
          const expiresAt = new Date(activePreviews[itemId].expires_at);
          const remaining = Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
          updated[itemId] = remaining;
          if (remaining === 0 && prev[itemId] > 0) {
            toast.info('Preview expired!');
            setActivePreviews((current) => {
              const next = { ...current };
              delete next[itemId];
              return next;
            });
          }
        });
        return updated;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [activePreviews]);

  const fetchShopItems = async () => {
    try {
      const response = await axios.get(`${API}/shop/items/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(response.data.items || []);
    } catch (error) {
      toast.error('Failed to load shop items');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivePreviews = async () => {
    try {
      const response = await axios.get(`${API}/shop/previews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const previewsMap = {};
      const timersMap = {};
      response.data.previews.forEach((preview) => {
        previewsMap[preview.item.id] = preview;
        timersMap[preview.item.id] = preview.remaining_seconds;
      });
      setActivePreviews(previewsMap);
      setPreviewTimers(timersMap);
    } catch (error) {
      console.error('Failed to fetch active previews:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API}/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const items = response.data.items || [];
      setOwnedItemIds(items.filter((item) => item.type !== 'powerup').map((item) => item.id));
      setInventoryCounts(
        items.reduce((acc, item) => {
          acc[item.id] = item.quantity || 1;
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  const handlePreview = async (item) => {
    if (activePreviews[item.id] && previewTimers[item.id] > 0) {
      setPreviewingItem(item);
      return;
    }

    if (user.coins < PREVIEW_COST) {
      toast.error(`Insufficient coins! Preview costs ${PREVIEW_COST} coins.`);
      return;
    }

    try {
      const response = await axios.post(
        `${API}/shop/preview`,
        { item_id: item.id, sector: item.sector },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const previewData = {
        item: response.data.item,
        expires_at: response.data.expires_at,
        remaining_seconds: response.data.remaining_seconds
      };

      setActivePreviews((prev) => ({ ...prev, [item.id]: previewData }));
      setPreviewTimers((prev) => ({ ...prev, [item.id]: response.data.remaining_seconds }));
      setPreviewingItem(item);
      window.dispatchEvent(new Event('accountable-preview-updated'));
      await refreshUser();
      toast.success(`Preview started for "${item.name}"`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start preview');
    }
  };

  const handlePurchase = async (item) => {
    if (user.coins < item.cost) {
      toast.error('Insufficient coins!');
      return;
    }

    setPurchasing(item.id);
    try {
      await axios.post(
        `${API}/shop/purchase`,
        { item_id: item.id, sector: item.sector },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Purchased ${item.name}!`);
      await refreshUser();
      await fetchInventory();
      if (item.name === 'Music Player') {
        toast.success('Music Player is now available in the corner.', { duration: 5000 });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sectorGroups = useMemo(() => {
    const grouped = {};
    items.forEach((item) => {
      if (selectedSector !== 'all' && item.sector !== selectedSector) {
        return;
      }
      if (!grouped[item.sector]) {
        grouped[item.sector] = [];
      }
      grouped[item.sector].push(item);
    });
    return grouped;
  }, [items, selectedSector]);

  const getItemIcon = (item) => {
    if (item.type === 'tool' || item.type === 'music') return <Music className="w-10 h-10 text-primary" />;
    if (item.type === 'pet') return <PawPrint className="w-10 h-10 text-primary" />;
    if (item.type === 'theme') return <Palette className="w-10 h-10 text-primary" />;
    if (item.type === 'trophy') return <Trophy className="w-10 h-10 text-yellow-500" />;
    if (item.type === 'badge') return <Award className="w-10 h-10 text-blue-500" />;
    return <Sparkles className="w-10 h-10 text-primary" />;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={() => navigate('/')} variant="ghost" className={isPlayful ? 'rounded-full' : 'rounded-md'}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">🏪 Shop</h1>
          <div className="w-10"></div>
        </div>

        <div className={`bg-primary p-6 ${isPlayful ? 'rounded-[1.5rem] playful-shadow' : 'rounded-lg clean-shadow'}`}>
          <div className="flex items-center justify-between text-primary-foreground">
            <div>
              <p className="text-sm opacity-90">Spendable Coins</p>
              <p className="text-4xl font-bold">{user.coins}</p>
            </div>
            <Coins className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', ...SECTOR_ORDER].map((sectorKey) => (
            <Button
              key={sectorKey}
              variant={selectedSector === sectorKey ? 'default' : 'outline'}
              className={isPlayful ? 'rounded-full' : 'rounded-md'}
              onClick={() => navigate(sectorKey === 'all' ? '/main-shop' : `/main-shop?sector=${sectorKey}`)}
            >
              {sectorKey === 'all' ? 'All Items' : SECTOR_LABELS[sectorKey]}
            </Button>
          ))}
        </div>

        <AnimatePresence>
          {previewingItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4"
              onClick={() => setPreviewingItem(null)}
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                onClick={(event) => event.stopPropagation()}
                className={`bg-card p-8 max-w-md w-full border-2 border-primary ${isPlayful ? 'rounded-[1.5rem]' : 'rounded-lg'}`}
              >
                <div className="text-center mb-6">
                  <div className="mb-3 flex justify-center">{getItemIcon(previewingItem)}</div>
                  <h2 className="text-2xl font-bold">{previewingItem.name}</h2>
                  <p className="text-sm text-muted-foreground mt-2">{previewingItem.description}</p>
                </div>

                {activePreviews[previewingItem.id] && previewTimers[previewingItem.id] > 0 && (
                  <div className="rounded-xl border border-green-500 bg-green-500/15 p-4 text-center mb-6">
                    <div className="flex items-center justify-center gap-2 text-green-600 font-semibold">
                      <Timer className="w-4 h-4" />
                      Preview Active
                    </div>
                    <p className="text-3xl font-bold text-green-600 mt-1">{formatTime(previewTimers[previewingItem.id])}</p>
                  </div>
                )}

                <div className="rounded-xl bg-secondary p-4 text-center mb-6">
                  <p className="text-sm text-muted-foreground mb-1">Purchase Price</p>
                  <p className="text-3xl font-bold">{previewingItem.cost}</p>
                </div>

                <Button
                  onClick={() => handlePurchase(previewingItem)}
                  disabled={(previewingItem.type !== 'powerup' && ownedItemIds.includes(previewingItem.id)) || user.coins < previewingItem.cost}
                  className={`w-full ${isPlayful ? 'rounded-full' : 'rounded-md'}`}
                >
                  {previewingItem.type !== 'powerup' && ownedItemIds.includes(previewingItem.id) ? 'Already Owned' : 'Purchase Now'}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-8">
          {SECTOR_ORDER.filter((sectorKey) => sectorGroups[sectorKey]?.length).map((sectorKey) => (
            <div key={sectorKey}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold">{SECTOR_LABELS[sectorKey]}</h2>
                <span className="text-sm text-muted-foreground">
                  {sectorKey === 'main' ? 'General rewards' : `${SECTOR_LABELS[sectorKey]} look and feel`}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {sectorGroups[sectorKey].map((item) => {
                  const isOwned = ownedItemIds.includes(item.id);
                  const previewActive = activePreviews[item.id] && previewTimers[item.id] > 0;
                  const canPreview = item.type !== 'powerup';
                  const quantity = inventoryCounts[item.id] || 0;
                  return (
                    <motion.div
                      key={item.id}
                      whileHover={isPlayful ? { scale: 1.02 } : {}}
                      className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <h3 className="text-lg font-bold">{item.name}</h3>
                            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">
                              {item.sector}
                            </span>
                            {item.type === 'powerup' && quantity > 0 ? (
                              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                                x{quantity}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                          <div className="flex items-center gap-2">
                            <Coins className="w-5 h-5 text-accent" />
                            <span className="text-xl font-bold">{item.cost}</span>
                          </div>
                        </div>
                        <div>{getItemIcon(item)}</div>
                      </div>

                      <div className="space-y-2">
                        <Button
                          onClick={() => handlePurchase(item)}
                          disabled={((item.type !== 'powerup' && isOwned) || purchasing === item.id || user.coins < item.cost)}
                          className={`w-full ${isPlayful ? 'rounded-full' : 'rounded-md'}`}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          {item.type !== 'powerup' && isOwned ? 'Already Owned' : purchasing === item.id ? 'Purchasing...' : item.type === 'powerup' && quantity > 0 ? 'Buy Another' : 'Purchase'}
                        </Button>

                        {canPreview ? (
                          <Button
                            onClick={() => handlePreview(item)}
                            variant="outline"
                            disabled={isOwned || user.coins < PREVIEW_COST}
                            className={`w-full ${isPlayful ? 'rounded-full' : 'rounded-md'} ${previewActive ? 'border-green-500 text-green-600' : ''}`}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {isOwned ? 'Already Owned' : previewActive ? `Preview Active: ${formatTime(previewTimers[item.id])}` : `Preview (${PREVIEW_COST} coins)`}
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center">Powerups can only be purchased.</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
