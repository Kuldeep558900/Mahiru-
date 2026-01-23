
export interface Message {
  id: string;
  sender: 'user' | 'mahiru';
  primaryText: string;
  secondaryText?: string;
  emotion?: string;
  timestamp: number;
}

export type Persona = 'Friend' | 'Girlfriend' | 'Parent' | 'Sensei';

export interface UserProfile {
  name: string;
  age?: number;
  language: 'hindi' | 'english';
  voice: string;
  persona: Persona;
  isAdmin?: boolean;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
