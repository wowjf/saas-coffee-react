import React, { useEffect, useState } from 'react';
import { setSystemTextOverrides, subscribeSystemTexts } from '../shared/system-texts';
import { apiRequest } from '../lib/api';

export const SystemTextsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, forceRender] = useState(0);

  useEffect(() => subscribeSystemTexts(() => forceRender((value) => value + 1)), []);

  useEffect(() => {
    let cancelled = false;

    apiRequest<{ overrides: Record<string, string> }>('/api/system-texts')
      .then((result) => {
        if (!cancelled) {
          setSystemTextOverrides(result.overrides || {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSystemTextOverrides({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
};