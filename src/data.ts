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
      applause: 42,
      hearHear: 67,
      rubbish: 12,
      question: 8,
    },
    speakerPolls: {
      'p-f-1': { agree: 15, disagree: 4 },
      'p-f-2': { agree: 11, disagree: 8 },
      'p-a-1': { agree: 8, disagree: 11 },
    },
    chat: [
      { id: 'c1', sender: 'Lord Harrington', senderType: 'audience', text: 'An absolute masterpiece of an opening statement!', timestamp: '2 mins ago' },
      { id: 'c2', sender: 'Clara Oswald', senderType: 'audience', text: 'But can a paper book search keywords instantaneously?', timestamp: '1 min ago' },
      { id: 'c3', sender: 'AI Toastmaster', senderType: 'ai', text: 'Members of the gallery, maintain decorum as Team Against presents their rebuttal.', timestamp: 'Just now' }
    ],
    speeches: [
      {
        id: 's1',
        speakerId: 'p-f-1',
        speakerName: 'Dr. Thaddeus Vance',
        team: 'favour',
        text: 'The physical book is a cathedral of human contemplation. It does not glare; it does not ping with digital distractions. It requires no electricity save for a warm candle. When you purchase a book, it is yours until it turns to dust; a digital file is merely rented from a server beyond your control!',
        scores: {
          rhetoricalImpact: 9,
          clarity: 8,
          logicalConsistency: 8
        },
        aiCommentary: 'Superb classical rhetoric. Strong appeal to property rights and cognitive depth, though slightly romanticised regarding modern technology.',
        timestamp: '5 mins ago'
      },
      {
        id: 's2',
        speakerId: 'p-a-1',
        speakerName: 'Evelyn Sterling',
        team: 'against',
        text: 'With all due respect to the learned Doctor, his wax candle would consume the very parchment he holds dear! A single digital apparatus carries the entire Alexandrian Library. It brings enlightenment to the child in rural waste plains who has no heavy bookshelf. Digital access is the ultimate democratic leveller.',
        scores: {
          rhetoricalImpact: 8,
          clarity: 9,
          logicalConsistency: 8
        },
        aiCommentary: 'Evelyn scores highly on democratic utilitarianism. A compelling cost-saving and transport rebuttal that counters Thaddeus’ architectural imagery.',
        timestamp: '3 mins ago'
      }
    ],
    participants: [
      {
        id: 'p-f-1',
        name: 'Dr. Thaddeus Vance',
        role: 'favour',
        avatar: '🎓',
        avatarSeed: 'vance',
        isMuted: false,
        isVideoOff: false,
        bio: 'Dean Emeritus of Scholastic Literature. Believer in leather-bound volumes and inkwells.'
      },
      {
        id: 'p-f-2',
        name: 'Marianne Sterling',
        role: 'favour',
        avatar: '✍️',
        avatarSeed: 'marianne',
        isMuted: true,
        isVideoOff: false,
        bio: 'Restorer of medieval manuscripts and physical archivist at the London Library.'
      },
      {
        id: 'p-f-3',
        name: 'Professor Arthur Pendelton',
        role: 'favour',
        avatar: '🕵️‍♂️',
        avatarSeed: 'arthur',
        isMuted: true,
        isVideoOff: true,
        bio: 'Philosopher of aesthetic experience. Claims digital screens degrade eye humors.'
      },
      {
        id: 'p-f-4',
        name: 'Beatrix Thorne',
        role: 'favour',
        avatar: '🖋️',
        avatarSeed: 'beatrix',
        isMuted: true,
        isVideoOff: false,
        bio: 'Poet and publisher of hand-pressed chapbooks.'
      },
      {
        id: 'p-f-5',
        name: 'Archibald Cole',
        role: 'favour',
        avatar: '🎩',
        avatarSeed: 'archibald',
        isMuted: true,
        isVideoOff: false,
        bio: 'Bibliophile with an collection of 15th-century first editions.'
      },
      // Team Against
      {
        id: 'p-a-1',
        name: 'Evelyn Sterling',
        role: 'against',
        avatar: '⚡',
        avatarSeed: 'evelyn',
        isMuted: false,
        isVideoOff: false,
        bio: 'Technologist & editor of the Chronograph Daily. Champion of the electric medium.'
      },
      {
        id: 'p-a-2',
        name: 'Julian Vance',
        role: 'against',
        avatar: '⚙️',
        avatarSeed: 'julian',
        isMuted: true,
        isVideoOff: false,
        bio: 'Mechanical engineer specialized in high-efficiency linotype engines.'
      },
      {
        id: 'p-a-3',
        name: 'Flora Nightingale',
        role: 'against',
        avatar: '🩺',
        avatarSeed: 'flora',
        isMuted: true,
        isVideoOff: true,
        bio: 'Public medical officer. Argues digital logs speed up life-saving healthcare access.'
      },
      {
        id: 'p-a-4',
        name: 'Vincent Lovelace',
        role: 'against',
        avatar: '📟',
        avatarSeed: 'vincent',
        isMuted: true,
        isVideoOff: false,
        bio: 'Telegraphic automation logic designer. Believes code is modern poetry.'
      },
      {
        id: 'p-a-5',
        name: 'Cassandra Gray',
        role: 'against',
        avatar: '💡',
        avatarSeed: 'cassandra',
        isMuted: true,
        isVideoOff: false,
        bio: 'Director of the Cyberspace Library Federation. Reconfigurer of digital archives.'
      }
    ]
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
    participants: [
      { id: 'p-f-11', name: 'Amos Clay', role: 'favour', avatar: '🌾', avatarSeed: 'amos', isMuted: true, isVideoOff: false, bio: 'Organic yeoman and editor of the Ruralist Quarterly.' },
      { id: 'p-f-12', name: 'Dr. Jane Ruskin', role: 'favour', avatar: '🏡', avatarSeed: 'jane', isMuted: true, isVideoOff: false, bio: 'Aesthetician and social reformer.' },
      { id: 'p-f-13', name: 'Silas Ward', role: 'favour', avatar: '🪵', avatarSeed: 'silas', isMuted: true, isVideoOff: false, bio: 'Master joiner protesting modern glue factories.' },
      { id: 'p-f-14', name: 'Esther Green', role: 'favour', avatar: '🍇', avatarSeed: 'esther', isMuted: true, isVideoOff: true, bio: 'Horticulturist working to safeguard traditional orchards.' },
      { id: 'p-f-15', name: 'Henry David', role: 'favour', avatar: '🛶', avatarSeed: 'henry', isMuted: true, isVideoOff: false, bio: 'Naturalist living on the edges of the local pond.' },
      
      { id: 'p-a-11', name: 'Sir Roger Sterling', role: 'against', avatar: '🏭', avatarSeed: 'roger', isMuted: true, isVideoOff: false, bio: 'Owner of the Ironbridge Foundry and locomotives.' },
      { id: 'p-a-12', name: 'Dr. Alva Edison', role: 'against', avatar: '🔋', avatarSeed: 'alva', isMuted: true, isVideoOff: false, bio: 'Electrical circuit innovator.' },
      { id: 'p-a-13', name: 'Charlotte Babbage', role: 'against', avatar: '🧮', avatarSeed: 'charlotte', isMuted: true, isVideoOff: false, bio: 'Pioneer of computational mechanical engines.' },
      { id: 'p-a-14', name: 'George Stephenson', role: 'against', avatar: '🚂', avatarSeed: 'george', isMuted: true, isVideoOff: true, bio: 'Locomotive tractive developer.' },
      { id: 'p-a-15', name: 'Ada Byron', role: 'against', avatar: '🧬', avatarSeed: 'ada', isMuted: true, isVideoOff: false, bio: 'Mathematician specializing in algorithmic brass punch cards.' }
    ]
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
    participants: [
      { id: 'p-f-31', name: 'Ned Ludd', role: 'favour', avatar: '🔨', avatarSeed: 'ned', isMuted: true, isVideoOff: false, bio: 'Artisanal weaver and defender of handmade textiles.' },
      { id: 'p-f-32', name: 'William Morris', role: 'favour', avatar: '🌺', avatarSeed: 'william', isMuted: true, isVideoOff: false, bio: 'Designer, poet, and champion of rustic ornamentation.' },
      { id: 'p-f-33', name: 'Hannah Wright', role: 'favour', avatar: '🧶', avatarSeed: 'hannah', isMuted: true, isVideoOff: false, bio: 'Handloom weaver and spinner.' },
      { id: 'p-f-34', name: 'Giles Fletcher', role: 'favour', avatar: '🪓', avatarSeed: 'giles', isMuted: true, isVideoOff: true, bio: 'Traditional cooper and carver.' },
      { id: 'p-f-35', name: 'Theodora Cox', role: 'favour', avatar: '🧼', avatarSeed: 'theodora', isMuted: true, isVideoOff: false, bio: 'Soap Boiler guild trustee.' },
      
      { id: 'p-a-31', name: 'Charles Babbage', role: 'against', avatar: '⚙️', avatarSeed: 'charles', isMuted: true, isVideoOff: false, bio: 'Architect of calculating difference engines.' },
      { id: 'p-a-32', name: 'Elizabeth Fry', role: 'against', avatar: '📜', avatarSeed: 'elizabeth', isMuted: true, isVideoOff: false, bio: 'Phrenologist and efficiency educator.' },
      { id: 'p-a-33', name: 'Eli Whitney', role: 'against', avatar: '🌾', avatarSeed: 'eli', isMuted: true, isVideoOff: false, bio: 'Inventor of mechanised fiber engines.' },
      { id: 'p-a-34', name: 'Richard Arkwright', role: 'against', avatar: '🧬', avatarSeed: 'richard', isMuted: true, isVideoOff: true, bio: 'Superintendent of power spinning mills.' },
      { id: 'p-a-35', name: 'Grace Hopper', role: 'against', avatar: '⚓', avatarSeed: 'grace', isMuted: true, isVideoOff: false, bio: 'Admiral of programmatic electrical relays.' }
    ]
  }
];
