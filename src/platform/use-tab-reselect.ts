// Tocar la pestaña en la que ya estás: sube al inicio y actualiza (como Instagram).
// Si la pestaña no está activa, el toque solo cambia de pestaña.

import { useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';

interface TabNavigation {
  addListener(type: 'tabPress', callback: () => void): () => void;
  isFocused(): boolean;
}

export function useTabReselect(onReselect: () => void) {
  const navigation = useNavigation() as unknown as TabNavigation;
  const callback = useRef(onReselect);
  useEffect(() => {
    callback.current = onReselect;
  }, [onReselect]);

  useEffect(
    () =>
      navigation.addListener('tabPress', () => {
        if (navigation.isFocused()) callback.current();
      }),
    [navigation],
  );
}
