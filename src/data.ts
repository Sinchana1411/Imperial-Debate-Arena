import { DebateRoom } from './types';

export const INITIAL_DEBATE_ROOMS: DebateRoom[] = [
  {
    id: 'room-1',
    topic: 'RESOLVED: That the printed book is far superior to any futuristic digital apparatus.',
    status: 'live',
    scheduledAt: '2026-05-23T16:00:00Z',
    description: 'A classic intellectual battleground weighing the tactile, sensory, and cognitive heritage of physical literature against electronic readouts.',
    favourTeam: 'The Gutenberg Fellowship',
    againstTeam: 'The Silicon Vanguard',
    audienceReactions: {
      applause: 0,
      hearHear: 0,
      rubbish: 0,
      question: 0,
    },
    speakerPolls: {},
    chat: [
      { id: 'c1', sender: 'AI Toastmaster', senderType: 'ai', text: 'Welcome to this hollowed court of active letters. Decorum is requested as this chamber opens to the floor.', timestamp: 'Just now' }
    ],
    speeches: [],
    participants: []
  },
  {
    id: 'room-2',
    topic: 'RESOLVED: That industrial expansion produces greater moral and physical decay than intellectual enlightenment.',
    status: 'starting',
    scheduledAt: 'Starting in 10 minutes',
    description: 'Weighing the physical toll of industrial coal and smog against the rapid progress of telegraphy, mechanics, and public scholarship.',
    favourTeam: 'The Agrarian League',
    againstTeam: 'The Industrial Synod',
    audienceReactions: { applause: 0, hearHear: 0, rubbish: 0, question: 0 },
    speakerPolls: {},
    chat: [],
    speeches: [],
    participants: []
  },
  {
    id: 'room-3',
    topic: 'RESOLVED: That the introduction of automated clockwork machinery is detrimental to human craftsmanship.',
    status: 'scheduled',
    scheduledAt: 'Scheduled: Tomorrow, 2:00 PM',
    description: 'An exchange regarding the substitution of skilled artisanal guild-work with mechanical clockwork automation gears.',
    favourTeam: 'The Guild of Master Artisans',
    againstTeam: 'The Clockwork Alliance',
    audienceReactions: { applause: 0, hearHear: 0, rubbish: 0, question: 0 },
    speakerPolls: {},
    chat: [],
    speeches: [],
    participants: []
  }
];
