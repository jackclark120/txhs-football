import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, space } from '../theme';

// Email one-time code sign-in: no passwords and no deep-link setup needed.
export function AccountScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUserEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Demo mode: you can report scores and post as “You”. Nothing is saved.</Text>
      </View>
    );
  }
  const client = supabase;

  if (userEmail) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Signed in as {userEmail}</Text>
        <Pressable style={styles.button} onPress={() => client.auth.signOut()}><Text style={styles.buttonText}>Sign out</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Sign in to report scores and post on fan boards.</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      {sent && <TextInput style={styles.input} placeholder="6-digit code" placeholderTextColor={colors.muted} keyboardType="number-pad" value={code} onChangeText={setCode} />}
      <Pressable
        style={styles.button}
        onPress={async () => {
          const { error } = sent
            ? await client.auth.verifyOtp({ email, token: code, type: 'email' })
            : await client.auth.signInWithOtp({ email });
          if (error) Alert.alert('Sign in failed', error.message);
          else setSent(true);
        }}
      >
        <Text style={styles.buttonText}>{sent ? 'Verify code' : 'Email me a code'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space(4), gap: space(3) },
  text: { color: colors.text, fontSize: 15 },
  input: { color: colors.text, backgroundColor: colors.card, borderRadius: 10, padding: space(3) },
  button: { backgroundColor: colors.accent, borderRadius: 12, padding: space(4), alignItems: 'center' },
  buttonText: { color: '#1B1300', fontWeight: '800' },
});
