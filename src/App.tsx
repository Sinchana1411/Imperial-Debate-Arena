import React, { useState, useEffect } from 'react';
import { INITIAL_DEBATE_ROOMS } from './data';
import { DebateRoom } from './types';
import RoomDashboard from './components/RoomDashboard';
import DebateRoomChamber from './components/DebateRoom';
import { Clock, Ship, CalendarClock, LogOut, Database, Settings, ShieldCheck, Copy, Check, Info } from 'lucide-react';
import { supabase, getSupabaseConfig, saveSupabaseOverride, getLiveKitConfig, saveLiveKitOverride, configureSupabase } from './lib/supabaseClient';
import { fetchFullSupabaseRoom, listSupabaseRooms, saveSupabaseRoomMeta, deleteSupabaseRoom, SQL_SCHEMA_MIGRATION } from './lib/supabaseSync';

export default function App() {
  const [rooms, setRooms] = useState<DebateRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // Real-time dynamic pocket watch timer
  const [currentTime, setCurrentTime] = useState<string>('');

  // Global browser login session state with a unique user ID
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    role: 'favour' | 'against' | 'moderator' | 'audience';
    avatar: string;
  } | null>(null);

  // WebSocket reference
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // Supabase & LiveKit Dynamic Configuration settings states
  const [showSettings, setShowSettings] = useState(false);
  const [supabaseConfigState, setSupabaseConfigState] = useState(getSupabaseConfig());
  const [supabaseOverrideUrl, setSupabaseOverrideUrl] = useState(getSupabaseConfig().url);
  const [supabaseOverrideKey, setSupabaseOverrideKey] = useState('');
  const [liveKitOverrideUrl, setLiveKitOverrideUrl] = useState(getLiveKitConfig().url);
  const [copiedSql, setCopiedSql] = useState(false);

  // Initialize and load saved state or connect WebSocket
  useEffect(() => {
    // 1. Core user session details check
    const savedUser = localStorage.getItem('vintage_logged_in_user');
    let loadedUser: any = null;
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // Guarantee they have a unique user ID
        if (!parsed.id) {
          parsed.id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          localStorage.setItem('vintage_logged_in_user', JSON.stringify(parsed));
        }
        loadedUser = parsed;
        setCurrentUser(parsed);
      } catch (e) {}
    }

    // 2. Load rooms fallback local storage (used while socket is offline or as seed)
    const savedRooms = localStorage.getItem('vintage_debate_rooms');
    if (savedRooms) {
      try {
        setRooms(JSON.parse(savedRooms));
      } catch (e) {
        setRooms(INITIAL_DEBATE_ROOMS);
      }
    } else {
      setRooms(INITIAL_DEBATE_ROOMS);
    }

    // 3. Establish Live Assembly WebSocket connection (shares port 3000 behind proxy)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    let ws: WebSocket;
    let reconnectTimeout: any;

    function connect() {
      console.log("Connecting to central Assembly Ledger...", wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("Successfully connected to the central Assembly Ledger.");
        setSocket(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data.type);
          if (data.type === 'INIT_ROOMS') {
            setRooms(data.rooms);
            localStorage.setItem('vintage_debate_rooms', JSON.stringify(data.rooms));
          } else if (data.type === 'ROOMS_UPDATED') {
            setRooms(data.rooms);
            localStorage.setItem('vintage_debate_rooms', JSON.stringify(data.rooms));
          } else if (data.type === 'ROOM_UPDATED') {
            setRooms(prev => {
              const next = prev.map(r => r.id === data.room.id ? data.room : r);
              localStorage.setItem('vintage_debate_rooms', JSON.stringify(next));
              return next;
            });
          }
        } catch (err) {
          console.error("Error parsing websocket message payload:", err);
        }
      };

      ws.onclose = () => {
        console.warn("Assembly Ledger websocket closed. Retrying in 2.5 seconds...");
        setSocket(null);
        reconnectTimeout = setTimeout(connect, 2500);
      };

      ws.onerror = (err) => {
        console.error("Assembly Ledger connection error. Toggling close...", err);
        ws.close();
      };
    }

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // 4. Dynamic Cloud Supabase Server Initialization & Postgres Real-time Sync
  useEffect(() => {
    let active = true;
    let channel: any = null;

    async function bootstrapDatabase() {
      try {
        // Query server config proxy to automatically check for secrets
        const res = await fetch("/api/config");
        if (res.ok) {
          const configData = await res.json();
          const localConf = getSupabaseConfig();
          
          if (configData.supabaseUrl && configData.supabaseAnonKey && localConf.source !== 'user-override') {
            console.log("Supabase setup: Environment variables detected on host node. Dynamic bridge activating...");
            configureSupabase(configData.supabaseUrl, configData.supabaseAnonKey, true);
            
            if (active) {
              const freshConf = getSupabaseConfig();
              setSupabaseConfigState(freshConf);
              setSupabaseOverrideUrl(freshConf.url);
            }
          }
        }
      } catch (err) {
        console.warn("Could not query dynamic config channel on start. Defaulting to client variables/overrides.", err);
      }

      // Check current active client instance
      const { supabase: activeClient } = await import('./lib/supabaseClient');
      if (!activeClient) {
        console.info("Supabase Sync: No active Supabase configuration loaded. Running in local memory fallback.");
        return;
      }

      console.log("Supabase Integration verified. Seeding assembly registers...");
      try {
        const loaded = await listSupabaseRooms();
        if (active && loaded.length > 0) {
          setRooms(loaded);
        }
      } catch (dbErr) {
        console.warn("Initial DB load failed. Check if SQL tables are fully run in your database.", dbErr);
      }

      // Hook up Postgres changes channels
      try {
        channel = activeClient
          .channel('public:debate_all_tables')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'debate_rooms' }, async () => {
            const loaded = await listSupabaseRooms();
            if (active) setRooms(loaded);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'debate_participants' }, async () => {
            const loaded = await listSupabaseRooms();
            if (active) setRooms(loaded);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'debate_messages' }, async () => {
            const loaded = await listSupabaseRooms();
            if (active) setRooms(loaded);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'debate_speeches' }, async () => {
            const loaded = await listSupabaseRooms();
            if (active) setRooms(loaded);
          })
          .subscribe();
      } catch (rtErr) {
        console.warn("Failing Real-time sync bridge:", rtErr);
      }
    }

    bootstrapDatabase();

    return () => {
      active = false;
      if (channel) {
        try {
          if (supabase) supabase.removeChannel(channel);
        } catch (e) {}
      }
    };
  }, []);

  // Sync rooms data changes to central ledger or fallback locally
  const saveRooms = (updatedRooms: DebateRoom[]) => {
    setRooms(updatedRooms);
    localStorage.setItem('vintage_debate_rooms', JSON.stringify(updatedRooms));
  };

  const handleLogin = (user: { id: string; name: string; role: 'favour' | 'against' | 'moderator' | 'audience'; avatar: string }) => {
    setCurrentUser(user);
    localStorage.setItem('vintage_logged_in_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('vintage_logged_in_user');
  };

  // Timer loop for pocket watch visualizer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('en-US', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateRoom = async (updatedRoom: DebateRoom) => {
    if (supabase) {
      await saveSupabaseRoomMeta(updatedRoom);
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'UPDATE_ROOM', room: updatedRoom }));
    } else {
      const newRooms = rooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r));
      saveRooms(newRooms);
    }
  };

  const handleAddRoom = async (newRoom: DebateRoom) => {
    if (supabase) {
      await saveSupabaseRoomMeta(newRoom);
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ADD_ROOM', room: newRoom }));
    } else {
      const newRooms = [newRoom, ...rooms];
      saveRooms(newRooms);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (supabase) {
      await deleteSupabaseRoom(roomId);
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'DELETE_ROOM', roomId }));
    } else {
      const newRooms = rooms.filter((r) => r.id !== roomId);
      saveRooms(newRooms);
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
      }
    }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // If visitor is not logged in to the website yet, prompt them with the Grand Ledger Signature Gate
  if (!currentUser) {
    return (
      <div id="main-vintage-container" className="min-h-screen bg-[#ebdcb2] py-12 relative overflow-x-hidden border-[16px] border-[#3d2f24] font-serif flex items-center justify-center selection:bg-amber-900 selection:text-white">
        {/* Visual Wall Texture Accent (Subtle classical drop-shadow lines) */}
        <div className="absolute inset-0 bg-[radial-gradient(#3d2f24_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
        
        <div className="max-w-md w-full mx-auto p-8 parchment border-8 border-amber-950/85 shadow-2xl relative z-10 text-center rounded-sm">
          <p className="font-display font-bold text-[10px] uppercase tracking-[0.3em] text-[#c0392b] mb-1">
            ★ Welcome to the Classical Assembly ★
          </p>
          <h1 className="font-display text-3xl font-black text-amber-950 tracking-tight uppercase border-b-2 border-amber-950 pb-4 mb-6">
            CHRONICLE REGISTRY
          </h1>
          
          <LoginForm onLogin={handleLogin} />
          
          <p className="font-serif italic text-[11px] text-amber-950/60 mt-6 border-t border-amber-950/10 pt-4 leading-relaxed">
            "Entering these chambers seals your name into the historical registries of the Summer Synodus of 2026. Exercise maximum intellectual eloquence."
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="main-vintage-container" className="min-h-screen bg-[#ebdcb2] py-6 relative overflow-x-hidden border-[16px] border-[#3d2f24] font-serif selection:bg-amber-900 selection:text-white">
      {/* Visual Wall Texture Accent (Subtle classical drop-shadow lines) */}
      <div className="absolute inset-0 bg-[radial-gradient(#3d2f24_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Decorative Outer Masthead Scroll Frame */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 space-y-6">
        
        {/* Top Mini utility Row: Live Cloud Status, Settings & Pocket Watch Indicators */}
        <div className="flex flex-col gap-2 border-b border-amber-950/20 pb-3 text-xs font-mono text-amber-900">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Ship className="w-3.5 h-3.5 text-amber-900" />
              <span className="font-display font-medium uppercase tracking-wider text-[10px]">
                Chamber Guild Delegate Desk
              </span>
              <div className="h-3 w-[1px] bg-amber-950/20 mx-2 hidden sm:block" />
              <span className="font-sans text-[10px] text-amber-950 font-bold bg-[#f4edd8] px-2 py-0.5 rounded border border-amber-950/10">
                Active Session: {currentUser.avatar} {currentUser.name} ({currentUser.role.toUpperCase()})
              </span>
              <button 
                onClick={handleLogout}
                className="text-[#c0392b] hover:text-[#e74c3c] transition-colors ml-2 font-bold cursor-pointer text-[10px] uppercase flex items-center gap-1 border-b border-dashed border-[#c0392b]"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-1.5 bg-[#ebdcb2] border border-amber-950/30 hover:bg-[#ebd097] text-amber-950 px-2.5 py-1 rounded transition-colors text-[10px] uppercase font-bold cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings & SQL Schema</span>
              </button>

              {/* Visual Watch indicator */}
              <div className="flex items-center gap-1.5 bg-[#f4edd8] px-3 py-1 rounded-full border border-amber-950/25">
                <Clock className="w-3.5 h-3.5 text-amber-800" />
                <span className="font-bold text-amber-950 text-[11px]">{currentTime}</span>
              </div>
            </div>
          </div>

          {/* Connection Status Sub-row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 border-t border-amber-950/10 pt-2 text-[10px]">
            <div className="flex items-center gap-3.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>Supabase Ledger:</span>
                {supabaseConfigState.isConfigured ? (
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                    🟢 Cloud Sync Active ({supabaseConfigState.source})
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-[#e2d5af]">
                    🟡 Assembly Room Memory fallback
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>LiveKit Stream:</span>
                {getLiveKitConfig().isConfigured ? (
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                    🟢 Voice Grid Ready
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300">
                    🟡 Acoustic Audio Simulator
                  </span>
                )}
              </div>
            </div>

            <div className="text-amber-900/60 font-sans italic">
              Assembly Code: <span className="underline font-bold font-mono">#{selectedRoomId || "dashboard"}</span>
            </div>
          </div>
        </div>

        {/* Credentials and SQL Schema Configuration Panel Overlay */}
        {showSettings && (
          <div className="parchment border-4 border-amber-950 p-6 rounded-sm shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-amber-950/20 pb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-950" />
                <h2 className="text-sm uppercase font-bold text-amber-950 tracking-wider">
                  Chamber Connection & Credentials Ledger
                </h2>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-amber-900 hover:text-black font-bold font-mono text-sm uppercase px-1.5 border border-amber-950/20 hover:border-black rounded"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-amber-950/80 leading-relaxed font-sans">
              Connect these vintage debates to your real <strong>Supabase</strong> database ledger for persistent cloud storage and <strong>LiveKit Cloud</strong> for crystal-clear microphone audio streams between active speakers.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              saveSupabaseOverride(supabaseOverrideUrl, supabaseOverrideKey);
              saveLiveKitOverride(liveKitOverrideUrl);
              setShowSettings(false);
            }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Supabase Parameters */}
              <div className="space-y-3 bg-[#ebdcb2]/40 p-3.5 rounded border border-amber-950/20">
                <h3 className="text-xs uppercase font-extrabold text-amber-950/90 border-b border-amber-950/10 pb-1">
                  🌐 Supabase DB Ledger
                </h3>
                
                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-950 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={supabaseOverrideUrl}
                    onChange={(e) => setSupabaseOverrideUrl(e.target.value)}
                    placeholder="https://your-project-id.supabase.co"
                    className="w-full text-xs font-mono bg-stone-50 border border-amber-950/30 p-1.5 rounded text-amber-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-950 mb-1">
                    Supabase Anon/Public Key (or Service Role)
                  </label>
                  <input
                    type="password"
                    value={supabaseOverrideKey}
                    onChange={(e) => setSupabaseOverrideKey(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full text-xs font-mono bg-stone-50 border border-amber-950/30 p-1.5 rounded text-amber-950"
                  />
                  <p className="text-[9px] text-amber-900/60 mt-1 italic font-sans">
                    Leave password blank to preserve current key override or ENV parameters.
                  </p>
                </div>
              </div>

              {/* LiveKit Voice Parameters */}
              <div className="space-y-3 bg-[#ebdcb2]/40 p-3.5 rounded border border-amber-950/20">
                <h3 className="text-xs uppercase font-extrabold text-[#c0392b] border-b border-amber-950/10 pb-1">
                  🎙️ LiveKit Voice Cloud
                </h3>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-950 mb-1">
                    LiveKit Server URL
                  </label>
                  <input
                    type="text"
                    value={liveKitOverrideUrl}
                    onChange={(e) => setLiveKitOverrideUrl(e.target.value)}
                    placeholder="wss://your-host.livekit.cloud"
                    className="w-full text-xs font-mono bg-stone-50 border border-amber-950/30 p-1.5 rounded text-amber-950"
                  />
                  <p className="text-[9px] text-amber-900/60 mt-1 italic font-sans font-medium">
                    Keys are stored securely server-side. Set <code>LIVEKIT_API_KEY</code> &amp; <code>LIVEKIT_API_SECRET</code> in the applet Settings (Gear Icon) to authenticate.
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      saveSupabaseOverride('', 'CLEAR');
                      saveLiveKitOverride('');
                      setShowSettings(false);
                    }}
                    className="px-2.5 py-1.5 bg-[#ebdcb2]/30 text-amber-950 border border-amber-950/30 hover:bg-red-50 hover:text-[#c0392b] rounded cursor-pointer uppercase font-extrabold transition-colors"
                  >
                    Clear Overrides
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-amber-950 text-white hover:bg-amber-900 rounded font-bold uppercase tracking-wider cursor-pointer shadow transition-colors"
                  >
                    Save &amp; Syncload
                  </button>
                </div>
              </div>
            </form>

            {/* SQL Table Migration Code Section */}
            <div className="bg-[#fcfaf2] border border-amber-950/30 rounded p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-amber-950/10 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-800" />
                  <span className="text-[11px] font-extrabold uppercase text-amber-900 font-display">
                    Step 2: Run Postgres Database Tables in Supabase Console
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_SCHEMA_MIGRATION);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[9px] font-bold text-amber-950 bg-[#ebdcb2] border border-amber-950/20 px-2 py-0.5 rounded hover:bg-[#ebd097] cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-emerald-800" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql ? "Sql Copied!" : "Copy SQL Script"}</span>
                </button>
              </div>
              <p className="text-[10px] text-amber-900/70 font-sans leading-relaxed">
                Open your Supabase project&apos;s <strong>SQL Editor</strong>, paste this setup script, and click <kbd className="bg-stone-200 px-1 rounded border">Run</kbd>. This provisions the tables and hooks up Supabase Realtime so active speakers align instantly!
              </p>
              <pre className="text-[9px] font-mono text-stone-700 bg-stone-100 p-2.5 rounded max-h-[140px] overflow-y-auto border border-stone-200">
                {SQL_SCHEMA_MIGRATION}
              </pre>
            </div>
          </div>
        )}

        {/* Dynamic Route Switching */}
        {selectedRoomId && selectedRoom ? (
          <DebateRoomChamber 
            room={selectedRoom} 
            currentUser={currentUser}
            onBack={() => setSelectedRoomId(null)} 
            onUpdateRoom={handleUpdateRoom}
          />
        ) : (
          <RoomDashboard 
            rooms={rooms}
            onSelectRoom={setSelectedRoomId}
            onModifyRoom={handleUpdateRoom}
            onAddRoom={handleAddRoom}
            onDeleteRoom={handleDeleteRoom}
          />
        )}
      </div>
    </div>
  );
}

// Innermost helper: High elegance vintage signature entry book form
function LoginForm({ onLogin }: { onLogin: (user: { id: string; name: string; role: 'favour' | 'against' | 'moderator' | 'audience'; avatar: string }) => void }) {
  const [name, setName] = useState('Ebenezer Miller');
  const [role, setRole] = useState<'favour' | 'against' | 'moderator' | 'audience'>('favour');
  const [avatar, setAvatar] = useState('🎩');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const uniqueId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    onLogin({ id: uniqueId, name, role, avatar });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left font-serif">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-amber-900/90 mb-1 font-display">
          1. Sign Your Name on the Ledger
        </label>
        <input 
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Samuel Davenport"
          className="w-full bg-[#f4edd8] border border-amber-950 p-2.5 text-xs text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-950"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-amber-900/90 mb-1 font-display">
          2. Select Your Gown Affiliation / Seat
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="w-full bg-[#f4edd8] border border-amber-950 p-2.5 text-xs text-amber-950 focus:outline-none"
        >
          <option value="favour">Affirmative Gown (Favour / Pro)</option>
          <option value="against">Negative Gown (Against / Con)</option>
          <option value="moderator">House Toastmaster (Moderator)</option>
          <option value="audience">Silent Spectator (Audience Seats)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-amber-900/90 mb-1 font-display">
          3. Choose Your Assembly Crest Symbol
        </label>
        <div className="grid grid-cols-5 gap-2">
          {['🎩', '🎓', '🗣️', '🖋️', '🔍'].map((icon) => (
            <button
              type="button"
              key={icon}
              onClick={() => setAvatar(icon)}
              className={`p-2.5 text-2xl border flex items-center justify-center transition-all ${
                avatar === icon 
                  ? 'bg-[#ebdcb2] border-amber-950 text-amber-950 scale-105 shadow-md shadow-amber-950/20' 
                  : 'bg-[#f4edd8] border-amber-950/20 text-amber-900/40 hover:bg-[#ebdcb2]/40'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="w-full py-3 mt-4 vintage-button text-[#f4edd8] font-bold font-display uppercase tracking-widest text-[11px] hover:shadow-lg focus:outline-none"
      >
        Sign Registrar & Join Chambers →
      </button>
    </form>
  );
}
