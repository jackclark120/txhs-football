import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createThread } from '../data/api';
import { useSchools } from '../data/useSchools';
import type { ScreenProps } from '../navigation';
import { colors, space } from '../theme';

export function NewThreadScreen({ route, navigation }: ScreenProps<'NewThread'>) {
  const { schoolId } = route.params;
  const school = useSchools().get(schoolId ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  async function submit() {
    if (title.trim().length < 3 || !body.trim()) return Alert.alert('Add a title and a message.');
    try {
      const id = await createThread(title.trim(), body.trim(), schoolId);
      navigation.replace('Thread', { threadId: id, title: title.trim() });
    } catch (e: any) {
      Alert.alert('Not posted', e.message ?? 'Try again.');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.where}>{school ? `Posting on the ${school.name} board` : 'Posting on the general board'}</Text>
      <TextInput style={styles.input} placeholder="Title" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} maxLength={120} />
      <TextInput style={[styles.input, { minHeight: 140 }]} placeholder="What’s on your mind?" placeholderTextColor={colors.muted} value={body} onChangeText={setBody} multiline maxLength={4000} />
      <Pressable style={styles.button} onPress={submit}><Text style={styles.buttonText}>Post</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space(4), gap: space(3) },
  where: { color: colors.muted },
  input: { color: colors.text, backgroundColor: colors.card, borderRadius: 10, padding: space(3), textAlignVertical: 'top' },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: space(4), alignItems: 'center' },
  buttonText: { color: '#1B1300', fontWeight: '800' },
});
