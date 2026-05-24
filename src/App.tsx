import React, { useState, useEffect } from 'react';
import { INITIAL_DEBATE_ROOMS } from './data';
import { DebateRoom } from './types';
import RoomDashboard from './components/RoomDashboard';
import DebateRoomChamber from './components/DebateRoom';
import { Clock, Ship, CalendarClock } from 'lucide-react';

export default function App() {
  const [rooms, setRooms] = useState<DebateRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // Real-time dynamic pocket watch timer
  const [currentTime, setCurrentTime] = useState<string>('');

  // Initial load of chambers from localStorage if available, else static presets
  useEffect(() => {
    const saved = localStorage.getItem('vintage_debate_rooms');
    if (saved) {
      try {
        setRooms(JSON.parse(saved));
      } catch (e) {
        setRooms(INITIAL_DEBATE_ROOMS);
      }
    } else {
      setRooms(INITIAL_DEBATE_ROOMS);
    }
  }, []);

  // Sync rooms data changes to localStorage
  const saveRooms = (updatedRooms: DebateRoom[]) => {
    setRooms(updatedRooms);
    localStorage.setItem('vintage_debate_rooms', JSON.stringify(updatedRooms));
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

  const handleUpdateRoom = (updatedRoom: DebateRoom) => {
    const newRooms = rooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r));
    saveRooms(newRooms);
  };

  const handleAddRoom = (newRoom: DebateRoom) => {
    const newRooms = [newRoom, ...rooms];
    saveRooms(newRooms);
  };

  const handleDeleteRoom = (roomId: string) => {
    const newRooms = rooms.filter((r) => r.id !== roomId);
    saveRooms(newRooms);
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div id="main-vintage-container" className="min-h-screen bg-[#ebdcb2] py-6 relative overflow-x-hidden border-[16px] border-[#3d2f24] font-serif selection:bg-amber-900 selection:text-white">
      {/* Visual Wall Texture Accent (Subtle classical drop-shadow lines) */}
      <div className="absolute inset-0 bg-[radial-gradient(#3d2f24_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Decorative Outer Masthead Scroll Frame */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 space-y-6">
        
        {/* Top Mini utility Row: Simulated Status Indicator & Pocket Watch and Gavel Indicators */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-amber-950/20 pb-2 text-xs font-mono text-amber-900">
          <div className="flex items-center gap-1.5">
            <Ship className="w-3.5 h-3.5 text-amber-900" />
            <span className="font-display font-medium uppercase tracking-wider text-[10px]">
              Chamber Guild Delegate Desk
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            {/* Visual Watch indicator */}
            <div className="flex items-center gap-1.5 bg-[#f4edd8] px-3 py-1 rounded-full border border-amber-950/25">
              <Clock className="w-3.5 h-3.5 text-amber-800" />
              <span className="font-bold text-amber-950 text-[11px]">{currentTime}</span>
            </div>
            
            <div className="hidden md:flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              <span>Session: Summer Synodus 2026</span>
            </div>
          </div>
        </div>

        {/* Dynamic Route Switching */}
        {selectedRoomId && selectedRoom ? (
          <DebateRoomChamber 
            room={selectedRoom} 
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
