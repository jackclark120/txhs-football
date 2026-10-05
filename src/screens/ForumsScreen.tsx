import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { listThreads } from '../data/api';
import { useSchools } from '../data/useSchools';
import type { RootStackParamList } from '../navigation';
import { colors, space } from '../theme';
import type { ForumThread } from '../types';

export function ForumsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const schools = useSchools();
  const [threads, setThreads] = useState<ForumThread[]>([]);

  useFocusEffect(useCallback(() => { listThreads().then(setThreads); }, []));

  return (
    <View style={styles.screen}>
      <Pressable style={styles.button} onPress={() => nav.navigate('NewThread', {})}>
        <Text style={styles.buttonText}>Start a conversation</Text>
      </Pressable>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <Pressable style={styles.thread} onPress={() => nav.navigate('Thread', { threadId: item.id, title: item.title })}>
            <Text style={styles.tag}>
              {item.scope.kind === 'school' ? schools.get(item.scope.schoolId)?.name ?? 'School' : item.scope.kind === 'game' ? 'Game chat' : 'General'}
            </Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.muted}>{item.authorName} · {item.replyCount} posts</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space(4) },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: space(3), alignItems: 'center', marginBottom: space(4) },
  buttonText: { color: '#1B1300', fontWeight: '800' },
  thread: { backgroundColor: colors.card, borderRadius: 10, padding: space(3), marginBottom: space(2), gap: space(1) },
  tag: { color: colors.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: colors.text, fontWeight: '700', fontSize: 16 },
  muted: { color: colors.muted, fontSize: 12 },
});
