import { supabase } from './supabaseClient';
import { DebateRoom, Participant, ChatMessage, SpeechSegment } from '../types';

export const SQL_SCHEMA_MIGRATION = `-- SQL schema for Vintage Debate Assembly chambers

-- 1. Create debate_rooms table
CREATE TABLE IF NOT EXISTS debate_rooms (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled',
  scheduled_at TEXT,
  description TEXT,
  favour_team TEXT,
  against_team TEXT,
  audience_reactions JSONB DEFAULT '{"applause":0,"hearHear":0,"rubbish":0,"question":0}'::jsonb,
  speaker_polls JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create debate_participants table
CREATE TABLE IF NOT EXISTS debate_participants (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES debate_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  is_muted BOOLEAN DEFAULT false,
  is_video_off BOOLEAN DEFAULT false,
  avatar_seed TEXT,
  bio TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create debate_messages table
CREATE TABLE IF NOT EXISTS debate_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES debate_rooms(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create debate_speeches table
CREATE TABLE IF NOT EXISTS debate_speeches (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES debate_rooms(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  team TEXT NOT NULL,
  text TEXT NOT NULL,
  scores JSONB,
  ai_commentary TEXT,
  timestamp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Supabase Realtime for instant multi-user broadcasts
ALTER PUBLICATION supabase_realtime ADD TABLE debate_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE debate_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE debate_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE debate_speeches;`;

// Helper: Query and build a full local DebateRoom object from separate Supabase tables
export async function fetchFullSupabaseRoom(roomId: string): Promise<DebateRoom | null> {
  if (!supabase) return null;

  try {
    // 1. Fetch Room Meta details
    const { data: rm, error: rmErr } = await supabase
      .from('debate_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (rmErr || !rm) {
      console.warn("Supabase Sync: Could not find room meta or tables don't exist yet.", rmErr);
      return null;
    }

    // 2. Fetch Active Participants
    const { data: ptData, error: ptErr } = await supabase
      .from('debate_participants')
      .select('*')
      .eq('room_id', roomId);

    // 3. Fetch Chat Messages
    const { data: chData, error: chErr } = await supabase
      .from('debate_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    // 4. Fetch Judged Speeches
    const { data: spData, error: spErr } = await supabase
      .from('debate_speeches')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (ptErr || chErr || spErr) {
      console.warn("Supabase Sync: Error fetching children elements:", { ptErr, chErr, spErr });
    }

    // Clean sub-arrays
    const mappedParticipants: Participant[] = (ptData || []).map(p => ({
      id: p.id,
      name: p.name,
      role: p.role as any,
      avatar: p.avatar || '🎩',
      isMuted: !!p.is_muted,
      isVideoOff: !!p.is_video_off,
      avatarSeed: p.avatar_seed || p.id,
      bio: p.bio || 'Honorable Delegate'
    }));

    const mappedChat: ChatMessage[] = (chData || []).map(c => ({
      id: c.id,
      sender: c.sender,
      senderType: c.sender_type as any,
      text: c.text,
      timestamp: c.timestamp || 'Recent'
    }));

    const mappedSpeeches: SpeechSegment[] = (spData || []).map(s => ({
      id: s.id,
      speakerId: s.speaker_id,
      speakerName: s.speaker_name,
      team: s.team as any,
      text: s.text,
      scores: s.scores || { rhetoricalImpact: 5, clarity: 5, logicalConsistency: 5 },
      aiCommentary: s.ai_commentary || '',
      timestamp: s.timestamp || 'Classical Hour'
    }));

    return {
      id: rm.id,
      topic: rm.topic,
      status: rm.status || 'scheduled',
      scheduledAt: rm.scheduled_at || 'Just Now',
      description: rm.description || '',
      favourTeam: rm.favour_team || 'Favour',
      againstTeam: rm.against_team || 'Against',
      audienceReactions: rm.audience_reactions || { applause: 0, hearHear: 0, rubbish: 0, question: 0 },
      speakerPolls: rm.speaker_polls || {},
      participants: mappedParticipants,
      chat: mappedChat,
      speeches: mappedSpeeches
    };
  } catch (err) {
    console.error("fetchFullSupabaseRoom general failure:", err);
    return null;
  }
}

// Helper: Sync all Rooms to match Supabase if available
export async function listSupabaseRooms(): Promise<DebateRoom[]> {
  if (!supabase) return [];
  try {
    const { data: roomList, error } = await supabase
      .from('debate_rooms')
      .select('id')
      .order('created_at', { ascending: false });

    if (error || !roomList) return [];

    const rooms: DebateRoom[] = [];
    for (const r of roomList) {
      const full = await fetchFullSupabaseRoom(r.id);
      if (full) rooms.push(full);
    }
    return rooms;
  } catch (e) {
    console.error("listSupabaseRooms failure:", e);
    return [];
  }
}

// Set seat and sync participant state to Supabase
export async function joinOrUpdateSupabaseParticipant(roomId: string, p: Participant): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('debate_participants')
      .upsert({
        id: p.id,
        room_id: roomId,
        name: p.name,
        role: p.role,
        avatar: p.avatar,
        is_muted: p.isMuted,
        is_video_off: p.isVideoOff,
        avatar_seed: p.avatarSeed,
        bio: p.bio,
        last_seen_at: new Date().toISOString()
      });
    return !error;
  } catch (err) {
    console.error("joinOrUpdateSupabaseParticipant failure:", err);
    return false;
  }
}

// Remove seat on disconnect / exit
export async function leaveSupabaseRoom(participantId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('debate_participants')
      .delete()
      .eq('id', participantId);
    return !error;
  } catch (err) {
    return false;
  }
}

// Append new chat message
export async function addSupabaseChatMessage(roomId: string, msg: ChatMessage): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('debate_messages')
      .insert({
        id: msg.id,
        room_id: roomId,
        sender: msg.sender,
        sender_type: msg.senderType,
        text: msg.text,
        timestamp: msg.timestamp,
        created_at: new Date().toISOString()
      });
    return !error;
  } catch (e) {
    return false;
  }
}

// Append judged speech segment
export async function addSupabaseSpeechSegment(roomId: string, sp: SpeechSegment): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('debate_speeches')
      .insert({
        id: sp.id,
        room_id: roomId,
        speaker_id: sp.speakerId,
        speaker_name: sp.speakerName,
        team: sp.team,
        text: sp.text,
        scores: sp.scores,
        ai_commentary: sp.aiCommentary,
        timestamp: sp.timestamp,
        created_at: new Date().toISOString()
      });
    return !error;
  } catch (e) {
    return false;
  }
}

// Sync room header details, reactions, or polls
export async function saveSupabaseRoomMeta(room: DebateRoom): Promise<boolean> {
  if (!supabase) return false;
  try {
    // 1. Upsert primary Room metadata row
    const { error: roomErr } = await supabase
      .from('debate_rooms')
      .upsert({
        id: room.id,
        topic: room.topic,
        status: room.status,
        scheduled_at: room.scheduledAt,
        description: room.description,
        favour_team: room.favourTeam,
        against_team: room.againstTeam,
        audience_reactions: room.audienceReactions,
        speaker_polls: room.speakerPolls
      });

    if (roomErr) {
      console.warn("Supabase Sync: Failed room metadata query:", roomErr);
      return false;
    }

    // 2. Synchronize active participants
    if (room.participants && room.participants.length > 0) {
      const dbParticipants = room.participants.map(p => ({
        id: p.id,
        room_id: room.id,
        name: p.name,
        role: p.role,
        avatar: p.avatar,
        is_muted: !!p.isMuted,
        is_video_off: !!p.isVideoOff,
        avatar_seed: p.avatarSeed || p.id,
        bio: p.bio || 'Honorable Delegate'
      }));

      const { error: ptErr } = await supabase
        .from('debate_participants')
        .upsert(dbParticipants);

      if (ptErr) console.warn("Supabase Sync: Failed parsing participants row updates:", ptErr);

      // Clean old stale participant records from database that grew obsolete
      const activeIds = room.participants.map(p => p.id);
      const { error: clErr } = await supabase
        .from('debate_participants')
        .delete()
        .eq('room_id', room.id)
        .not('id', 'in', activeIds);
      if (clErr) console.warn("Supabase Sync: stale record clearance error:", clErr);
    }

    // 3. Synchronize chat messages (write any missing messages)
    if (room.chat && room.chat.length > 0) {
      const dbChats = room.chat.map(c => ({
        id: c.id,
        room_id: room.id,
        sender: c.sender,
        sender_type: c.senderType,
        text: c.text,
        timestamp: c.timestamp || 'Now'
      }));

      const { error: chErr } = await supabase
        .from('debate_messages')
        .upsert(dbChats);

      if (chErr) console.warn("Supabase Sync: Failed message entries bulk copy:", chErr);
    }

    // 4. Synchronize speeches (write any missing scored segments)
    if (room.speeches && room.speeches.length > 0) {
      const dbSpeeches = room.speeches.map(s => ({
        id: s.id,
        room_id: room.id,
        speaker_id: s.speakerId,
        speaker_name: s.speakerName,
        team: s.team,
        text: s.text,
        scores: s.scores,
        ai_commentary: s.aiCommentary,
        timestamp: s.timestamp || 'Classical Hour'
      }));

      const { error: spErr } = await supabase
        .from('debate_speeches')
        .upsert(dbSpeeches);

      if (spErr) console.warn("Supabase Sync: Failed speech segments bulk update:", spErr);
    }

    return true;
  } catch (e) {
    console.error("General saveSupabaseRoomMeta failure:", e);
    return false;
  }
}

// Delete room fully
export async function deleteSupabaseRoom(roomId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('debate_rooms')
      .delete()
      .eq('id', roomId);
    return !error;
  } catch (e) {
    return false;
  }
}
