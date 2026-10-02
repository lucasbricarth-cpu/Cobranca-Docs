'use client';
import { useEffect } from 'react';

/** Registra o service worker do PWA uma vez. */
export function RegistrarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
