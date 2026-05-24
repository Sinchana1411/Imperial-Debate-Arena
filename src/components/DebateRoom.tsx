import React, { useState, useEffect, useRef } from 'react';
import { DebateRoom, Participant, SpeechSegment, ChatMessage, ScoreBreakdown, DebateSummaryReport } from '../types';
import VintageCard from './VintageCard';
import { useLiveKit } from '../lib/useLiveKit';
import { joinOrUpdateSupabaseParticipant, leaveSupabaseRoom, addSupabaseChatMessage, addSupabaseSpeechSegment } from '../lib/supabaseSync';
import { 
  Mic, MicOff, Video, VideoOff, MessageSquare, Send, Award, Play, Pause, 
  RotateCcw, Sparkles, BookOpen, ThumbsUp, ThumbsDown, HelpCircle, ChevronLeft, Flag, FileText, ClipboardList,
  Eye, EyeOff, Radio, Headphones
} from 'lucide-react';

interface DebateRoomProps {
  room: DebateRoom;
  currentUser?: {
    id?: string;
    name: string;
    role: 'favour' | 'against' | 'moderator' | 'audience';
    avatar: string;
  } | null;
  onBack: () => void;
  onUpdateRoom: (updated: DebateRoom) => void;
}

export default function DebateRoomChamber({ room, currentUser, onBack, onUpdateRoom }: DebateRoomProps) {
  const uId = currentUser?.id || 'user-speaker-id';

  // Debate control states
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null);
  const [speakingRound, setSpeakingRound] = useState(0);
  const [chatInput, setChatInput] = useState('');
  
  // User seated details
  const [userRole, setUserRole] = useState<'audience' | 'favour' | 'against' | 'moderator'>('audience');
  const [userSpeakerName, setUserSpeakerName] = useState('Ebenezer Miller');
  const [userSpeakerAvatar, setUserSpeakerAvatar] = useState('🎩');

  // Auto-login active web user to the chamber's registry based on the first-10 cap rule
  useEffect(() => {
    if (!currentUser) return;
    
    const userExists = room.participants.some(p => p.id === uId);
    if (!userExists) {
      // Calculate current count of active speakers in this chamber (excluding user)
      const activeOratorsCount = room.participants.filter(p => p.role !== 'audience' && p.id !== uId).length;
      let assignedRole: 'favour' | 'against' | 'moderator' | 'audience';
      
      if (activeOratorsCount < 10) {
        // Under 10 participants, assign active debater seat
        if (currentUser.role !== 'audience') {
          assignedRole = currentUser.role;
        } else {
          // If they wanted audience, but we make first 10 participants, alternate team
          const favourCount = room.participants.filter(p => p.role === 'favour').length;
          const againstCount = room.participants.filter(p => p.role === 'against').length;
          assignedRole = favourCount <= againstCount ? 'favour' : 'against';
        }
      } else {
        // Capacity reached, enforce audience spectating seat
        assignedRole = 'audience';
      }

      const userParticipant: Participant = {
        id: uId,
        name: currentUser.name,
        role: assignedRole,
        avatar: currentUser.avatar,
        avatarSeed: 'user-avatar-seed',
        isMuted: false,
        isVideoOff: false,
        bio: assignedRole === 'audience' 
          ? 'Gallery Spectator. Seated on the registry due to chamber limits.' 
          : 'Active Legislative Gown. Deliberating on the benches.'
      };

      onUpdateRoom({
        ...room,
        participants: [...room.participants, userParticipant],
        chat: [
          ...room.chat,
          {
            id: `login-join-${Date.now()}`,
            sender: 'AI Toastmaster',
            senderType: 'ai',
            text: `🖋️ Registry Entry: ${currentUser.name} signed in. ${
              assignedRole === 'audience'
                ? 'Active benches are fully occupied (10/10). Seated in the Gallery Spectating Section.'
                : `Seated as active Orator with the ${assignedRole === 'favour' ? 'Affirmative Guild' : 'Negative Guild'}.`
            }`,
            timestamp: 'Just now'
          }
        ]
      });

      setUserRole(assignedRole);
      setUserSpeakerName(currentUser.name);
      setUserSpeakerAvatar(currentUser.avatar);
    } else {
      const registeredUser = room.participants.find(p => p.id === uId);
      if (registeredUser) {
        setUserRole(registeredUser.role);
        setUserSpeakerName(registeredUser.name);
        setUserSpeakerAvatar(registeredUser.avatar);
      }
    }
  }, [room.id, currentUser]);

  // Handler for manual checking-in of simulated guest entries to test limits easily
  const handleCheckInAttendee = (guestName: string, requestedRole: 'favour' | 'against' | 'moderator' | 'audience') => {
    if (!guestName.trim()) return;

    const activeOratorsCount = room.participants.filter(p => p.role !== 'audience').length;
    let assignedRole: 'favour' | 'against' | 'moderator' | 'audience';

    if (activeOratorsCount < 10) {
      if (requestedRole !== 'audience') {
        assignedRole = requestedRole;
      } else {
        const favourCount = room.participants.filter(p => p.role === 'favour').length;
        const againstCount = room.participants.filter(p => p.role === 'against').length;
        assignedRole = favourCount <= againstCount ? 'favour' : 'against';
      }
    } else {
      assignedRole = 'audience';
    }

    const avatars = ['🎩', '🎓', '🗣️', '🖋️', '🔍'];
    const chosenAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    const newGuest: Participant = {
      id: `p-guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: guestName,
      role: assignedRole,
      avatar: chosenAvatar,
      avatarSeed: `guest-${Date.now()}`,
      isMuted: false,
      isVideoOff: false,
      bio: assignedRole === 'audience' 
        ? 'Gallery Spectator. Signed into seat.' 
        : 'Active Legislative Gown. Checked into debating benches.'
    };

    onUpdateRoom({
      ...room,
      participants: [...room.participants, newGuest],
      chat: [
        ...room.chat,
        {
          id: `guest-join-${Date.now()}`,
          sender: 'AI Toastmaster',
          senderType: 'ai',
          text: `🖋️ Guest Registered: ${guestName} logged in. Assigned to ${
            assignedRole === 'audience' ? 'Gallery Audience Spectator' : `Active Debating Gown (${assignedRole.toUpperCase()})`
          }.`,
          timestamp: 'Just now'
        }
      ]
    });
  };

  // Updaters for changing active user affiliation
  const handleUpdateUserStatus = (roleChoice: 'favour' | 'against' | 'moderator' | 'audience') => {
    const existingRef = room.participants.find(p => p.id === uId);
    const wasAudience = existingRef ? existingRef.role === 'audience' : true;
    const isRequestingActive = roleChoice !== 'audience';

    let finalRole = roleChoice;

    if (wasAudience && isRequestingActive) {
      const activeOratorsCount = room.participants.filter(p => p.id !== uId && p.role !== 'audience').length;
      if (activeOratorsCount >= 10) {
        alert("Chamber Active capacity reached! There are already 10 active debating delegates seated. You can only join as a spectating Gallery Audience.");
        finalRole = 'audience';
      }
    }

    const updatedParticipants = room.participants.map(p => {
      if (p.id === uId) {
        return {
          ...p,
          role: finalRole,
          bio: finalRole === 'audience'
            ? 'Gallery Spectator. Seated on the registry due to chamber limits.'
            : 'Active Legislative Gown. Deliberating on the benches.'
        };
      }
      return p;
    });

    onUpdateRoom({
      ...room,
      participants: updatedParticipants
    });

    setUserRole(finalRole);
  };

  const handleUpdateUserNameAndAvatar = (newName: string, newAvatar: string) => {
    if (!newName.trim()) return;
    
    const updatedParticipants = room.participants.map(p => {
      if (p.id === uId) {
        return { ...p, name: newName, avatar: newAvatar };
      }
      return p;
    });

    onUpdateRoom({
      ...room,
      participants: updatedParticipants
    });

    setUserSpeakerName(newName);
    setUserSpeakerAvatar(newAvatar);
  };
  
  // Custom transcription draft board
  const [userDraftNotes, setUserDraftNotes] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [polishedUserSpeech, setPolishedUserSpeech] = useState('');
  
  // Scoring average registers
  const [favourScore, setFavourScore] = useState<ScoreBreakdown>({ rhetoricalImpact: 8.5, clarity: 8.2, logicalConsistency: 8.0 });
  const [againstScore, setAgainstScore] = useState<ScoreBreakdown>({ rhetoricalImpact: 8.3, clarity: 8.4, logicalConsistency: 8.1 });
  const [isJudging, setIsJudging] = useState(false);
  
  // Summary report modal state
  const [summaryReport, setSummaryReport] = useState<DebateSummaryReport | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Auto-talk simulations refs and timers
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const speechScrollRef = useRef<HTMLDivElement | null>(null);

  // Camera & Mic physical stream states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [voiceClarityEnabled, setVoiceClarityEnabled] = useState(true);
  const [hideNameplates, setHideNameplates] = useState(false);
  const [selfMonitor, setSelfMonitor] = useState(false);
  const [micVolume, setMicVolume] = useState(0); // Real amplitude level (0-100)

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceClarityFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const localLoopbackGainRef = useRef<GainNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Synchronize local video element ref with local stream
  useEffect(() => {
    if (localVideoRef.current && localStream && isCameraActive) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraActive]);

  // Dynamically update Web Audio DSP parameters when voiceClarity is toggled
  useEffect(() => {
    if (voiceClarityFilterRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      // Boost 2.5kHz voice frequency presence by +6dB when enabled, else 0dB (flat)
      voiceClarityFilterRef.current.gain.setValueAtTime(voiceClarityEnabled ? 6.0 : 0.0, now);
    }
    if (compressorRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      // Active voice compression when enabled, else flat bypass
      compressorRef.current.threshold.setValueAtTime(voiceClarityEnabled ? -24 : 0, now);
    }
  }, [voiceClarityEnabled]);

  // Dynamically update self monitoring loopback gain
  useEffect(() => {
    if (localLoopbackGainRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      localLoopbackGainRef.current.gain.setValueAtTime(selfMonitor ? 0.35 : 0.0, now);
    }
  }, [selfMonitor]);

  // 🎙️ LiveKit Multi-User Real-time audio stream connection hook
  const { 
    isConnected: isLkConnected, 
    isDemo: isLkDemo, 
    error: lkError, 
    activeSpeakers, 
    setMicMuted 
  } = useLiveKit(
    room.id, 
    uId, 
    userSpeakerName, 
    !isMicActive
  );

  // Synchronize microphone activation state with the remote LiveKit publishing tracks
  useEffect(() => {
    setMicMuted(!isMicActive);
  }, [isMicActive]);

  // Webcam helper
  const toggleCamera = async () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          track.stop();
          localStream.removeTrack(track);
        });
        if (localStream.getTracks().length === 0) {
          setLocalStream(null);
        }
      }
    } else {
      try {
        const constraints = {
          video: { width: 400, height: 400, aspectRatio: 1 },
          audio: isMicActive
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setIsCameraActive(true);
        if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
        }
        setLocalStream(stream);
      } catch (err) {
        console.error("Camera access failure:", err);
        alert("Unable to access camera. Please confirm device access/permissions.");
      }
    }
  };

  // Microphone helper
  const toggleMic = async () => {
    if (isMicActive) {
      setIsMicActive(false);
      cleanupVoiceClarityAudio();
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.stop();
          localStream.removeTrack(track);
        });
        if (localStream.getTracks().length === 0) {
          setLocalStream(null);
        }
      }
    } else {
      try {
        const constraints = {
          video: isCameraActive,
          audio: { echoCancellation: true, noiseSuppression: true }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setIsMicActive(true);
        if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
        }
        setLocalStream(stream);
        setupVoiceClarityAudio(stream);
      } catch (err) {
        console.error("Microphone access failure:", err);
        alert("Unable to access microphone. Please confirm device access/permissions.");
      }
    }
  };

  // Web Audio Clarity DSP Pipeline setup
  const setupVoiceClarityAudio = (stream: MediaStream) => {
    try {
      if (stream.getAudioTracks().length === 0) return;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn("AudioContext unsupported on this browser.");
        return;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtxClass();
      }
      const audioCtx = audioCtxRef.current;
      
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      if (audioSourceRef.current) {
        try { audioSourceRef.current.disconnect(); } catch(e){}
      }

      audioSourceRef.current = audioCtx.createMediaStreamSource(stream);

      // Low-frequency rumble filter (cutoff 120Hz) - blocks floor hums and ventilation noise
      const highPass = audioCtx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.setValueAtTime(120, audioCtx.currentTime);

      // Presence boost peaking filter (gain +6dB at 2.5kHz) - lifts core speech frequency for supreme voice clarity
      const peakFilter = audioCtx.createBiquadFilter();
      peakFilter.type = 'peaking';
      peakFilter.frequency.setValueAtTime(2500, audioCtx.currentTime);
      peakFilter.Q.setValueAtTime(1.0, audioCtx.currentTime);
      peakFilter.gain.setValueAtTime(voiceClarityEnabled ? 6.0 : 0.0, audioCtx.currentTime);

      // Dyn compressor for level normalization - keeps vocal volume crisp and perfectly clear
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(voiceClarityEnabled ? -24 : 0, audioCtx.currentTime);
      compressor.knee.setValueAtTime(30, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

      // Level monitoring analyzer
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;

      // Loopback gain for optional listening
      const loopbackGain = audioCtx.createGain();
      loopbackGain.gain.setValueAtTime(selfMonitor ? 0.35 : 0.0, audioCtx.currentTime);

      // Wire: src -> highpass -> presence peaking -> leveling compressor -> analyser -> loopback -> output
      audioSourceRef.current.connect(highPass);
      highPass.connect(peakFilter);
      peakFilter.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(loopbackGain);
      loopbackGain.connect(audioCtx.destination);

      voiceClarityFilterRef.current = peakFilter;
      compressorRef.current = compressor;
      analyserRef.current = analyser;
      localLoopbackGainRef.current = loopbackGain;

      // Realtime level analysis recursive animation loop
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolumeMetric = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const mappedVolume = Math.min(100, Math.round((average / 140) * 100));
        setMicVolume(mappedVolume);
        animationFrameIdRef.current = requestAnimationFrame(updateVolumeMetric);
      };
      
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      updateVolumeMetric();

    } catch (e) {
      console.error("Failed to build Web Audio DSP pipeline:", e);
    }
  };

  const cleanupVoiceClarityAudio = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    try {
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
    } catch(e){}
    voiceClarityFilterRef.current = null;
    compressorRef.current = null;
    analyserRef.current = null;
    localLoopbackGainRef.current = null;
    setMicVolume(0);
  };

  // Scroll chats and transcripts automatically
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [room.chat]);

  useEffect(() => {
    if (speechScrollRef.current) {
      speechScrollRef.current.scrollTop = speechScrollRef.current.scrollHeight;
    }
  }, [room.speeches]);

  // Handle cleanup of simulation loops and hardware media streams on unmount
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      cleanupVoiceClarityAudio();
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  // Standard dev track release when localStream transitions or exits
  useEffect(() => {
    const currentStream = localStream;
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {}
        });
      }
    };
  }, [localStream]);

  // Compute aggregate scores for both team guilds based on delivered speeches
  useEffect(() => {
    const favourSpeeches = room.speeches.filter(s => s.team === 'favour');
    const againstSpeeches = room.speeches.filter(s => s.team === 'against');

    const computeAverage = (speechesList: SpeechSegment[]) => {
      if (speechesList.length === 0) return { r: 8.0, c: 8.0, l: 8.0 };
      const sumR = speechesList.reduce((acc, s) => acc + s.scores.rhetoricalImpact, 0);
      const sumC = speechesList.reduce((acc, s) => acc + s.scores.clarity, 0);
      const sumL = speechesList.reduce((acc, s) => acc + s.scores.logicalConsistency, 0);
      return {
        r: Number((sumR / speechesList.length).toFixed(1)),
        c: Number((sumC / speechesList.length).toFixed(1)),
        l: Number((sumL / speechesList.length).toFixed(1))
      };
    };

    const favAvg = computeAverage(favourSpeeches);
    const agAvg = computeAverage(againstSpeeches);

    setFavourScore({ rhetoricalImpact: favAvg.r, clarity: favAvg.c, logicalConsistency: favAvg.l });
    setAgainstScore({ rhetoricalImpact: agAvg.r, clarity: agAvg.c, logicalConsistency: agAvg.l });
  }, [room.speeches]);

  // Mute / Unmute simulated participants
  const toggleParticipantMute = (participantId: string) => {
    const updatedParticipants = room.participants.map((p) => {
      if (p.id === participantId) {
        return { ...p, isMuted: !p.isMuted };
      }
      return p;
    });
    onUpdateRoom({ ...room, participants: updatedParticipants });
  };

  // Video feed on/off simulated participants
  const toggleParticipantVideo = (participantId: string) => {
    const updatedParticipants = room.participants.map((p) => {
      if (p.id === participantId) {
        return { ...p, isVideoOff: !p.isVideoOff };
      }
      return p;
    });
    onUpdateRoom({ ...room, participants: updatedParticipants });
  };

  // Submit Text Chat Messages
  const handleSendChat = (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    const newMessage: ChatMessage = {
      id: `chat-${Date.now()}`,
      sender: userRole === 'audience' ? 'Passerby Spectator' : userSpeakerName,
      senderType: userRole === 'audience' ? 'audience' : userRole === 'moderator' ? 'moderator' : 'participant',
      text: text,
      timestamp: 'Just now'
    };

    onUpdateRoom({
      ...room,
      chat: [...room.chat, newMessage]
    });
    if (!textToSend) setChatInput('');
  };

  // Audience reactions click tracking
  const handleAudienceReaction = (type: 'applause' | 'hearHear' | 'rubbish' | 'question') => {
    const updatedReactions = { ...room.audienceReactions };
    updatedReactions[type] = updatedReactions[type] + 1;

    // Push simulated message to chat sometimes for lively sensory impact
    const soundsMap = {
      applause: '👏 *Distant, thunderous applause cascades from the gallery!*',
      hearHear: '📜 *Orators and assembly members call out: "HEAR, HEAR!"*',
      rubbish: '🗑️ *Grumblings and whispers of "RUBBISH!" echo from the front row.*',
      question: '❓ *An intense murmuring of inquiry and wonder spreads.*'
    };

    const chatAddition: ChatMessage = {
      id: `reaction-chat-${Date.now()}`,
      sender: 'The Senate House Gallery',
      senderType: 'audience',
      text: soundsMap[type],
      timestamp: 'Just now'
    };

    onUpdateRoom({
      ...room,
      audienceReactions: updatedReactions,
      chat: [...room.chat, chatAddition]
    });
  };

  // Speaker polls voting
  const handleVoteSpeakerPoll = (speakerId: string, vote: 'agree' | 'disagree') => {
    const currentPolls = { ...room.speakerPolls };
    if (!currentPolls[speakerId]) {
      currentPolls[speakerId] = { agree: 0, disagree: 0 };
    }

    currentPolls[speakerId][vote] = currentPolls[speakerId][vote] + 1;

    onUpdateRoom({
      ...room,
      speakerPolls: currentPolls
    });
  };

  // Automated Simulation - runs speaking loops
  const toggleSimulation = () => {
    if (isSimulating) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      setIsSimulating(false);
      setCurrentSpeakerId(null);
    } else {
      setIsSimulating(true);
      triggerNextSpeechSimulation();
    }
  };

  // Triggers the next speech round on loop
  const triggerNextSpeechSimulation = () => {
    // Determine whose turn it is
    // Alternate Favour and Against
    // Let's grab all participants who are NOT muted and can speak
    const favourSpeakers = room.participants.filter(p => p.role === 'favour');
    const againstSpeakers = room.participants.filter(p => p.role === 'against');

    const speakCount = room.speeches.length;
    const isFavourTurn = speakCount % 2 === 0;

    const speakerPool = isFavourTurn ? favourSpeakers : againstSpeakers;
    // Choose a random speaker from that team
    const selectedSpeaker = speakerPool[Math.floor(Math.random() * speakerPool.length)];
    if (!selectedSpeaker) return;

    setCurrentSpeakerId(selectedSpeaker.id);

    // Dynamic random prompts
    const speechesPreset = [
      "Let it be recorded that our ancestors did not build beautiful libraries just to have them vaporized into invisible fields! Tactility preserves physical sanity. I protest this digital transformation!",
      "I urge my colleagues to remember that we do not preserve cognitive integrity by holding on to dead fiber wood! The digital library feeds the children across all horizons, with ultimate democratic availability.",
      "The smell of leather and dust is not romantic nostalgia, my friends; it is the physical architecture of human learning. It demands attention! It demands physical respect!",
      "We cannot simply restrict our educational limits to printing presses whose guilds restrict free speech. The electronic medium distributes enlightenment instantly like lightning over telegraph wires!"
    ];

    const phrase = speechesPreset[Math.floor(Math.random() * speechesPreset.length)];

    // Unmute speaker visually during speech
    const restoredMuteStatus = room.participants.map(p => {
      if (p.id === selectedSpeaker.id) {
        return { ...p, isMuted: false };
      }
      return p;
    });

    onUpdateRoom({
      ...room,
      participants: restoredMuteStatus
    });

    // Invoke AI Judge on this speech
    judgeSpeechAndAppend(selectedSpeaker.id, selectedSpeaker.name, selectedSpeaker.role, phrase);
  };

  // Helper: Request AI scoring and push onto transcript logs
  const judgeSpeechAndAppend = async (speakerId: string, speakerName: string, role: 'favour' | 'against' | 'moderator' | 'audience', text: string) => {
    setIsJudging(true);
    
    // Simulate speech buffer taking 2 seconds visually
    setTimeout(async () => {
      try {
        const res = await fetch('/api/debate/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: room.topic,
            speakerName: speakerName,
            team: role,
            speechText: text,
            previousSpeeches: room.speeches.slice(-3) // last 3 for contextual scoring
          })
        });

        const assessment = await res.json();

        const speechLog: SpeechSegment = {
          id: `speech-${Date.now()}`,
          speakerId: speakerId,
          speakerName: speakerName,
          team: role === 'audience' ? 'moderator' : role,
          text: text,
          scores: assessment.scores,
          aiCommentary: assessment.commentary,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Simulated chat spectator reactions based on scores
        const spectatorRemarks = [];
        if (assessment.scores.rhetoricalImpact >= 8) {
          spectatorRemarks.push("What a majestic turn of phrase! I am deeply moved by that rhetoric.");
        }
        if (assessment.scores.logicalConsistency < 7) {
          spectatorRemarks.push("A classic fallacy, surely! Where is the evidence?");
        } else {
          spectatorRemarks.push("An unassailable, logically constructed syllogism.");
        }

        const randomRemark = spectatorRemarks[Math.floor(Math.random() * spectatorRemarks.length)];
        const simSpectatorChat: ChatMessage = {
          id: `chat-react-${Date.now()}`,
          sender: ['Hon. Giles Cunningham', 'Miss Clarissa Thorne', 'Alderman Broadus', 'Dr. Barnaby'][Math.floor(Math.random() * 4)],
          senderType: 'audience',
          text: `"${randomRemark}"`,
          timestamp: 'Just now'
        };

        // AI Head Clerk announces the scores in chat
        const toastMessage: ChatMessage = {
          id: `ai-announcement-${Date.now()}`,
          sender: 'AI Clerk of the Court',
          senderType: 'ai',
          text: `⚖️ ${speakerName} scored | Rhetoric: ${assessment.scores.rhetoricalImpact} | Clarity: ${assessment.scores.clarity} | Logic: ${assessment.scores.logicalConsistency}`,
          timestamp: 'Just now'
        };

        onUpdateRoom({
          ...room,
          speeches: [...room.speeches, speechLog],
          chat: [...room.chat, simSpectatorChat, toastMessage]
        });

      } catch (err) {
        console.error("AI Judging failed:", err);
      } finally {
        setIsJudging(false);
        setCurrentSpeakerId(null);
      }
    }, 2000);
  };

  // Automated Transcription Draft using Gemini
  // Translates rough user notes into polished intellectual transcripts
  const handleTranscribeDraft = async () => {
    if (!userDraftNotes.trim()) return;
    setIsTranscribing(true);

    try {
      const res = await fetch('/api/debate/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: userDraftNotes,
          characterName: userSpeakerName,
          team: userRole
        })
      });

      const parsed = await res.json();
      setPolishedUserSpeech(parsed.polishedSpeech);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Submit polished user text as a formal delivered debate speech
  const handleDeliverUserSpeech = () => {
    const textToDeliver = polishedUserSpeech || userDraftNotes;
    if (!textToDeliver.trim() || userRole === 'audience' || userRole === 'moderator') return;

    setCurrentSpeakerId(uId);
    
    // Invoke Judge & add
    judgeSpeechAndAppend(uId, userSpeakerName, userRole, textToDeliver);

    // Clear draft values
    setUserDraftNotes('');
    setPolishedUserSpeech('');
  };

  // Generate formal summary certificate endpoint
  const handleConcludeAndGenerateSummary = async () => {
    if (room.speeches.length === 0) {
      alert("At least one speech must be recorded in the transcripts before drafting the final assembly decree!");
      return;
    }

    setGeneratingSummary(true);
    try {
      const res = await fetch('/api/debate/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: room.topic,
          speeches: room.speeches
        })
      });

      const parsed = await res.json();
      setSummaryReport(parsed);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Separate participants by sides
  const favourMembers = room.participants.filter(p => p.role === 'favour');
  const againstMembers = room.participants.filter(p => p.role === 'against');

  // Filter lists for Zoom Grid and Capacity calculations
  const otherActiveParticipants = room.participants.filter(p => p.id !== uId && p.role !== 'audience');
  const activeParticipantsCount = room.participants.filter(p => p.role !== 'audience').length;
  const audienceMembersCount = room.participants.filter(p => p.role === 'audience').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-amber-900/10">
        <button
          onClick={onBack}
          className="px-4 py-2 flex items-center gap-1 border border-vintage hover:bg-amber-900/10 text-amber-900 font-display text-xs uppercase tracking-wider font-semibold transition-all shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Exit Chamber
        </button>
        
        {/* Topic Title Board */}
        <div className="text-center md:max-w-2xl">
          <span className="font-display text-[10px] uppercase font-bold tracking-widest text-amber-900/60 block">Currently Convening</span>
          <h2 className="font-display text-xl md:text-2xl font-black text-amber-950 uppercase leading-none mt-1 tracking-tight">
            Chamber Council
          </h2>
        </div>

        <button
          onClick={handleConcludeAndGenerateSummary}
          className="px-4 py-2 bg-amber-950 text-amber-50 font-display text-xs uppercase tracking-wider hover:bg-amber-900 flex items-center gap-1.5 shadow-vintage"
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>Conclude & Generate Report</span>
        </button>
      </div>

      {/* Assembly Topic Plate */}
      <div className="parchment-dark border-vintage p-5 text-center shadow-inner relative max-w-4xl mx-auto rounded-sm">
        <p className="font-display font-medium text-amber-900/70 text-xs tracking-[0.2em] uppercase mb-2">❖ Motion Under Debate ❖</p>
        <h1 className="font-serif italic text-xl md:text-2xl font-bold text-amber-950 leading-relaxed text-center px-4">
          "{room.topic}"
        </h1>
        <p className="font-serif italic text-xs text-amber-900/60 mt-2 max-w-2xl mx-auto">
          Context: {room.description}
        </p>

        {/* Live Voice Status Indicator Gavel Track */}
        <div className="mt-4 pt-4 border-t border-amber-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-950 font-sans">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 text-rose-800 ${isLkConnected && !isMicActive ? 'animate-pulse text-emerald-800' : 'text-stone-500'}`} />
            <span className="font-bold uppercase tracking-wider text-[10px] font-display">
              Chamber Audio Bridge Status:
            </span>
            {isLkDemo ? (
              <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                🟢 Simulated Audio Bridge Mode
              </span>
            ) : isLkConnected ? (
              <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                🟢 LiveKit Voice Connected
              </span>
            ) : (
              <span className="text-[#c0392b] font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-300">
                🔴 Bridging Cloud Voice streams...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-[#ebdcb2] px-2.5 py-1 rounded border border-amber-950/20">
              {isMicActive ? (
                <div className="flex items-center gap-1 text-emerald-800 font-bold text-[10px] uppercase">
                  <Mic className="w-3.5 h-3.5" />
                  <span>Your Microphone Broadcasting</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-rose-800 font-bold text-[10px] uppercase">
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Your Microphone Muted</span>
                </div>
              )}
            </div>

            {/* Glowing active talker list */}
            {activeSpeakers.length > 0 && (
              <div className="flex items-center gap-1.5 animate-pulse bg-emerald-50 text-emerald-800 text-[10px] px-2.5 py-1 rounded border border-emerald-200">
                <Headphones className="w-3.5 h-3.5 animate-bounce" />
                <span className="font-bold font-mono">
                  Speaking: {activeSpeakers.map(sid => {
                    const found = room.participants.find(p => p.id === sid);
                    return found ? found.name : "Orator";
                  }).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Layout: 10-Seat Meeting Area, and Live Sidebar Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 8-Col Container: Grand 10-Orator Simulated Chamber Wood Room */}
        <div className="lg:col-span-8 space-y-6">
          <div className="p-4 bg-[#231a13] border-vintage shadow-vintage-lg rounded-sm relative text-amber-100">
            {/* Wooden Label Plaque */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#5a4533] text-[#f4edd8] px-4 py-0.5 border border-vintage border-amber-950 text-[10px] font-display uppercase tracking-[0.2em] font-semibold z-20">
              Chamber Broadcaster Desk
            </div>

            {/* Layout Header */}
            <div className="flex justify-between items-center px-2 pt-2 pb-4 text-xs font-semibold uppercase tracking-wider text-amber-200/60 border-b border-amber-900/45">
              <span className="text-amber-500 font-serif italic text-[11px]">Affirmative Guild: {room.favourTeam}</span>
              
              <div className="flex items-center gap-1.5 bg-amber-950/40 px-2 py-0.5 border border-amber-900/30 rounded-sm">
                <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span className="text-[10px] text-amber-400 font-mono tracking-wider uppercase">VINTAGE TELE-SESSION LIVE</span>
              </div>
              
              <span className="text-blue-400 font-serif italic text-[11px] text-right">Negative Guild: {room.againstTeam}</span>
            </div>

            {/* Broadcast Multi-Feed Video Grid (Perfect Squares just like Zoom Meet) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-4 pb-4">
              
              {/* FEED 1: THE USER PREVIEW CELL (Always Displayed in Prominence) */}
              <div 
                className={`aspect-square w-full bg-stone-900 border-2 rounded-sm relative overflow-hidden transition-all duration-300 flex flex-col justify-between ${
                  currentSpeakerId === uId 
                    ? 'border-amber-500 shadow-lg shadow-amber-500/20 scale-[1.02] z-10' 
                    : 'border-amber-950/60 hover:border-amber-900/40'
                }`}
              >
                {/* Vintage CRT Scanlines Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none z-10 opacity-70" />
                
                {/* Team orientation corner highlight */}
                <span className={`absolute top-2 left-2 z-20 px-1.5 py-0.5 text-[8px] font-mono uppercase font-bold tracking-wider rounded-xs border ${
                  userRole === 'favour' ? 'bg-amber-900/90 text-amber-100 border-amber-500/50' :
                  userRole === 'against' ? 'bg-blue-905/90 text-blue-100 border-blue-500/50' :
                  userRole === 'moderator' ? 'bg-purple-900/90 text-purple-100 border-purple-500/50' :
                  'bg-stone-850 text-stone-300 border-stone-600/50'
                }`}>
                  {userRole.toUpperCase()}
                </span>

                {/* Video Container Frame */}
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#15100c]">
                  {isCameraActive && localStream ? (
                    <video 
                      ref={localVideoRef}
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover scale-x-[-1]" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <span className="text-4xl filter sepia opacity-70 mb-2">{userSpeakerAvatar}</span>
                      <p className="text-[10px] font-mono text-amber-900/70 tracking-tight leading-none uppercase">YOU</p>
                      <p className="text-[8px] font-mono text-[#ebdcb2]/40 uppercase mt-1 tracking-widest bg-stone-950 px-1 rounded">Camera Locked</p>
                    </div>
                  )}
                </div>

                {/* Real-time Dynamic Overlay Indicators */}
                <div className="absolute inset-y-0 right-2 flex flex-col justify-center gap-1 z-20">
                  {/* Dynamic Mic Activity Wave segment */}
                  {isMicActive && micVolume > 0 && (
                    <div className="flex flex-col items-center gap-0.5 h-16 w-3 bg-stone-900/80 p-0.5 rounded border border-amber-950/40">
                      <div className="w-1 bg-[#27ae60] rounded-sm transition-all duration-75" style={{ height: `${micVolume}%` }} />
                    </div>
                  )}
                </div>

                {/* Mini audio on/off stamp */}
                <div className="absolute top-2 right-2 z-20 flex gap-1">
                  <div className={`p-1 rounded-full border text-white ${
                    isMicActive ? 'bg-green-900/95 border-green-500/50' : 'bg-red-950/90 border-red-500/50'
                  }`}>
                    {isMicActive ? <Mic className="w-3 h-3 text-emerald-400" /> : <MicOff className="w-3 h-3 text-rose-500" />}
                  </div>
                </div>

                {/* Bottom Nameplate card */}
                <div 
                  className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-black/30 p-2 z-20 transition-all duration-300 border-t border-stone-850 ${
                    hideNameplates ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'
                  }`}
                >
                  <div className="flex items-center gap-1 justify-between">
                    <span className="font-display font-bold text-[11px] text-[#f4edd8] truncate block w-4/5">{userSpeakerName}</span>
                    <span className="text-[8px] text-amber-500 font-bold bg-[#ebdcb2]/10 px-1 border border-amber-500/30 font-mono">YOU</span>
                  </div>
                  <div className="text-[9px] font-serif italic text-amber-200/80 truncate font-semibold leading-none mt-0.5">
                    {userRole === 'audience' ? 'Passerby Observer Desk' : `Active Debating Gown`}
                  </div>
                </div>

                {/* Interactive Orator Speach Status banner */}
                {currentSpeakerId === uId && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-900/90 border border-amber-500 text-amber-100 text-[10px] px-2 py-0.5 uppercase tracking-wider font-bold animate-pulse text-center z-20">
                    🎙️ TRANSMITTING SPEECH
                  </div>
                )}
              </div>

              {/* ZOOM FEEDS FOR REGISTERED DEBATING ORATORS */}
              {otherActiveParticipants.map((member) => {
                const isActiveSpeaker = currentSpeakerId === member.id || activeSpeakers.includes(member.id);
                const mPoll = room.speakerPolls[member.id] || { agree: 10, disagree: 6 };
                return (
                  <div 
                    key={member.id} 
                    className={`aspect-square w-full bg-stone-900 border-2 rounded-sm relative overflow-hidden transition-all duration-300 flex flex-col justify-between ${
                      isActiveSpeaker 
                        ? member.role === 'favour'
                          ? 'border-amber-500 shadow-md shadow-amber-500/30 scale-[1.02] z-10'
                          : 'border-blue-500 shadow-md shadow-blue-500/30 scale-[1.02] z-10'
                        : 'border-stone-850 hover:border-amber-900/40'
                    }`}
                  >
                    {/* Vintage CRT Scanlines Overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none z-10 opacity-75" />

                    {/* Team tag block */}
                    <span className={`absolute top-2 left-2 z-20 px-1.5 py-0.5 text-[8px] font-mono uppercase font-bold tracking-wider rounded-xs border ${
                      member.role === 'favour' 
                        ? 'bg-amber-950/90 text-amber-200 border-amber-800/60' 
                        : 'bg-blue-950/90 text-blue-200 border-blue-800/60'
                    }`}>
                      {member.role === 'favour' ? 'AFFIRMATIVE' : 'NEGATIVE'}
                    </span>

                    {/* Outer Camera Feed Simulation */}
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#15100c]">
                      {!member.isVideoOff ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-4">
                          
                          {/* Animated speaker visual waves back plate */}
                          <div className={`absolute inset-0 bg-[#ebdcb2] transition-opacity opacity-[0.03] ${isActiveSpeaker && 'animate-pulse opacity-[0.11]'}`} />
                          
                          {/* Main Avatar icon */}
                          <div className={`w-14 h-14 rounded-full bg-[#ebdcb2] border border-[#3d2f24] flex items-center justify-center text-3xl shadow-vintage relative flex-shrink-0 transition-transform ${
                            isActiveSpeaker ? 'scale-110 border-amber-500 ring-2 ring-amber-500/30 animate-pulse' : 'filter sepia brightness-90'
                          }`}>
                            <span>{member.avatar}</span>
                          </div>

                          {/* Interactive frequency waves indicator overlay strictly for active delegate */}
                          {isActiveSpeaker ? (
                            <div className="absolute bottom-12 inset-x-0 flex items-center justify-center gap-0.5 h-5 z-20">
                              <span className="w-1 bg-amber-500 h-3 animate-[bounce_0.6s_infinite_100ms] rounded-full" />
                              <span className="w-1 bg-amber-400 h-5 animate-[bounce_0.6s_infinite_200ms] rounded-full" />
                              <span className="w-1 bg-amber-600 h-2 animate-[bounce_0.6s_infinite_300ms] rounded-full" />
                              <span className="w-1 bg-amber-500 h-4 animate-[bounce_0.6s_infinite_400ms] rounded-full" />
                            </div>
                          ) : (
                            <span className="text-[8px] text-amber-900/40 font-mono absolute bottom-8 tracking-widest uppercase">FEED ONLINE</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-3">
                          <span className="text-3xl opacity-20 filter grayscale">🗣️</span>
                          <p className="text-[8px] font-mono text-stone-500 uppercase mt-2 tracking-widest font-black">FEED TERMINATED</p>
                          <p className="text-[7px] text-stone-600 font-mono mt-1 uppercase">CAMERA BLOCKED BY DELEGATE</p>
                        </div>
                      )}
                    </div>

                    {/* Camera and mic on/off controllers inside each square box feed */}
                    <div className="absolute top-2 right-2 z-20 flex gap-1">
                      <button
                        onClick={() => toggleParticipantMute(member.id)}
                        className={`p-1 rounded-full border transition-transform hover:scale-115 ${
                          member.isMuted ? 'bg-red-950/90 border-red-500/50 text-red-400' : 'bg-green-950/95 border-green-500/50 text-emerald-400'
                        }`}
                        title={member.isMuted ? 'Unmute participant' : 'Mute participant'}
                      >
                        {member.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => toggleParticipantVideo(member.id)}
                        className={`p-1 rounded-full border transition-transform hover:scale-115 ${
                          member.isVideoOff ? 'bg-red-950/90 border-red-500/50 text-red-400' : 'bg-blue-950/95 border-blue-500/50 text-blue-400'
                        }`}
                        title={member.isVideoOff ? 'Turn on stream' : 'Block camera feed'}
                      >
                        {member.isVideoOff ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Standard gold brass nameplate */}
                    <div 
                      className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 to-black/35 p-2 z-20 transition-all duration-300 border-t border-stone-850 ${
                        hideNameplates ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-medium text-[11px] text-[#ebdcb2] truncate block w-3/5">{member.name}</span>
                        <span className="text-[8px] font-mono text-amber-500 font-medium">Persuasion: {Math.round((mPoll.agree / (mPoll.agree + mPoll.disagree)) * 100)}%</span>
                      </div>
                      <p className="text-[9px] font-serif text-amber-300/60 truncate italic mt-0.5 leading-none">
                        {member.bio}
                      </p>
                    </div>

                    {/* Speaking notification banner on candidate cells */}
                    {isActiveSpeaker && (
                      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] ${
                        member.role === 'favour' ? 'bg-amber-900/95 border-amber-500 text-amber-100' : 'bg-blue-950/95 border-blue-500 text-blue-100'
                      } border px-2 py-0.5 uppercase tracking-wider font-bold animate-pulse text-center z-20`}>
                        🎙️ ACTIVE ORATOR
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* INTEGRATED BROADCAST MIXER PEDESTAL (Hardware-connected Master Consoles) */}
            <div className="bg-[#1b140e] border border-[#3d2f24] p-3 rounded-sm text-xs mt-2 relative">
              <div className="absolute top-1 right-2 text-[8px] font-mono text-amber-500/40">MASTER AUDIO MIXER CONSOLE</div>
              
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                
                {/* Visual LED volumemeter panel */}
                <div className="space-y-1 flex-1 max-w-sm md:max-w-[200px] border-r border-[#3d2f24]/60 pr-4">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-amber-500/80">
                    <span>MIC SIGNAL FEED</span>
                    <span>{isMicActive ? `${micVolume}%` : 'Muted'}</span>
                  </div>
                  
                  {/* Glowing dynamic level increments */}
                  <div className="flex items-center gap-0.5 w-full bg-stone-950 h-3 p-0.5 rounded-sm overflow-hidden border border-amber-950/30">
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const threshold = (idx + 1) * 8.33;
                      const isActive = isMicActive && micVolume >= threshold;
                      let colorClass = 'bg-[#1b140e] shadow-none';
                      if (isActive) {
                        if (idx < 6) colorClass = 'bg-[#27ae60] shadow-[0_0_4px_#2ec56d]';
                        else if (idx < 10) colorClass = 'bg-[#f39c12] shadow-[0_0_4px_#f5b041]';
                        else colorClass = 'bg-[#c0392b] shadow-[0_0_4px_#ec7063]';
                      }
                      return (
                        <div 
                          key={idx} 
                          className={`flex-1 h-full rounded-xs transition-colors duration-75 ${colorClass}`} 
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Main Action physical toggles */}
                <div className="flex flex-wrap items-center gap-2 flex-grow justify-start md:justify-center">
                  
                  {/* CAMERA TOGGLE */}
                  <button
                    onClick={toggleCamera}
                    className={`px-3 py-2 flex items-center gap-1.5 border font-display text-[10px] uppercase font-bold tracking-wider rounded-sm transition-all shadow-md ${
                      isCameraActive 
                        ? 'bg-amber-955 border-[#f39c12] text-[#ebdcb2] shadow-[0_0_6px_rgba(243,156,18,0.15)] hover:bg-[#ebdcb2]/15' 
                        : 'bg-red-950/80 border-red-900/60 text-red-200 hover:bg-stone-900'
                    }`}
                  >
                    {isCameraActive ? <Video className="w-3.5 h-3.5 text-[#f39c12]" /> : <VideoOff className="w-3.5 h-3.5 text-rose-500" />}
                    <span>{isCameraActive ? 'Camera ON' : 'Camera OFF'}</span>
                  </button>

                  {/* MIC TOGGLE */}
                  <button
                    onClick={toggleMic}
                    className={`px-3 py-2 flex items-center gap-1.5 border font-display text-[10px] uppercase font-bold tracking-wider rounded-sm transition-all shadow-md ${
                      isMicActive 
                        ? 'bg-green-950/80 border-[#27ae60] text-emerald-200 shadow-[0_0_6px_rgba(39,174,96,0.15)] hover:bg-[#ebdcb2]/15' 
                        : 'bg-red-950/80 border-red-900/60 text-red-200 hover:bg-stone-900'
                    }`}
                  >
                    {isMicActive ? <Mic className="w-3.5 h-3.5 text-[#2ec56d]" /> : <MicOff className="w-3.5 h-3.5 text-rose-500" />}
                    <span>{isMicActive ? 'Mic ON' : 'Mic MUTED'}</span>
                  </button>

                  {/* VOICE CLARITY TOGGLE (Connected DSP) */}
                  <button
                    onClick={() => setVoiceClarityEnabled(!voiceClarityEnabled)}
                    className={`px-3 py-2 flex items-center gap-1.5 border font-display text-[10px] uppercase font-bold tracking-widest rounded-sm transition-all ${
                      voiceClarityEnabled 
                        ? 'bg-[#1b2a1a] border-green-500 text-green-300' 
                        : 'bg-[#2a1b1b] border-amber-900 text-stone-400 opacity-60'
                    }`}
                    title="Controls Biquad equalization frequency peak centering and Dynamics leveling filters"
                  >
                    <Radio className={`w-3.5 h-3.5 ${voiceClarityEnabled ? 'text-green-400 animate-pulse' : 'text-stone-500'}`} />
                    <span className="truncate">Clarity Filter: {voiceClarityEnabled ? 'HQ ENABLED' : 'BYPASS'}</span>
                  </button>

                  {/* SELF MONITOR HEADPHONE CONNECTOR */}
                  {isMicActive && (
                    <button
                      onClick={() => setSelfMonitor(!selfMonitor)}
                      className={`px-2.5 py-2 flex items-center gap-1 border text-[9px] uppercase tracking-wider font-bold transition-all rounded-sm ${
                        selfMonitor 
                          ? 'bg-[#1a2130] border-blue-500 text-blue-300' 
                          : 'bg-stone-905 border-stone-800 text-stone-500'
                      }`}
                      title="Route processed dynamic vocal signal back to local speakers for monitoring"
                    >
                      <Headphones className="w-3 h-3" />
                      <span>{selfMonitor ? 'Monitor ON' : 'Monitor OFF'}</span>
                    </button>
                  )}

                  {/* HIDE/SHOW NAMEPLATE TOGGLE */}
                  <button
                    onClick={() => setHideNameplates(!hideNameplates)}
                    className="px-3 py-2 border border-amber-950 text-amber-200/80 hover:bg-stone-900 hover:text-white transition-all text-[10px] uppercase font-display font-medium rounded-sm flex items-center gap-1.5"
                  >
                    {hideNameplates ? <Eye className="w-3.5 h-3.5 text-amber-500" /> : <EyeOff className="w-3.5 h-3.5 text-amber-500" />}
                    <span>{hideNameplates ? 'Show Nameplates' : 'Hide Nameplates'}</span>
                  </button>

                </div>

                {/* Simulated turn controller */}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={toggleSimulation}
                    className={`px-4 py-2 font-display text-[10px] uppercase tracking-widest text-[#f4edd8] border flex items-center gap-1.5 hover:bg-white/10 ${
                      isSimulating ? 'bg-red-950 border-red-500 text-red-100' : 'bg-amber-900 border-amber-800'
                    }`}
                  >
                    {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isSimulating ? 'Pause Synod' : 'Simulate Live Debate'}</span>
                  </button>
                </div>

              </div>

              {/* Real-time Voice clarity educational label */}
              {isMicActive && (
                <div className="mt-2 pt-2 border-t border-amber-950/20 flex flex-wrap gap-2 items-center justify-between text-[9px] font-mono text-amber-500/70">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                    <span>HQ VOCAL PIPELINE STAGE: 120Hz highpass rumble filter → 2.5kHz critical speech peaking filter ({voiceClarityEnabled ? '+6.0dB' : '0.0dB bypass'}) → Normalize limiter</span>
                  </div>
                  <div>
                    <span>HARDWARE STATE: connected & sampling</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* User Claim-A-Seat Box & Smart Transcription Tool */}
          <VintageCard title="🎙️ Human Speaker Seat & Voice-to-Text Transcription" subtitle="Claim an Active Orator Seat in this Assembly">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center border-b border-amber-900/15 pb-4 mb-4">
              <div>
                <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900/70">Your Active Gown</span>
                <select 
                  value={userRole} 
                  onChange={(e) => handleUpdateUserStatus(e.target.value as any)}
                  className="w-full bg-[#ebdcb2]/40 border border-amber-950 p-2 text-xs font-serif focus:outline-none"
                >
                  <option value="audience">Spectator (Audience Seat)</option>
                  <option value="favour">Affirmative Orator (Favour/Pro)</option>
                  <option value="against">Negative Orator (Against/Con)</option>
                  <option value="moderator">Toastmaster / Moderator</option>
                </select>
              </div>

              {userRole !== 'audience' && (
                <>
                  <div>
                    <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900/70">Speaker Name</span>
                    <input 
                      type="text" 
                      value={userSpeakerName} 
                      onChange={(e) => handleUpdateUserNameAndAvatar(e.target.value, userSpeakerAvatar)}
                      className="w-full bg-[#ebdcb2]/40 border border-amber-950 p-1.5 text-xs font-serif focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900/70">Wig / Hat Icon</span>
                    <select
                      value={userSpeakerAvatar}
                      onChange={(e) => handleUpdateUserNameAndAvatar(userSpeakerName, e.target.value)}
                      className="w-full bg-[#ebdcb2]/40 border border-[#3d2f24] p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-950"
                    >
                      <option value="🎩">🎩 Top Hat</option>
                      <option value="🎓">🎓 Academic Wig</option>
                      <option value="🗣️">🗣️ Talking Bust</option>
                      <option value="🖋️">🖋️ Feather Quill</option>
                      <option value="🔍">🔍 Magnifying Glass</option>
                    </select>
                  </div>
                  <div className="text-center font-serif">
                    <span className="text-[10px] font-semibold text-green-800 bg-green-100 px-2.5 py-1 border border-green-800 rounded-sm inline-block uppercase tracking-wider">
                      ✓ Seat Secured
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Display Transcription Box if user is orator */}
            {userRole !== 'audience' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Speak / Outline Points */}
                  <div className="space-y-1">
                    <label className="block font-display text-xs uppercase tracking-wider text-amber-950 font-bold">
                      1. Orally Dictated Notes or Outline
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Type a rough draft or bullet points (e.g. 'Books are better because sensory. Digital strains the humors.')"
                      value={userDraftNotes}
                      onChange={(e) => setUserDraftNotes(e.target.value)}
                      className="w-full bg-[#f4edd8] border border-amber-950 p-2 text-xs font-serif focus:outline-none placeholder-amber-900/50"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isTranscribing || !userDraftNotes.trim()}
                        onClick={handleTranscribeDraft}
                        className="flex-1 py-1.5 vintage-button text-[10px] !bg-[#533f2d] hover:!bg-[#ebdcb2] focus:outline-none font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isTranscribing ? 'Polishing...' : 'Convert with Automated Translator'}</span>
                      </button>
                      {userDraftNotes.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserDraftNotes('');
                            setPolishedUserSpeech('');
                          }}
                          className="px-3 py-1.5 border border-amber-950/40 hover:bg-amber-950/5 text-amber-950 text-[10px] uppercase font-bold tracking-widest font-display"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Step 2: High Rhetorical Transcript result */}
                  <div className="space-y-1">
                    <label className="block font-display text-xs uppercase tracking-wider text-amber-950 font-bold">
                      2. Formal Delivered Transcript (19th-Century Style)
                    </label>
                    <textarea
                      rows={3}
                      value={polishedUserSpeech}
                      onChange={(e) => setPolishedUserSpeech(e.target.value)}
                      placeholder="Your translated, high-eloquence speech will generate here automatically..."
                      className="w-full bg-[#f4edd8] border border-amber-950 p-2 text-xs font-serif focus:outline-none placeholder-amber-900/50"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={(!polishedUserSpeech.trim() && !userDraftNotes.trim()) || userRole === 'moderator'}
                        onClick={handleDeliverUserSpeech}
                        className="flex-1 py-1.5 vintage-button text-[10px] !bg-green-950 hover:!bg-green-800 text-white font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3 h-3 text-emerald-400" />
                        <span>Deliver Speech to Court</span>
                      </button>
                      {polishedUserSpeech.trim() && (
                        <button
                          type="button"
                          onClick={() => setPolishedUserSpeech('')}
                          className="px-3 py-1.5 border border-amber-950/40 hover:bg-amber-950/5 text-amber-950 text-[10px] uppercase font-bold tracking-widest font-display"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {userRole === 'audience' && (
              <p className="font-serif italic text-xs text-amber-900/50 text-center">
                — You are listening silently from the gallery floor. Claim an orator wig above to debate and run transcriber drafts. —
              </p>
            )}
          </VintageCard>

          {/* Gown Allocation & Guest Sign-In Chest */}
          <VintageCard title="🖋️ Assembly Registration Guest Ledger" subtitle="Log in attendees to test physical seat capacities">
            <div className="space-y-4 font-serif text-amber-950">
              <p className="text-xs text-amber-900 font-serif italic mb-2">
                "To simulate multiple concurrent attendees signing in on the website, register guest delegate names below. The first 10 active check-ins are seated on the main active benches with physical video grids. All subsequent logins are automatically situated on the high gallery seats."
              </p>

              <div className="flex flex-col sm:flex-row gap-2 items-end bg-[#ebdcb2]/30 p-4 border border-amber-950/20 rounded-sm">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-mono tracking-wider text-amber-900/80 uppercase mb-1">Guest Name</label>
                  <input 
                    type="text"
                    id="guest-name-input"
                    placeholder="e.g. Lord Harrington"
                    className="w-full bg-[#f4edd8]/90 border border-[#3d2f24] p-1.5 text-xs text-amber-950 font-serif focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const nameEl = document.getElementById('guest-name-input') as HTMLInputElement;
                        const roleEl = document.getElementById('guest-role-select') as HTMLSelectElement;
                        if (nameEl && nameEl.value.trim() && roleEl) {
                          handleCheckInAttendee(nameEl.value, roleEl.value as any);
                          nameEl.value = '';
                        }
                      }
                    }}
                  />
                </div>

                <div className="w-full sm:w-auto">
                  <label className="block text-[10px] font-mono tracking-wider text-amber-900/80 uppercase mb-1">Gown Preferred</label>
                  <select 
                    id="guest-role-select"
                    className="w-full bg-[#f4edd8]/90 border border-[#3d2f24] p-1.5 text-xs font-serif focus:outline-none"
                  >
                    <option value="favour">Affirmative Gown</option>
                    <option value="against">Negative Gown</option>
                    <option value="moderator">Moderator</option>
                    <option value="audience">Audience Spectator</option>
                  </select>
                </div>

                <div className="w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const nameInput = document.getElementById('guest-name-input') as HTMLInputElement;
                      const roleSelect = document.getElementById('guest-role-select') as HTMLSelectElement;
                      if (nameInput && nameInput.value.trim() && roleSelect) {
                        handleCheckInAttendee(nameInput.value, roleSelect.value as any);
                        nameInput.value = '';
                      }
                    }}
                    className="w-full px-4 py-2 bg-[#3d2f24] hover:bg-[#ebdcb2] hover:text-[#3d2f24] border border-[#3d2f24] text-[#f4edd8] text-[9px] uppercase font-bold tracking-widest transition-all rounded-xs cursor-pointer"
                  >
                    Add to Ledger
                  </button>
                </div>
              </div>

              {/* Live statistics of seat usage */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-stone-900 p-3 text-center rounded border border-amber-950/40 mt-3">
                <div className="border-r border-amber-950/20">
                  <span className="text-amber-500 block">ORATOR BENCHES (MAX 10)</span>
                  <span className="font-bold text-amber-100 text-xs">{activeParticipantsCount} / 10 Seated</span>
                </div>
                <div>
                  <span className="text-blue-400 block">GALLERY SPECTATORS</span>
                  <span className="font-bold text-blue-100 text-xs">{audienceMembersCount} Spectators</span>
                </div>
              </div>

              {/* List of checked in people */}
              {room.participants.length > 0 && (
                <div className="mt-4 border-t border-amber-950/15 pt-3">
                  <span className="block text-[10px] font-display font-black uppercase text-amber-950/80 tracking-wider mb-2">
                    Assembly Registry Book ({room.participants.length} Seated Delegates)
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-[10px] text-amber-950 bg-[#ebdcb2]/20 p-3 rounded border border-amber-950/15">
                    {room.participants.map((p) => (
                      <div key={p.id} className="flex justify-between items-center border-b border-amber-950/5 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs">{p.avatar}</span>
                          <span className="font-medium truncate">{p.name} {p.id === uId && <strong className="text-amber-900 font-extrabold">(YOU)</strong>}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-sm text-[8px] font-extrabold font-mono uppercase tracking-wider ${
                            p.role === 'audience' 
                              ? 'bg-blue-100/80 text-blue-800 border border-blue-200' 
                              : p.role === 'favour' 
                                ? 'bg-amber-100/90 text-amber-800 border border-amber-200' 
                                : p.role === 'against' 
                                  ? 'bg-red-100/90 text-red-800 border border-red-200'
                                  : 'bg-purple-100/90 text-purple-800 border border-purple-200'
                          }`}>
                            {p.role}
                          </span>
                          {p.id !== uId && (
                            <button
                              onClick={() => {
                                const cleared = room.participants.filter(pt => pt.id !== p.id);
                                onUpdateRoom({
                                  ...room,
                                  participants: cleared,
                                  chat: [
                                    ...room.chat,
                                    {
                                      id: `guest-leave-${Date.now()}`,
                                      sender: 'AI Toastmaster',
                                      senderType: 'ai',
                                      text: `🖋️ Log Out: ${p.name} signed out and left the assembly halls.`,
                                      timestamp: 'Just now'
                                    }
                                  ]
                                });
                              }}
                              className="text-red-800 hover:text-red-500 font-bold px-1"
                              title="Delete guest from registry"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </VintageCard>

          {/* Automative Typewriter Transcription Archives Block */}
          <VintageCard title="📜 Automated Typewriter Transcription Ledger" subtitle="Public Records Office of Current Debates">
            <div 
              ref={speechScrollRef}
              className="max-h-80 overflow-y-auto border-vintage-thin border p-4 bg-[#f4edd8] text-amber-950 font-mono text-xs space-y-4 shadow-inner"
            >
              {room.speeches.length === 0 ? (
                <div className="text-center py-8 text-amber-900/50 italic font-serif">
                  *The lead typeset sits empty. No addresses have been delivered to the court. Click 'Simulate Live Debate' above or take a chair to initiate.*
                </div>
              ) : (
                room.speeches.map((speech) => (
                  <div key={speech.id} className="border-b border-dashed border-amber-900/20 pb-3 last:border-0">
                    <div className="flex items-center justify-between text-amber-900/70 text-[10px] font-bold uppercase tracking-wider mb-1">
                      <span>{speech.speakerName} ({speech.team.toUpperCase()})</span>
                      <span>{speech.timestamp}</span>
                    </div>
                    <p className="font-serif leading-relaxed text-sm text-amber-950">
                      "{speech.text}"
                    </p>
                    
                    {/* Scores layout under transcript line */}
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#ebdcb2]/40 p-2 rounded-sm text-[10px] font-semibold border border-vintage-thin border-amber-900/10 text-amber-900">
                      <div>Rhetorical Impact: <span className="font-mono text-[#5d4037] font-bold">{speech.scores.rhetoricalImpact}/10</span></div>
                      <div>Clarity Aspect: <span className="font-mono text-[#5d4037] font-bold">{speech.scores.clarity}/10</span></div>
                      <div>Logical Consistency: <span className="font-mono text-[#5d4037] font-bold">{speech.scores.logicalConsistency}/10</span></div>
                    </div>
                    {speech.aiCommentary && (
                      <p className="font-serif italic text-[11px] text-amber-900/70 mt-1 pl-2 border-l-2 border-amber-900/30">
                        Chief Justice Review: "{speech.aiCommentary}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </VintageCard>
        </div>

        {/* Right 4-Col Container: Interactive AI judge commentaries, Scores, Chat ledger, Audience reactions */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 1. Score registers Dial cabinet */}
          <VintageCard title="⚖️ Assembly Score Registers" subtitle="Aggregated rhetorical weights & ratings">
            <div className="space-y-4">
              {/* Guild A */}
              <div className="bg-[#f4edd8] border border-vintage border-amber-900/20 p-3 shadow-inner rounded-sm">
                <span className="font-serif font-bold italic text-amber-950 block text-xs">{room.favourTeam}</span>
                <span className="font-display text-[9px] uppercase tracking-wider text-green-800 font-bold block mb-2">Team Affirmative</span>
                
                <div className="space-y-1.5 text-xs font-mono text-amber-900/80">
                  <div className="flex justify-between">
                    <span>Rhetoric Impact:</span>
                    <span className="font-bold text-amber-950">{favourScore.rhetoricalImpact}/10</span>
                  </div>
                  <div className="w-full bg-[#ebdcb2]/60 h-1.5 rounded-sm overflow-hidden">
                    <div className="bg-amber-950 h-full" style={{ width: `${favourScore.rhetoricalImpact * 10}%` }} />
                  </div>

                  <div className="flex justify-between">
                    <span>Intell Clarity:</span>
                    <span className="font-bold text-amber-950">{favourScore.clarity}/10</span>
                  </div>
                  <div className="w-full bg-[#ebdcb2]/60 h-1.5 rounded-sm overflow-hidden">
                    <div className="bg-amber-950 h-full" style={{ width: `${favourScore.clarity * 10}%` }} />
                  </div>

                  <div className="flex justify-between">
                    <span>Logical Logic:</span>
                    <span className="font-bold text-amber-950">{favourScore.logicalConsistency}/10</span>
                  </div>
                  <div className="w-full bg-[#ebdcb2]/60 h-1.5 rounded-sm overflow-hidden">
                    <div className="bg-amber-950 h-full" style={{ width: `${favourScore.logicalConsistency * 10}%` }} />
                  </div>
                </div>
              </div>

              {/* Guild B */}
              <div className="bg-[#f4edd8] border border-vintage border-amber-900/20 p-3 shadow-inner rounded-sm">
                <span className="font-serif font-bold italic text-amber-950 block text-xs">{room.againstTeam}</span>
                <span className="font-display text-[9px] uppercase tracking-wider text-blue-800 font-bold block mb-2">Team Negative</span>
                
                <div className="space-y-1.5 text-xs font-mono text-amber-900/80">
                  <div className="flex justify-between">
                    <span>Rhetoric Impact:</span>
                    <span className="font-bold text-amber-950">{againstScore.rhetoricalImpact}/10</span>
                  </div>
                  <div className="w-full bg-[#ebdcb2]/60 h-1.5 rounded-sm overflow-hidden">
                    <div className="bg-amber-800 h-full" style={{ width: `${againstScore.rhetoricalImpact * 10}%` }} />
                  </div>

                  <div className="flex justify-between">
                    <span>Intell Clarity:</span>
                    <span className="font-bold text-amber-950">{againstScore.clarity}/10</span>
                  </div>
                  <div className="w-full bg-[#ebdcb2]/60 h-1.5 rounded-sm overflow-hidden">
                    <div className="bg-amber-800 h-full" style={{ width: `${againstScore.clarity * 10}%` }} />
                  </div>

                  <div className="flex justify-between">
                    <span>Logical Logic:</span>
                    <span className="font-bold text-amber-950">{againstScore.logicalConsistency}/10</span>
                  </div>
                  <div className="w-full bg-[#ebdcb2]/60 h-1.5 rounded-sm overflow-hidden">
                    <div className="bg-amber-800 h-full" style={{ width: `${againstScore.logicalConsistency * 10}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </VintageCard>

          {/* 2. Live Chat Scroll panel */}
          <VintageCard title="💬 The Gallery Whisper Log" subtitle="Real-time debate spectator commentary">
            <div className="space-y-3">
              <div 
                ref={chatScrollRef}
                className="h-44 overflow-y-auto border-vintage-thin border p-2 bg-[#ebdcb2]/40 text-xs font-serif leading-relaxed text-amber-950 space-y-2 rounded-sm"
              >
                {room.chat.map((msg) => (
                  <div key={msg.id} className="pb-1 border-b border-amber-900/10 last:border-0">
                    <span className={`font-semibold ${
                      msg.senderType === 'ai' ? 'text-purple-900 font-display uppercase tracking-wider' :
                      msg.senderType === 'moderator' ? 'text-amber-800' : 'text-amber-950'
                    }`}>
                      {msg.sender}: 
                    </span>{' '}
                    <span className="text-amber-900">{msg.text}</span>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Whisper to the gallery desk..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  className="flex-1 bg-[#ebdcb2]/30 border border-amber-950 px-2.5 py-1.5 text-xs font-serif focus:outline-none"
                />
                <button
                  onClick={() => handleSendChat()}
                  className="px-3 py-1.5 vintage-button text-[10px] uppercase font-bold tracking-widest text-[#f4edd8]"
                >
                  Whisper
                </button>
              </div>
            </div>
          </VintageCard>

          {/* 3. Audience Panel & Interactive Reaction Tools */}
          <VintageCard title="🤝 Gallery Floor Reactions" subtitle="Interactive poll indexes & gallery noises">
            <div className="space-y-4">
              <span className="block font-display text-[10px] uppercase font-black tracking-wider text-amber-900/70 text-center">
                Submit Real-Time Gallery Noises
              </span>

              {/* Emoji/Noises Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                <button
                  onClick={() => handleAudienceReaction('applause')}
                  className="p-2 border border-vintage border-amber-900/30 hover:bg-[#ebdcb2] transition-all bg-[#ebdcb2]/30 text-amber-950 rounded-sm font-semibold flex items-center justify-between"
                >
                  <span>👏 Applause</span>
                  <span className="font-mono text-amber-900 bg-amber-950/10 px-1.5 py-0.5 rounded-sm">
                    {room.audienceReactions.applause}
                  </span>
                </button>
                <button
                  onClick={() => handleAudienceReaction('hearHear')}
                  className="p-2 border border-vintage border-amber-900/30 hover:bg-[#ebdcb2] transition-all bg-[#ebdcb2]/30 text-amber-950 rounded-sm font-semibold flex items-center justify-between"
                >
                  <span>📜 "Hear, Hear!"</span>
                  <span className="font-mono text-amber-900 bg-amber-950/10 px-1.5 py-0.5 rounded-sm">
                    {room.audienceReactions.hearHear}
                  </span>
                </button>
                <button
                  onClick={() => handleAudienceReaction('rubbish')}
                  className="p-2 border border-vintage border-amber-900/30 hover:bg-[#ebdcb2] transition-all bg-[#ebdcb2]/30 text-amber-950 rounded-sm font-semibold flex items-center justify-between"
                >
                  <span>🗑️ "Rubbish!"</span>
                  <span className="font-mono text-amber-900 bg-amber-950/10 px-1.5 py-0.5 rounded-sm">
                    {room.audienceReactions.rubbish}
                  </span>
                </button>
                <button
                  onClick={() => handleAudienceReaction('question')}
                  className="p-2 border border-vintage border-amber-900/30 hover:bg-[#ebdcb2] transition-all bg-[#ebdcb2]/30 text-amber-950 rounded-sm font-semibold flex items-center justify-between"
                >
                  <span>❓ Inquiry</span>
                  <span className="font-mono text-amber-900 bg-amber-950/10 px-1.5 py-0.5 rounded-sm">
                    {room.audienceReactions.question}
                  </span>
                </button>
              </div>

              {/* Dynamic Spectator Poll for current speech */}
              <div className="border-t border-amber-900/10 pt-4 mt-2">
                <span className="block font-display text-[10px] uppercase font-black tracking-wider text-amber-900/70 text-center mb-2">
                  Speaker Conviction Assessment
                </span>

                <div className="bg-[#f4edd8] border border-vintage border-amber-900/15 p-3 rounded-sm space-y-2 text-xs">
                  <p className="font-serif italic text-amber-900/90 text-center mb-1">
                    "Are the Affirmative and Negative orators persuading you?"
                  </p>
                  
                  {room.speeches.length > 0 ? (
                    (() => {
                      const latestSpeech = room.speeches[room.speeches.length -1];
                      const sPoll = room.speakerPolls[latestSpeech.speakerId] || { agree: 10, disagree: 6 };
                      return (
                        <div className="space-y-2">
                          <div className="font-semibold text-center text-amber-950">
                            Current Speaker: {latestSpeech.speakerName}
                          </div>
                          
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleVoteSpeakerPoll(latestSpeech.speakerId, 'agree')}
                              className="px-3 py-1 flex items-center gap-1 border border-[#27ae60]/40 text-[#27ae60] hover:bg-[#27ae60]/10 text-xs rounded-sm font-bold font-display"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" /> Persuaded ({sPoll.agree})
                            </button>
                            <button
                              onClick={() => handleVoteSpeakerPoll(latestSpeech.speakerId, 'disagree')}
                              className="px-3 py-1 flex items-center gap-1 border border-[#c0392b]/40 text-[#c0392b] hover:bg-[#c0392b]/10 text-xs rounded-sm font-bold font-display"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" /> Skeptical ({sPoll.disagree})
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-2 text-amber-900/40 italic">
                      *Waiting for first speech delivered to launch conviction poll...*
                    </div>
                  )}
                </div>
              </div>

            </div>
          </VintageCard>
        </div>
      </div>

      {/* Official Summary Report Modal */}
      {summaryReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative parchment border-vintage-thin border-8 p-8 max-w-2xl w-full mx-auto my-8 shadow-2xl rounded-sm">
            {/* Absolute close button */}
            <button
              onClick={() => setSummaryReport(null)}
              className="absolute top-4 right-4 bg-[#3d2f24] text-[#ebdcb2] w-7 h-7 rounded-full border border-[#ebdcb2] flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>

            {/* Official Gilded Header Emblem */}
            <div className="text-center space-y-2 border-b-2 border-amber-950 pb-6 mb-6">
              <span className="font-display font-medium text-amber-900 text-[10px] tracking-[0.4em] block uppercase">Official Assembly Resolution</span>
              <p className="text-2xl font-black font-display text-amber-950 uppercase tracking-tight">POST-DEBATE DECREE REPORT</p>
              <div className="w-16 h-16 bg-[#c0392b] border-4 border-amber-950 rounded-full mx-auto shadow-lg relative flex items-center justify-center select-none text-[#ebdcb2]">
                <span className="text-[10px] font-display font-bold leading-none tracking-widest text-center mt-0.5">WAX SEAL</span>
              </div>
            </div>

            {/* Summary details */}
            <div className="space-y-6 font-serif">
              <div>
                <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900 block mb-1">PROPOSITION SUBJECT</span>
                <p className="text-sm font-bold italic text-amber-950">"{summaryReport.overallTopic}"</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-b border-amber-900/10 py-4">
                <div>
                  <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900 block mb-0.5">AFFIRMATIVE AVERAGE</span>
                  <span className="text-lg font-mono font-bold text-amber-950">{summaryReport.favourAverageScore}/10</span>
                </div>
                <div>
                  <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900 block mb-0.5">NEGATIVE AVERAGE</span>
                  <span className="text-lg font-mono font-bold text-amber-950">{summaryReport.againstAverageScore}/10</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900 block mb-1">🏆 BEST SPEAKER DESIGNATION</span>
                  <span className="text-sm font-bold text-amber-950 italic">{summaryReport.bestSpeaker}</span>
                </div>
                <div>
                  <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900 block mb-1">RHETORIC CRITIQUE STYLE</span>
                  <span className="text-xs text-amber-900">{summaryReport.rhetoricalNotes}</span>
                </div>
              </div>

              <div>
                <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900 block mb-1">POINTS OF CENTRAL CORE CLASH</span>
                <ul className="list-disc list-inside text-xs text-amber-950 space-y-1 pl-1">
                  {summaryReport.clashPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-amber-900/20">
                <span className="font-display text-[10px] uppercase font-bold tracking-wider text-amber-900 block mb-1">JUDICIAL CONCLUSION DECREE</span>
                <p className="text-xs leading-relaxed italic text-amber-950">
                  {summaryReport.conclusion}
                </p>
              </div>
            </div>

            {/* Official Bottom signatures */}
            <div className="mt-8 pt-6 border-t border-amber-950 flex justify-between items-center text-[10px] font-display font-semibold tracking-wide text-amber-900/70">
              <div className="text-center">
                <div className="font-serif italic text-sm text-amber-950 font-bold mb-1">The AI sovereign Judge</div>
                <span>AUTHENTICATED RECTOR</span>
              </div>
              <div className="text-center">
                <div className="font-serif italic text-sm text-amber-950 font-bold mb-1">The High Clerk of Courts</div>
                <span>REGISTRARY OFFICE</span>
              </div>
            </div>

            {/* Close / Go Back Button Action */}
            <div className="mt-8 pt-4 border-t border-dashed border-amber-950/20 flex justify-center">
              <button
                onClick={() => setSummaryReport(null)}
                className="px-6 py-2.5 bg-[#ebdcb2] border border-[#3d2f24] hover:bg-[#3d2f24] hover:text-[#ebdcb2] text-amber-950 font-display text-xs uppercase tracking-widest font-bold shadow-vintage transition-all"
              >
                ← Dismiss Decree & Return to Chamber
              </button>
            </div>
          </div>
        </div>
      )}

      {generatingSummary && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-4 text-center">
          <VintageCard className="max-w-sm text-center">
            <Sparkles className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
            <h3 className="font-display text-lg font-bold text-amber-950">Deliberating decree...</h3>
            <p className="font-serif italic text-sm text-amber-900/70 mt-2">
              "The Sovereign AI Chief Justice is reviewing the transcription scrolls of this debate assembly, evaluating clarity metrics, and sealing the final resolutions..."
            </p>
          </VintageCard>
        </div>
      )}
    </div>
  );
}
