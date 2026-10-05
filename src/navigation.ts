import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Tabs: undefined;
  Game: { gameId: string };
  ReportScore: { gameId: string };
  School: { schoolId: string };
  Thread: { threadId: string; title: string };
  NewThread: { schoolId?: string };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
