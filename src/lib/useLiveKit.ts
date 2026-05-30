import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { getLiveKitConfig } from './supabaseClient';

function formatLiveKitUrl(url?: string): string {
  if (!url) return "";
  let formatted = url.trim();
  if (formatted.startsWith("http://")) {
    formatted = "ws://" + formatted.substring(7);
  } else if (formatted.startsWith("https://")) {
    formatted = "wss://" + formatted.substring(8);
  } else if (!formatted.startsWith("ws://") && !formatted.startsWith("wss://")) {
    formatted = "wss://" + formatted;
  }
  return formatted;
}

export function useLiveKit(
  roomId: string,
  participantId: string,
  participantName: string,
  isMicActive: boolean,
  isCameraActive: boolean
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [videoTracks, setVideoTracks] = useState<{ [identity: string]: any }>({});
  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const roomRef = useRef<Room | null>(null);

  const isMicActiveRef = useRef(isMicActive);
  const isCameraActiveRef = useRef(isCameraActive);

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
    isCameraActiveRef.current = isCameraActive;
  }, [isMicActive, isCameraActive]);

  useEffect(() => {
    let active = true;
    let room: Room | null = null;
    let localTrackSyncInterval: any = null;

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

        if (!active) return;
        setIsDemo(false);
        const lkConfig = getLiveKitConfig();
        const rawServerUrl = lkConfig.url || data.livekitUrl;
        const serverUrl = formatLiveKitUrl(rawServerUrl);

        // Instantiate livekit Room
        room = new Room();
        roomRef.current = room;

        // Register room listeners
        room.on(RoomEvent.Connected, () => {
          if (!active) return;
          setIsConnected(true);
          setIsConnecting(false);
          setCanPlayAudio(room?.canPlaybackAudio ?? true);
          console.log("Successfully bridged into the remote voice stream.");
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!active) return;
          setIsConnected(false);
          setIsConnecting(false);
          setVideoTracks({});
        });

        // Listen for remote audio and video track subscriptions
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === 'audio') {
            console.log(`Subscribed to audio track of ${participant.identity}`);
            const el = track.attach();
            el.id = `audio-track-${track.sid}`;
            document.body.appendChild(el);
          } else if (track.kind === 'video') {
            console.log(`Subscribed to video track of ${participant.identity}`);
            setVideoTracks(prev => ({
              ...prev,
              [participant.identity]: track
            }));
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (track.kind === 'audio') {
            const el = document.getElementById(`audio-track-${track.sid}`);
            if (el) el.remove();
            track.detach().forEach(audioEl => audioEl.remove());
          } else if (track.kind === 'video') {
            console.log(`Unsubscribed from video track of ${participant.identity}`);
            setVideoTracks(prev => {
              const updated = { ...prev };
              delete updated[participant.identity];
              return updated;
            });
          }
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log(`Participant disconnected: ${participant.identity}`);
          setVideoTracks(prev => {
            const updated = { ...prev };
            delete updated[participant.identity];
            return updated;
          });
        });

        // Track active speakers for fancy glowing visual effects!
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (!active) return;
          setActiveSpeakers(speakers.map(s => s.identity));
        });

        room.on(RoomEvent.AudioPlaybackStatusChanged, (playable) => {
          if (!active) return;
          setCanPlayAudio(playable);
        });

        // Function to find and expose the local video track in our videoTracks state
        const updateLocalVideoTrackInState = () => {
          if (!room) return;
          const localVideoPub = Array.from(room.localParticipant.videoTrackPublications.values())
            .find(pub => pub.track !== undefined);
          const localTrack = localVideoPub?.track;

          setVideoTracks(prev => {
            const updated = { ...prev };
            if (localTrack) {
              updated[participantId] = localTrack;
            } else {
              delete updated[participantId];
            }
            return updated;
          });
        };

        room.on(RoomEvent.LocalTrackPublished, (publication) => {
          if (publication.track?.kind === 'video') {
            updateLocalVideoTrackInState();
          }
        });

        room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.track?.kind === 'video') {
            updateLocalVideoTrackInState();
          }
        });

        // Establish connection
        await room.connect(serverUrl, data.token, { autoSubscribe: true });

        // Synchronize microphone & camera states immediately on connection
        try {
          await room.localParticipant.setMicrophoneEnabled(isMicActiveRef.current);
        } catch (micErr) {
          console.warn("Could not activate local microphone hardware. Entering silent monitoring mode.", micErr);
        }

        try {
          await room.localParticipant.setCameraEnabled(isCameraActiveRef.current);
        } catch (camErr) {
          console.warn("Could not activate local camera hardware on connection.", camErr);
        }

        // Periodic check to ensure local track is synced correctly in state
        localTrackSyncInterval = setInterval(() => {
          if (active) {
            updateLocalVideoTrackInState();
          }
        }, 3000);

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
      if (localTrackSyncInterval) {
        clearInterval(localTrackSyncInterval);
      }
      if (room) {
        try {
          room.disconnect();
        } catch (e) {}
      }
      roomRef.current = null;
    };
  }, [roomId, participantId]);

  // Handle active toggles reactively
  useEffect(() => {
    if (isDemo || !roomRef.current || roomRef.current.state !== 'connected') return;
    roomRef.current.localParticipant.setMicrophoneEnabled(isMicActive)
      .catch(err => console.error("Failed to alter mic track state reactively:", err));
  }, [isMicActive, isDemo]);

  useEffect(() => {
    if (isDemo || !roomRef.current || roomRef.current.state !== 'connected') return;
    roomRef.current.localParticipant.setCameraEnabled(isCameraActive)
      .catch(err => console.error("Failed to alter camera track state reactively:", err));
  }, [isCameraActive, isDemo]);

  const startAudio = async () => {
    if (roomRef.current) {
      await roomRef.current.startAudio();
      setCanPlayAudio(roomRef.current.canPlaybackAudio);
    }
  };

  return {
    isConnected,
    isConnecting,
    isDemo,
    error,
    activeSpeakers,
    videoTracks,
    canPlayAudio,
    startAudio
  };
}
