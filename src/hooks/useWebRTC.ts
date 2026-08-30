import { useState, useRef, useEffect, useCallback } from 'react';
import { Participant } from '../types';

interface UseWebRTCProps {
  currentParticipant: Participant | null;
  sendSignal: (targetId: string | null, signalData: any) => void;
}

export function useWebRTC({ currentParticipant, sendSignal }: UseWebRTCProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCallFrom, setIncomingCallFrom] = useState<{ senderId: string; senderAlias: string } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [callDuration, setCallDuration] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stop local media tracks
  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setAudioLevel(0);
    setCallDuration(0);
  }, []);

  // Close all peer connections
  const closeAllPeers = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnectionsRef.current.clear();

    remoteAudioElementsRef.current.forEach((audio) => {
      try {
        audio.pause();
        audio.srcObject = null;
      } catch {}
    });
    remoteAudioElementsRef.current.clear();

    stopLocalMedia();
    setIsInCall(false);
    setIsCalling(false);
    setIncomingCallFrom(null);
  }, [stopLocalMedia]);

  // Audio level analyser
  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.warn('Audio analyzer error:', e);
    }
  }, []);

  // Create or get RTCPeerConnection for a peer
  const getOrCreatePeerConnection = useCallback(
    (peerId: string) => {
      let pc = peerConnectionsRef.current.get(peerId);
      if (!pc) {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });

        // Add local tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => {
            pc!.addTrack(track, localStreamRef.current!);
          });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendSignal(peerId, {
              type: 'candidate',
              candidate: event.candidate,
            });
          }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
          let remoteAudio = remoteAudioElementsRef.current.get(peerId);
          if (!remoteAudio) {
            remoteAudio = new Audio();
            remoteAudio.autoplay = true;
            remoteAudioElementsRef.current.set(peerId, remoteAudio);
          }
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.play().catch(() => {});
        };

        peerConnectionsRef.current.set(peerId, pc);
      }
      return pc;
    },
    [sendSignal]
  );

  // Start voice call
  const startCall = useCallback(async () => {
    try {
      setIsCalling(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setupAudioAnalyser(stream);

      setIsInCall(true);
      setIsCalling(false);

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      // Broadcast call request to room
      sendSignal(null, {
        type: 'call-request',
        senderAlias: currentParticipant?.alias || 'Peer',
      });
    } catch (err) {
      console.error('Failed to get user media for call:', err);
      setIsCalling(false);
      alert('Microphone access is required to initiate an encrypted voice call.');
    }
  }, [currentParticipant, sendSignal, setupAudioAnalyser]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCallFrom) return;
    const callerId = incomingCallFrom.senderId;
    setIncomingCallFrom(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setupAudioAnalyser(stream);

      setIsInCall(true);

      durationIntervalRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      const pc = getOrCreatePeerConnection(callerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignal(callerId, {
        type: 'offer',
        sdp: offer,
      });
    } catch (err) {
      console.error('Failed to accept call:', err);
      closeAllPeers();
    }
  }, [incomingCallFrom, getOrCreatePeerConnection, sendSignal, setupAudioAnalyser, closeAllPeers]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (incomingCallFrom) {
      sendSignal(incomingCallFrom.senderId, {
        type: 'call-rejected',
      });
      setIncomingCallFrom(null);
    }
  }, [incomingCallFrom, sendSignal]);

  // End active call
  const endCall = useCallback(() => {
    sendSignal(null, {
      type: 'call-ended',
    });
    closeAllPeers();
  }, [sendSignal, closeAllPeers]);

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!audioTracks[0]?.enabled);
    }
  }, []);

  // Handle incoming signaling messages from WebSockets
  const handleSignalingData = useCallback(
    async (senderId: string, signalData: any) => {
      const { type, sdp, candidate, senderAlias } = signalData;

      switch (type) {
        case 'call-request': {
          if (!isInCall) {
            setIncomingCallFrom({ senderId, senderAlias: senderAlias || 'Anonymous Peer' });
          }
          break;
        }

        case 'offer': {
          try {
            if (!localStreamRef.current) {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              localStreamRef.current = stream;
              setupAudioAnalyser(stream);
              setIsInCall(true);
            }
            const pc = getOrCreatePeerConnection(senderId);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendSignal(senderId, {
              type: 'answer',
              sdp: answer,
            });
          } catch (e) {
            console.error('Error handling WebRTC offer:', e);
          }
          break;
        }

        case 'answer': {
          try {
            const pc = peerConnectionsRef.current.get(senderId);
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            }
          } catch (e) {
            console.error('Error handling WebRTC answer:', e);
          }
          break;
        }

        case 'candidate': {
          try {
            const pc = peerConnectionsRef.current.get(senderId);
            if (pc && candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          } catch (e) {
            console.error('Error handling ICE candidate:', e);
          }
          break;
        }

        case 'call-ended': {
          closeAllPeers();
          break;
        }

        case 'call-rejected': {
          setIsCalling(false);
          closeAllPeers();
          break;
        }

        default:
          break;
      }
    },
    [isInCall, getOrCreatePeerConnection, sendSignal, setupAudioAnalyser, closeAllPeers]
  );

  useEffect(() => {
    return () => {
      closeAllPeers();
    };
  }, [closeAllPeers]);

  return {
    isInCall,
    isCalling,
    incomingCallFrom,
    isMuted,
    audioLevel,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    handleSignalingData,
  };
}
