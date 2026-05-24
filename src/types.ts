export interface Participant {
  id: string;
  name: string;
  role: 'favour' | 'against' | 'moderator';
  avatar: string;
  isMuted: boolean;
  isVideoOff: boolean;
  avatarSeed: string; // for UI representation
  bio: string;
  speakingTimer?: number; // visual timer
}

export interface ScoreBreakdown {
  rhetoricalImpact: number; // 0-10
  clarity: number;          // 0-10
  logicalConsistency: number; // 0-10
}

export interface SpeechSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  team: 'favour' | 'against' | 'moderator';
  text: string;
  scores: ScoreBreakdown;
  aiCommentary: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderType: 'audience' | 'participant' | 'moderator' | 'ai';
  text: string;
  timestamp: string;
}

export interface DebateRoom {
  id: string;
  topic: string;
  status: 'live' | 'starting' | 'scheduled';
  scheduledAt: string; // For human read & sort
  description: string;
  favourTeam: string; // e.g., "The Modernist Guild"
  againstTeam: string; // e.g., "The Preservationist League"
  participants: Participant[];
  chat: ChatMessage[];
  speeches: SpeechSegment[];
  audienceReactions: {
    applause: number;
    hearHear: number;
    rubbish: number;
    question: number;
  };
  speakerPolls: {
    [speakerId: string]: {
      agree: number;
      disagree: number;
    };
  };
}

export interface DebateSummaryReport {
  overallTopic: string;
  conclusion: string;
  bestSpeaker: string;
  favourAverageScore: number;
  againstAverageScore: number;
  rhetoricalNotes: string;
  clashPoints: string[];
}
