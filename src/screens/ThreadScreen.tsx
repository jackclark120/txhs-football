import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createPost, listPosts } from '../data/api';
import type { ScreenProps } from '../navigation';
import { colors, space } from '../theme';
import type { ForumPost } from '../types';

export function ThreadScreen({ route, navigation }: ScreenProps<'Thread'>) {
  const { threadId, title } = route.params;
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [draft, setDraft] = useState('');

  const load = useCallback(() => listPosts(threadId).then(setPosts), [threadId]);
  useEffect(() => {
    navigation.setOptions({ title });
    load();
  }, [load, navigation, title]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    try {
      await createPost(threadId, body);
      setDraft('');
      load();
    } catch (e: any) {
      Alert.alert('Not posted', e.message ?? 'Try again.');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space(4) }}
        renderItem={({ item }) => (
          <View style={styles.post}>
            <Text style={styles.author}>{item.authorName} <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text></Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder="Add to the conversation" placeholderTextColor={colors.muted} multiline maxLength={4000} />
        <Pressable onPress={send} style={styles.send}><Text style={styles.sendText}>Post</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  post: { backgroundColor: colors.card, borderRadius: 10, padding: space(3), marginBottom: space(2), gap: space(1) },
  author: { color: colors.accent, fontWeight: '700' },
  time: { color: colors.muted, fontWeight: '400', fontSize: 11 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  composer: { flexDirection: 'row', padding: space(3), gap: space(2), borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  input: { flex: 1, color: colors.text, backgroundColor: colors.card, borderRadius: 10, padding: space(3), maxHeight: 120 },
  send: { justifyContent: 'center', paddingHorizontal: space(3) },
  sendText: { color: colors.accent, fontWeight: '800' },
});
