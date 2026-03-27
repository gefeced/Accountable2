import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export function useActivePreviews(token) {
  const [activePreviews, setActivePreviews] = useState({});
  const [previewTimers, setPreviewTimers] = useState({});
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setActivePreviews({});
      setPreviewTimers({});
      return undefined;
    }

    const fetchPreviews = async () => {
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

    fetchPreviews();
    const handleImmediateRefresh = () => {
      fetchPreviews();
    };
    window.addEventListener('accountable-preview-updated', handleImmediateRefresh);
    pollRef.current = setInterval(fetchPreviews, 15000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      window.removeEventListener('accountable-preview-updated', handleImmediateRefresh);
    };
  }, [token]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (Object.keys(activePreviews).length === 0) {
      return undefined;
    }

    timerRef.current = setInterval(() => {
      setPreviewTimers((prev) => {
        const next = {};

        Object.entries(activePreviews).forEach(([itemId, preview]) => {
          const expiresAt = new Date(preview.expires_at);
          const remaining = Math.max(0, Math.floor((expiresAt - new Date()) / 1000));
          if (remaining > 0) {
            next[itemId] = remaining;
          }
        });

        return next;
      });

      setActivePreviews((prev) => {
        const next = {};
        let changed = false;
        Object.entries(prev).forEach(([itemId, preview]) => {
          const expiresAt = new Date(preview.expires_at);
          if (expiresAt > new Date()) {
            next[itemId] = preview;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activePreviews]);

  const previewItems = useMemo(
    () => Object.values(activePreviews).map((preview) => preview.item),
    [activePreviews]
  );

  return { activePreviews, previewTimers, previewItems };
}
