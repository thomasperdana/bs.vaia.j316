
export enum Speaker {
  USER = 'user',
  FACILITATOR = 'facilitator',
}

export interface TranscriptEntry {
  speaker: Speaker;
  text: string;
}

export enum SessionStatus {
  IDLE = 'idle',
  LISTENING = 'listening',
  THINKING = 'thinking',
  SPEAKING = 'speaking',
  ERROR = 'error',
}
