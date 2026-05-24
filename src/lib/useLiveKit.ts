import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { getLiveKitConfig } from './supabaseClient';

export function useLiveKit(roomId: string, participantId: string, participantName: string, initialMute: boolean) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let active = true;
    let room: Room | null = null;

    async function initializeLiveKit() {
      setIsConnecting(true);
      setError(null);

      try {
        // Fetch LiveKit access token from Express backend
        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: roomId, identity: participantId, name: participantName })
        });

        if (!res.ok) {
          throw new Error("Failed to retrieve LiveKit token from backend ledger.");
        }

        const data = await res.json();
        
        if (data.isDemo) {
          setIsDemo(true);
          setIsConnected(true);
          setIsConnecting(false);
          console.log("Assembly voice: LiveKit credentials missing. Initiating acoustic simulator.");
          return;
        }

        setIsDemo(false);
        const lkConfig = getLiveKitConfig();
        const serverUrl = lkConfig.url || data.livekitUrl;

        // Instantiate livekit Room
        room = new Room();
        roomRef.current = room;

        // Register room listeners
        room.on(RoomEvent.Connected, () => {
          if (!active) return;
          setIsConnected(true);
          setIsConnecting(false);
          console.log("Successfully bridged into the remote voice stream.");
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!active) return;
          setIsConnected(false);
          setIsConnecting(false);
        });

        // Listen for remote audio track subscriptions to playback audio
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === 'audio') {
            console.log(`Subscribed to audio track of ${participant.identity}`);
            const el = track.attach();
            el.id = `audio-track-${track.sid}`;
            document.body.appendChild(el);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          const el = document.getElementById(`audio-track-${track.sid}`);
          if (el) el.remove();
          track.detach().forEach(audioEl => audioEl.remove());
        });

        // Track active speakers for fancy glowing visual effects!
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (!active) return;
          setActiveSpeakers(speakers.map(s => s.identity));
        });

        // Establish connection
        await room.connect(serverUrl, data.token, { autoSubscribe: true });

        // Publish local mic audio if seating assignment is active
        try {
          await room.localParticipant.setMicrophoneEnabled(!initialMute);
        } catch (micErr) {
          console.warn("Could not activate local microphone hardware. Entering silent monitoring mode.", micErr);
        }

      } catch (err: any) {
        console.error("LiveKit connection pipeline failed:", err);
        if (active) {
          setError(err.message || "Failed bridging voice assembly client.");
          setIsConnecting(false);
          setIsDemo(true); // Graceful robust fallback
          setIsConnected(true); 
        }
      }
    }

    initializeLiveKit();

    return () => {
      active = false;
      if (room) {
        try {
          room.disconnect();
        } catch (e) {}
      }
      roomRef.current = null;
    };
  }, [roomId, participantId]);

  // Handle live toggle for mic mute
  const setMicMuted = async (muted: boolean) => {
    if (isDemo || !roomRef.current) {
      console.log(`Demo Voice state: User mic set to ${muted ? 'Muted' : 'Published'}`);
      return;
    }
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!muted);
    } catch (e) {
      console.error("Failed to alter microphone track state", e);
    }
  };

  return {
    isConnected,
    isConnecting,
    isDemo,
    error,
    activeSpeakers,
    setMicMuted
  };
}
