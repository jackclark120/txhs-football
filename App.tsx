import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './src/navigation';
import { AccountScreen } from './src/screens/AccountScreen';
import { ForumsScreen } from './src/screens/ForumsScreen';
import { GameScreen } from './src/screens/GameScreen';
import { NewThreadScreen } from './src/screens/NewThreadScreen';
import { ReportScoreScreen } from './src/screens/ReportScoreScreen';
import { SchoolScreen } from './src/screens/SchoolScreen';
import { ScoresScreen } from './src/screens/ScoresScreen';
import { StandingsScreen } from './src/screens/StandingsScreen';
import { ThreadScreen } from './src/screens/ThreadScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, primary: colors.accent, text: colors.text, border: colors.border } };
const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted }}>
      <Tab.Screen name="Scores" component={ScoresScreen} options={{ title: 'Friday Night Scores', tabBarLabel: 'Scores', tabBarIcon: icon('🏈') }} />
      <Tab.Screen name="Standings" component={StandingsScreen} options={{ tabBarIcon: icon('📊') }} />
      <Tab.Screen name="Forums" component={ForumsScreen} options={{ title: 'Fan Boards', tabBarLabel: 'Boards', tabBarIcon: icon('💬') }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarIcon: icon('👤') }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={theme}>
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Game" component={GameScreen} options={{ title: '' }} />
          <Stack.Screen name="ReportScore" component={ReportScoreScreen} options={{ title: 'Report score', presentation: 'modal' }} />
          <Stack.Screen name="School" component={SchoolScreen} options={{ title: '' }} />
          <Stack.Screen name="Thread" component={ThreadScreen} />
          <Stack.Screen name="NewThread" component={NewThreadScreen} options={{ title: 'New post', presentation: 'modal' }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
