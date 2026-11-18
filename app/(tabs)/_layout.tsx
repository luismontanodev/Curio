// Pestañas al estilo Instagram: Destacados (inicio), Explorar (recomendaciones y búsqueda),
// Momentos (reels infinitos) y Mis datos. Los temas (Naturaleza, Arte…) son chips en Explorar.
// Guardados y Filtros se abren desde Mis datos.

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router/js-tabs';
import { Award, Compass, GalleryVerticalEnd, User, type LucideIcon } from 'lucide-react-native';

import { ICON } from '../../src/components/primitives.tsx';
import { useTheme } from '../../src/platform/app-state.tsx';

export default function TabsLayout() {
  const t = useTheme();
  const c = t.colors;
  const insets = useSafeAreaInsets();

  // El activo va en `primaryText` (600); el resto en `muted`.
  const tint = (focused: boolean) => (focused ? c.primaryText : c.muted);
  const tab = (title: string, Icon: LucideIcon) => ({
    title,
    tabBarAccessibilityLabel: title,
    // La pestaña activa lleva una píldora de color detrás del ícono: se nota dónde estás.
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <View style={[styles.pill, focused && { backgroundColor: c.soft }]}>
        <Icon size={ICON.size} color={tint(focused)} strokeWidth={focused ? 2.2 : ICON.stroke} />
      </View>
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
        // Altura explícita con el área segura: así la barra queda por encima de los botones de
        // Android (navegación por gestos o de 3 botones) y no detrás.
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          borderTopWidth: 1,
          elevation: 0,
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarItemStyle: { height: 52 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Destacados', Award)} />
      <Tabs.Screen name="explorar" options={tab('Explorar', Compass)} />
      <Tabs.Screen name="momentos" options={tab('Momentos', GalleryVerticalEnd)} />
      <Tabs.Screen name="perfil" options={tab('Mis datos', User)} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
