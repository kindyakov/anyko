'use client';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { SegmentedControl } from '@/components/ui/segmented-control';
const subscribe = () => () => undefined;
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <SegmentedControl
      label="Тема оформления"
      value={mounted ? theme : undefined}
      onValueChange={setTheme}
      items={[
        {
          value: 'light',
          label: <Sun size={16} aria-hidden />,
          accessibleLabel: 'Светлая тема',
        },
        {
          value: 'dark',
          label: <Moon size={16} aria-hidden />,
          accessibleLabel: 'Тёмная тема',
        },
        {
          value: 'system',
          label: <Monitor size={16} aria-hidden />,
          accessibleLabel: 'Системная тема',
        },
      ]}
    />
  );
}
