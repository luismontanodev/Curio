// Filtros: temas, nivel, interruptores y palabras bloqueadas. Se aplican al tocar "Aplicar filtros".

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';

import { FILTER_LEVELS, LANGS, TOPICS, type AppPrefs, type Lang, type Topic } from '../src/core/types.ts';
import { DEFAULT_PAUSE_EVERY, MAX_BLOCKED_WORD_LENGTH, dedupeWords } from '../src/db/prefs.ts';
import { Button, Chip, ICON, IconButton, Segmented, SectionLabel, SwitchRow } from '../src/components/primitives.tsx';
import { useAppState, useTheme } from '../src/platform/app-state.tsx';
import { LANG_LABELS, LEVEL_LABELS, TOPIC_LABELS } from '../src/ui/format.ts';

const LEVEL_OPTIONS = FILTER_LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }));

export default function FiltersScreen() {
  const t = useTheme();
  const c = t.colors;
  const { prefs, updatePrefs } = useAppState();
  const [draft, setDraft] = useState<AppPrefs>(prefs);
  const [word, setWord] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<AppPrefs>) => setDraft((d) => ({ ...d, ...patch }));

  const toggleTopic = (tp: Topic) => {
    const has = draft.topics.includes(tp);
    if (has && draft.topics.length === 1) return; // al menos un tema siempre activo
    set({ topics: has ? draft.topics.filter((x) => x !== tp) : TOPICS.filter((x) => x === tp || draft.topics.includes(x)) });
  };

  const toggleLang = (l: Lang) => {
    const has = draft.languages.includes(l);
    if (has && draft.languages.length === 1) return; // al menos un idioma siempre activo
    set({ languages: has ? draft.languages.filter((x) => x !== l) : LANGS.filter((x) => x === l || draft.languages.includes(x)) });
  };

  const addWord = () => {
    if (!word.trim()) return;
    set({ blockedWords: dedupeWords([...draft.blockedWords, word]) });
    setWord('');
  };

  const apply = async () => {
    setSaving(true);
    try {
      // Una palabra escrita sin confirmar también cuenta.
      const blockedWords = word.trim() ? dedupeWords([...draft.blockedWords, word]) : draft.blockedWords;
      await updatePrefs({ ...draft, blockedWords });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <IconButton label="Volver" onPress={() => router.back()}>
          <ChevronLeft size={26} color={c.text} strokeWidth={ICON.stroke} />
        </IconButton>
        <Text accessibilityRole="header" style={[t.type.screenTitle, { color: c.text, marginLeft: 4 }]}>
          Filtros
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionLabel>Temas</SectionLabel>
        <View style={styles.wrap}>
          {TOPICS.map((tp) => (
            <Chip key={tp} label={TOPIC_LABELS[tp]} active={draft.topics.includes(tp)} onPress={() => toggleTopic(tp)} />
          ))}
        </View>

        <SectionLabel style={styles.section}>Idiomas del contenido</SectionLabel>
        <View style={styles.wrap}>
          {LANGS.map((l) => (
            <Chip key={l} label={LANG_LABELS[l]} active={draft.languages.includes(l)} onPress={() => toggleLang(l)} />
          ))}
        </View>
        <Text style={[t.type.body, { fontSize: 13, color: c.muted, marginTop: 10 }]}>
          Solo verás tarjetas en estos idiomas. Las obras del Met y las imágenes de la NASA solo existen en inglés.
        </Text>

        <SectionLabel style={styles.section}>Nivel de filtro</SectionLabel>
        <View style={{ marginTop: 12 }}>
          <Segmented options={LEVEL_OPTIONS} value={draft.level} onChange={(level) => set({ level })} />
        </View>
        <Text style={[t.type.body, { fontSize: 13, color: c.muted, marginTop: 10 }]}>
          Oculta títulos con mayúsculas excesivas, signos de exclamación, preguntas gancho y listas tipo «10 cosas
          que…».
        </Text>

        <View style={[styles.group, { borderColor: c.border, borderRadius: t.radius.group, marginTop: t.space.sectionGap }]}>
          <SwitchRow
            first
            title="Ocultar títulos sensacionalistas"
            hint="Análisis del tono del título"
            value={draft.hideSensational}
            onChange={(hideSensational) => set({ hideSensational })}
          />
          <SwitchRow
            title="Ocultar clickbait"
            hint="Preguntas gancho, «no creerás…»"
            value={draft.hideClickbait}
            onChange={(hideClickbait) => set({ hideClickbait })}
          />
          <SwitchRow
            title="Solo fuentes verificadas"
            hint="Museos, enciclopedias, revistas"
            value={draft.onlyVerified}
            onChange={(onlyVerified) => set({ onlyVerified })}
          />
          <SwitchRow
            title="Pausa sugerida"
            hint={`Aviso cada ${draft.pauseEvery ?? DEFAULT_PAUSE_EVERY} tarjetas`}
            value={draft.pauseEvery !== null}
            onChange={(on) => set({ pauseEvery: on ? DEFAULT_PAUSE_EVERY : null })}
          />
        </View>

        <SectionLabel style={styles.section}>Palabras bloqueadas</SectionLabel>
        {draft.blockedWords.length > 0 ? (
          <View style={styles.wrap}>
            {draft.blockedWords.map((w) => (
              <View
                key={w}
                style={[styles.wordChip, { backgroundColor: c.soft, height: t.size.wordChipHeight, borderRadius: t.size.wordChipHeight / 2 }]}
              >
                <Text style={[t.type.chip, { color: c.text }]}>{w}</Text>
                <Pressable
                  onPress={() => set({ blockedWords: draft.blockedWords.filter((x) => x !== w) })}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar palabra ${w}`}
                  hitSlop={8}
                  style={styles.wordRemove}
                >
                  <X size={16} color={c.muted} strokeWidth={ICON.stroke} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[t.type.meta, { color: c.muted, marginTop: 8 }]}>
            Las tarjetas que mencionen estas palabras no aparecerán.
          </Text>
        )}
        <TextInput
          value={word}
          onChangeText={setWord}
          onSubmitEditing={addWord}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder="Añadir palabra o frase…"
          placeholderTextColor={c.muted}
          maxLength={MAX_BLOCKED_WORD_LENGTH}
          autoCapitalize="none"
          accessibilityLabel="Añadir palabra o frase bloqueada"
          style={[
            styles.input,
            t.type.chip,
            { color: c.text, borderColor: c.border, borderRadius: t.radius.input, height: t.size.inputHeight },
          ]}
        />
      </ScrollView>

      <View style={[styles.bottom, { borderTopColor: c.border, backgroundColor: c.bg }]}>
        <Button label="Aplicar filtros" onPress={() => void apply()} disabled={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  section: { marginTop: 22 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  group: { borderWidth: 1, overflow: 'hidden' },
  wordChip: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 2 },
  wordRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, paddingHorizontal: 14, marginTop: 12 },
  bottom: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1 },
});
