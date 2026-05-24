import React, { useState } from 'react';
import { DebateRoom } from '../types';
import VintageCard from './VintageCard';
import { Calendar, Clock, Radio, Users, Plus, Edit3, Trash2, Shield, Sparkles } from 'lucide-react';

interface RoomDashboardProps {
  rooms: DebateRoom[];
  onSelectRoom: (roomId: string) => void;
  onModifyRoom: (updatedRoom: DebateRoom) => void;
  onAddRoom: (newRoom: DebateRoom) => void;
  onDeleteRoom: (roomId: string) => void;
}

export default function RoomDashboard({
  rooms,
  onSelectRoom,
  onModifyRoom,
  onAddRoom,
  onDeleteRoom,
}: RoomDashboardProps) {
  const [filter, setFilter] = useState<'all' | 'live' | 'starting' | 'scheduled'>('all');
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);
  
  // States for adding or editing a debate room
  const [newTopic, setNewTopic] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newFavour, setNewFavour] = useState('The Gutenberg Fellowship');
  const [newAgainst, setNewAgainst] = useState('The Silicon Vanguard');
  const [newStatus, setNewStatus] = useState<'live' | 'starting' | 'scheduled'>('scheduled');
  const [newTime, setNewTime] = useState('Tomorrow, 3:30 PM');
  
  const [editId, setEditId] = useState<string | null>(null);

  const filteredRooms = rooms.filter((room) => {
    if (filter === 'all') return true;
    return room.status === filter;
  });

  const handleCreateOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    if (editId) {
      // Find previous room for metadata carrying (or clone participants if any)
      const existing = rooms.find(r => r.id === editId);
      const updated: DebateRoom = {
        ...existing!,
        topic: newTopic,
        description: newDesc,
        favourTeam: newFavour,
        againstTeam: newAgainst,
        status: newStatus,
        scheduledAt: newStatus === 'live' ? 'Live Now' : newStatus === 'starting' ? 'Starting in 10 minutes' : newTime,
      };
      onModifyRoom(updated);
      setEditId(null);
    } else {
      // Create a fresh chamber with a clean, empty state ready for logins
      const fresh: DebateRoom = {
        id: `room-${Date.now()}`,
        topic: newTopic,
        description: newDesc,
        status: newStatus,
        scheduledAt: newStatus === 'live' ? 'Live Now' : newStatus === 'starting' ? 'Starting in 10 minutes' : newTime,
        favourTeam: newFavour,
        againstTeam: newAgainst,
        audienceReactions: { applause: 0, hearHear: 0, rubbish: 0, question: 0 },
        speakerPolls: {},
        chat: [
          { id: 'start-welcome', sender: 'AI Toastmaster', senderType: 'ai', text: 'Decorum is requested as this chamber opens to the floor.', timestamp: 'Just now' }
        ],
        speeches: [],
        participants: []
      };
      onAddRoom(fresh);
    }

    // Reset Form
    setNewTopic('');
    setNewDesc('');
    setNewFavour('The Gutenberg Fellowship');
    setNewAgainst('The Silicon Vanguard');
    setNewStatus('scheduled');
    setNewTime('Tomorrow, 3:30 PM');
  };

  const handleEditInit = (room: DebateRoom) => {
    setEditId(room.id);
    setNewTopic(room.topic);
    setNewDesc(room.description);
    setNewFavour(room.favourTeam);
    setNewAgainst(room.againstTeam);
    setNewStatus(room.status);
    setNewTime(room.scheduledAt);
    setShowAdminPanel(true);
  };

  return (
    <div className="space-y-8 animate-fade-in px-4 md:px-0">
      {/* Header Banner - Classical Newspaper Layout */}
      <div className="border-vintage-thin border-b-4 border-t-4 py-8 text-center bg-transparent mt-2 border-amber-900/60">
        <p className="font-display font-bold text-xs uppercase tracking-[0.3em] text-amber-900/95">
          ★ The Classical Assembly Registry ★
        </p>
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-amber-950 my-3 uppercase">
          THE CHRONICLE JOURNAL
        </h1>
        <p className="font-serif italic text-base md:text-lg text-amber-900/80 max-w-2xl mx-auto px-4">
          "Where high rhetoric, forensic dialectic, and the computational analytical faculties of the AI Chief Justice unite for civilized discourse."
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-4 border-t border-amber-900/10 text-xs font-mono max-w-xl mx-auto text-amber-900/70">
          <span>VOL. LXXXIV № 12</span>
          <span>•</span>
          <span>ESTABLISHED MAY 2026</span>
          <span>•</span>
          <span>PRICE: TWO PENCE</span>
        </div>
      </div>

      {/* Main Registry Controls & Filtering */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-b border-amber-900/20">
        <div className="flex flex-wrap gap-2">
          {(['all', 'live', 'starting', 'scheduled'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 uppercase font-display text-xs tracking-wider border transition-all ${
                filter === t
                  ? 'bg-amber-950 text-[#f4edd8] border-amber-950 opacity-100'
                  : 'border-amber-900/40 text-amber-950 hover:bg-amber-950/5'
              }`}
            >
              {t === 'all' && 'All Chambers'}
              {t === 'live' && '🔴 Live Now'}
              {t === 'starting' && '⏳ Starting in 10m'}
              {t === 'scheduled' && '📅 Scheduled'}
            </button>
          ))}
        </div>

        {/* Administrator Access Button */}
        <button
          onClick={() => setShowAdminPanel(!showAdminPanel)}
          className={`px-4 py-1.5 flex items-center gap-2 border uppercase font-display text-xs tracking-wider transition-all shadow-sm ${
            showAdminPanel
              ? 'bg-amber-900 text-amber-100 border-amber-900'
              : 'border-amber-900/40 text-amber-900 hover:bg-amber-900/5'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          {showAdminPanel ? 'Close Organizer Panel' : 'Organizer (Admin) Controls'}
        </button>
      </div>

      {/* Dynamic Admin (Organizer) Drawer */}
      {showAdminPanel && (
        <VintageCard 
          title={editId ? "✏️ Amending Scheduled Council" : "📜 Chartering a New Debating Assembly"}
          subtitle="Admin & Organizer Privileges"
          className="border-amber-900/40"
        >
          <form onSubmit={handleCreateOrUpdate} className="space-y-4 text-sm">
            <div>
              <label className="block font-display text-xs uppercase tracking-wider text-amber-950 mb-1 font-bold">
                Debate Proposition (The Topic)
              </label>
              <input
                type="text"
                required
                placeholder="RESOLVED: That..."
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="w-full bg-[#ebdcb2]/40 border border-amber-900/30 p-2.5 rounded-sm font-serif focus:outline-none focus:border-amber-900/90 text-amber-950"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-display text-xs uppercase tracking-wider text-amber-950 mb-1 font-bold">
                  Affirmative Guild Team Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="The Gutenberg Fellowship"
                  value={newFavour}
                  onChange={(e) => setNewFavour(e.target.value)}
                  className="w-full bg-[#ebdcb2]/40 border border-amber-900/30 p-2.5 rounded-sm focus:outline-none focus:border-amber-900 text-amber-950"
                />
              </div>
              <div>
                <label className="block font-display text-xs uppercase tracking-wider text-amber-950 mb-1 font-bold">
                  Negative Guild Team Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="The Silicon Vanguard"
                  value={newAgainst}
                  onChange={(e) => setNewAgainst(e.target.value)}
                  className="w-full bg-[#ebdcb2]/40 border border-amber-900/30 p-2.5 rounded-sm focus:outline-none focus:border-amber-900 text-amber-950"
                />
              </div>
            </div>

            <div>
              <label className="block font-display text-xs uppercase tracking-wider text-amber-950 mb-1 font-bold">
                Brief Context / Preamble Description
              </label>
              <textarea
                rows={2}
                placeholder="A brief philosophical background to set the scholarly mood..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full bg-[#ebdcb2]/40 border border-amber-900/30 p-2.5 rounded-sm font-serif focus:outline-none focus:border-amber-900 text-amber-950"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-display text-xs uppercase tracking-wider text-amber-950 mb-1 font-bold">
                  Assembly Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-[#ebdcb2]/40 border border-amber-900/30 p-2 rounded-sm focus:outline-none focus:border-amber-900 text-amber-950"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="starting">Starting in 10 minutes</option>
                  <option value="live">Live Now (Interactive)</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block font-display text-xs uppercase tracking-wider text-amber-950 mb-1 font-bold">
                  Schedule Citation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tomorrow, 4:00 PM or Saturday, May 30th"
                  disabled={newStatus !== 'scheduled'}
                  value={newStatus === 'live' ? 'Live Now' : newStatus === 'starting' ? 'Starting in 10 mins' : newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-[#ebdcb2]/40 border border-amber-900/30 p-2.5 rounded-sm disabled:opacity-50 text-amber-950"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setNewTopic('');
                  setNewDesc('');
                  setShowAdminPanel(false);
                }}
                className="px-4 py-2 border border-vintage border-amber-900/30 text-amber-900 hover:bg-amber-950/5 font-display text-xs uppercase tracking-wider"
              >
                {editId ? 'Cancel Edit' : 'Close Panel'}
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-amber-900 text-[#f4edd8] border border-amber-950 hover:bg-amber-950 hover:text-white font-display text-xs uppercase tracking-wider font-bold shadow-vintage transition-all"
              >
                {editId ? 'Apply Amendments' : 'Charter New Chamber'}
              </button>
            </div>
          </form>
        </VintageCard>
      )}

      {/* Grid of Active Chambers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredRooms.length === 0 ? (
          <div className="col-span-2 text-center py-16 border-vintage border border-dashed rounded-md border-amber-900/30">
            <p className="font-serif italic text-lg text-amber-900/70">
              "No debates meeting your specified decree have been found."
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isLive = room.status === 'live';
            const isStarting = room.status === 'starting';
            
            return (
              <div key={room.id} className="group relative">
                {/* Admin quick controls overlaid onto top corner */}
                {showAdminPanel && (
                  <div className="absolute top-4 right-4 z-20 flex gap-1 bg-[#f4edd8] p-1 border border-vintage border-amber-900/30 rounded-full shadow-md">
                    <button
                      onClick={() => handleEditInit(room)}
                      title="Edit Debate Info"
                      className="p-1.5 hover:bg-amber-900/10 text-amber-800 rounded-full transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteRoom(room.id)}
                      title="Decommission Chamber"
                      className="p-1.5 hover:bg-red-900/10 text-red-700 rounded-full transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <VintageCard className={`${isLive ? 'ring-2 ring-amber-950/80 shadow-2xl scale-[1.01] transition-all' : 'opacity-90 hover:opacity-100 transition-all border-amber-900/50'}`}>
                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mb-4">
                    {isLive && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold leading-none bg-red-950 text-red-100 uppercase tracking-widest font-display animate-pulse">
                        <Radio className="w-3 h-3" /> Live Active
                      </span>
                    )}
                    {isStarting && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold leading-none bg-amber-950 text-amber-100 uppercase tracking-widest font-display">
                        <Clock className="w-3 h-3" /> Starting in 10m
                      </span>
                    )}
                    {!isLive && !isStarting && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium leading-none bg-amber-900/10 text-amber-900 uppercase tracking-widest font-display border border-amber-900/20">
                        <Calendar className="w-3 h-3" /> Scheduled
                      </span>
                    )}
                  </div>

                  {/* Debate Topic Letterpress Header */}
                  <h3 className="font-display text-xl font-black text-amber-950 leading-tight group-hover:text-amber-900 transition-colors uppercase tracking-tight mb-3">
                    {room.topic}
                  </h3>

                  <p className="font-serif italic text-sm text-amber-900/80 line-clamp-3 mb-6 leading-relaxed">
                    "{room.description}"
                  </p>

                  {/* Guild Affiliates */}
                  <div className="border-t border-b border-amber-900/10 py-3 mb-6 grid grid-cols-2 gap-4 text-xs font-semibold">
                    <div>
                      <span className="font-display uppercase tracking-wider text-amber-900/60 block text-[10px]">Affirmative Counsel</span>
                      <span className="text-amber-950 font-serif font-bold italic line-clamp-1">{room.favourTeam}</span>
                    </div>
                    <div className="border-l border-amber-900/15 pl-4">
                      <span className="font-display uppercase tracking-wider text-amber-900/60 block text-[10px]">Negative Counsel</span>
                      <span className="text-amber-950 font-serif font-bold italic line-clamp-1">{room.againstTeam}</span>
                    </div>
                  </div>

                  {/* Footer Stats & Navigation */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-1 font-mono text-xs text-amber-900/70">
                      <Users className="w-3.5 h-3.5" />
                      <span>{room.participants.length} Orators Registered</span>
                    </div>

                    <button
                      onClick={() => onSelectRoom(room.id)}
                      className="px-5 py-2 vintage-button text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <span>{isLive ? 'Enter Chamber ➔' : 'Inspect Registers ⚙'}</span>
                    </button>
                  </div>
                </VintageCard>
              </div>
            );
          })
        )}
      </div>

      {/* Aesthetic Footer Citation */}
      <div className="text-center py-6 text-xs text-amber-900/50 font-serif border-t border-amber-900/10">
        <Sparkles className="w-4 h-4 mx-auto mb-2 text-amber-900/40" />
        <p>This gazette is distributed free of charge. Printed with genuine lead-based lead typesetting simulation.</p>
        <p className="mt-1">All digital humors verified by the AI Chief Justice, patent pending, 2026.</p>
      </div>
    </div>
  );
}
