export interface ChatMode {
  id: string;
  name: string;
  systemPrompt: string;
  description: string;
}

export interface Thread {
  id: number;
  title: string;
  created_at: string;
  system_prompt?: string;
  is_archived: boolean;
}

export interface Message {
  id: number;
  thread_id: number;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  created_at: string;
  reply_to_id?: number;
  model?: string;
}

export type MessageNode = Message & { children: MessageNode[] };

export type Theme = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  hover: string;
  accent: string;
  accentHover: string;
  messageUser: string;
  messageUserText: string;
  messageAi: string;
  messageAiText: string;
  inputBg: string;
}
