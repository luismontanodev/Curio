// Barra de pestañas: Inicio, Destacados, Guardados y Mis datos.

import { Text } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { Award, Bookmark, House, User, type LucideIcon } from 'lucide-react-native';

import { ICON } from '../../src/components/primitives.tsx';
import { useTheme } from '../../src/platform/app-state.tsx';

export default function TabsLayout() {
  const t = useTheme();
  const c = t.colors;

  // El activo va en `primaryText` (600); el resto en `muted`.
  const tint = (focused: boolean) => (focused ? c.primaryText : c.muted);
  const tab = (title: string, Icon: LucideIcon) => ({
    title,
    tabBarAccessibilityLabel: title,
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <Icon size={ICON.size} color={tint(focused)} strokeWidth={ICON.stroke} />
    ),
    tabBarLabel: ({ focused }: { focused: boolean }) => (
      <Text style={[focused ? t.type.tabActive : t.type.tab, { color: tint(focused) }]}>{title}</Text>
    ),
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border, borderTopWidth: 1, elevation: 0 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Inicio', House)} />
      <Tabs.Screen name="destacados" options={tab('Destacados', Award)} />
      <Tabs.Screen name="guardados" options={tab('Guardados', Bookmark)} />
      <Tabs.Screen name="perfil" options={tab('Mis datos', User)} />
    </Tabs>
  );
}
