import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { useAuth } from '@/contexts/AuthContext';
import { useActivePreviews } from '@/hooks/useActivePreviews';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InventoryEffects() {
  const { user, token } = useAuth();
  const { previewItems } = useActivePreviews(token);
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    if (!token || !user) {
      setInventoryItems([]);
      return undefined;
    }

    const fetchInventory = async () => {
      try {
        const response = await axios.get(`${API}/inventory`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setInventoryItems(response.data.items || []);
      } catch (error) {
        console.error('Failed to load inventory effects:', error);
      }
    };

    fetchInventory();
  }, [token, user?.equipped_theme_item_id, user]);

  const activeThemeName = useMemo(() => {
    const previewTheme = previewItems.find((item) => item.type === 'theme');
    if (previewTheme) {
      return previewTheme.name;
    }

    if (!user?.equipped_theme_item_id) {
      return '';
    }

    const equippedTheme = inventoryItems.find((item) => item.id === user.equipped_theme_item_id);
    return equippedTheme?.name || '';
  }, [inventoryItems, previewItems, user?.equipped_theme_item_id]);

  useEffect(() => {
    if (activeThemeName) {
      document.body.dataset.rewardTheme = activeThemeName;
    } else {
      delete document.body.dataset.rewardTheme;
    }

    return () => {
      delete document.body.dataset.rewardTheme;
    };
  }, [activeThemeName]);

  return null;
}
