import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Package, Check, Music, Palette, PawPrint, Trophy, Sparkles } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Inventory() {
  const { user, token, refreshUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isPlayful = theme === 'playful';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchInventory();
  }, [user, token, navigate]);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API}/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(response.data.items || []);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleEquipToggle = async (item) => {
    setUpdatingId(item.id);
    try {
      await axios.post(
        `${API}/inventory/equip`,
        { item_id: item.id, equipped: !item.equipped },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshUser();
      await fetchInventory();
      toast.success(item.equipped ? `${item.name} unequipped` : `${item.name} equipped`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not update item');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const getIcon = (type) => {
    if (type === 'theme') return <Palette className="w-5 h-5 text-primary" />;
    if (type === 'pet') return <PawPrint className="w-5 h-5 text-primary" />;
    if (type === 'music') return <Music className="w-5 h-5 text-primary" />;
    if (type === 'powerup') return <Sparkles className="w-5 h-5 text-primary" />;
    return <Trophy className="w-5 h-5 text-primary" />;
  };

  const canEquip = (item) => ['theme', 'pet', 'music', 'powerup'].includes(item.type) || (item.type === 'tool' && item.name === 'Music Player');

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <div className="w-10"></div>
        </div>

        <div className={`bg-primary p-6 ${isPlayful ? 'rounded-[1.5rem] playful-shadow' : 'rounded-lg clean-shadow'}`}>
          <div className="flex items-center justify-between text-primary-foreground">
            <div>
              <p className="text-sm opacity-90">Owned Rewards</p>
              <p className="text-4xl font-bold">{items.length}</p>
            </div>
            <Package className="w-10 h-10 opacity-80" />
          </div>
        </div>

        <div className="space-y-4">
          {items.length === 0 ? (
            <div className={`bg-card p-6 border ${isPlayful ? 'rounded-[1.5rem] playful-border playful-shadow' : 'rounded-lg clean-border clean-shadow'}`}>
              <p className="text-muted-foreground">Buy items in the shops to see them here.</p>
            </div>
          ) : items.map((item) => (
            <div
              key={item.id}
              className={`bg-card p-6 border ${isPlayful ? 'rounded-[1.5rem] playful-border playful-shadow' : 'rounded-lg clean-border clean-shadow'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    {getIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">{item.name}</h2>
                      {item.equipped && (
                        <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                          Equipped
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{item.type}</p>
                    {item.type === 'powerup' ? (
                      <p className="mt-1 text-sm font-medium text-primary">Quantity: {item.quantity || 0}</p>
                    ) : null}
                  </div>
                </div>

                {canEquip(item) ? (
                  <Button
                    onClick={() => handleEquipToggle(item)}
                    disabled={updatingId === item.id}
                    variant={item.equipped ? 'outline' : 'default'}
                    className={isPlayful ? 'rounded-full' : 'rounded-md'}
                  >
                    {item.equipped ? <Check className="w-4 h-4 mr-2" /> : null}
                    {updatingId === item.id ? 'Saving...' : item.type === 'powerup' ? (item.equipped ? 'Deactivate' : 'Activate') : item.equipped ? 'Unequip' : 'Equip'}
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Owned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
