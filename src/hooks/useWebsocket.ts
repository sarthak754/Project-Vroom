import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Participant,
  WireMessage,
  DecryptedMessage,
  RoomSettings,
  EncryptedPayload,
} from '../types';
import {
  encryptData,
  decryptData,
} from '../crypto';

interface UseWebSocketProps {
  roomId: string | null;
  encryptionKey: CryptoKey | null;
  currentParticipant: Participant | null;
  initialSettings?: RoomSettings;
  onRoomDestroyed?: (reason: string) => void;
  onWebRTCSignal?: (senderId: string, signalData: any) => void;
}

export function useWebSocket({
  roomId,
  encryptionKey,
  currentParticipant,
  initialSettings,
  onRoomDestroyed,
  onWebRTCSignal,
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(
    initialSettings || {
      burnTimerSec: 0,
      isPrivate: false,
      maxParticipants: 10,
      allowVoiceNotes: true,
      allowVoiceCall: true,
    }
  );
  const [typingUsers, setTypingUsers] = useState<Record<string, { alias: string; expiresAt: number }>>({});
  const [unreadCount, setUnreadCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDestroyedRef = useRef(false);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastEventTimestampRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsDisabledRef = useRef(false);
  const expiredMessageIdsRef = useRef<Set<string>>(new Set());

  // Function to delete message across server and peer clients
  const deleteMessage = useCallback(
    (messageId: string) => {
      expiredMessageIdsRef.current.add(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      if (roomId) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'message:delete',
              payload: { messageId },
            })
          );
        } else {
          fetch(`/api/room/${encodeURIComponent(roomId)}/message/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId }),
          }).catch(() => {});
        }
      }
    },
    [roomId]
  );

  // Decrypt and ingest a wire message
  const ingestWireMessage = useCallback(
    async (wireMsg: WireMessage) => {
      if (!wireMsg || !wireMsg.encrypted || !encryptionKey || !currentParticipant) return;
      if (expiredMessageIdsRef.current.has(wireMsg.id)) return;

      const burnTimer = wireMsg.burnTimerSec || 0;
      const msgTimestamp = wireMsg.timestamp || Date.now();
      
      // Calculate absolute expiration from when the message was sent/created
      const burnExpiresAt = burnTimer > 0 ? msgTimestamp + burnTimer * 1000 : undefined;

      // If already expired according to burnTimer, immediately ignore/purge
      if (burnExpiresAt && burnExpiresAt <= Date.now()) {
        expiredMessageIdsRef.current.add(wireMsg.id);
        setMessages((prev) => prev.filter((m) => m.id !== wireMsg.id));
        return;
      }

      // Check if we already have this message (idempotency)
      let alreadyExists = false;
      setMessages((prev) => {
        if (prev.some((m) => m.id === wireMsg.id)) {
          alreadyExists = true;
        }
        return prev;
      });
      if (alreadyExists) return;

      try {
        const decryptedJson = await decryptData(encryptionKey, wireMsg.encrypted);
        const parsedContent = JSON.parse(decryptedJson);

        const isSender = wireMsg.senderId === currentParticipant.id;
        const burnTimer = wireMsg.burnTimerSec || 0;
        const burnExpiresAt = burnTimer > 0 ? Date.now() + burnTimer * 1000 : undefined;

        const decryptedMsg: DecryptedMessage = {
          id: wireMsg.id,
          roomId: wireMsg.roomId,
          senderId: wireMsg.senderId,
          senderAlias: wireMsg.senderAlias,
          senderColor: wireMsg.senderColor,
          recipientId: wireMsg.recipientId,
          recipientAlias: wireMsg.recipientAlias,
          type: parsedContent.type || 'text',
          content: parsedContent.content || '',
          fileName: parsedContent.fileName,
          fileSize: parsedContent.fileSize,
          fileMime: parsedContent.fileMime,
          audioDuration: parsedContent.audioDuration,
          timestamp: wireMsg.timestamp,
          burnTimerSec: burnTimer,
          burnExpiresAt,
          reactions: parsedContent.reactions || {},
          isSender,
          status: 'delivered',
        };

        setMessages((prev) => {
          if (prev.some((m) => m.id === decryptedMsg.id)) return prev;
          return [...prev, decryptedMsg];
        });

        if (!isSender && document.hidden) {
          setUnreadCount((c) => c + 1);
        }
      } catch (decryptErr) {
        console.warn('Decryption failed for payload (key mismatch or unshared key):', decryptErr);
        setMessages((prev) => {
          if (prev.some((m) => m.id === wireMsg.id)) return prev;
          return [
            ...prev,
            {
              id: wireMsg.id,
              roomId: wireMsg.roomId,
              senderId: wireMsg.senderId,
              senderAlias: wireMsg.senderAlias,
              senderColor: wireMsg.senderColor,
              type: 'system',
              content: '🔒 [Undecryptable message payload]',
              timestamp: wireMsg.timestamp,
              burnTimerSec: 0,
              isSender: false,
              status: 'delivered',
            },
          ];
        });
      }
    },
    [encryptionKey, currentParticipant]
  );

  // Handle incoming server message/event
  const handleEventData = useCallback(
    async (type: string, payload: any) => {
      switch (type) {
        case 'room:joined': {
          if (payload.participants) setParticipants(payload.participants);
          if (payload.settings) setRoomSettings(payload.settings);
          break;
        }

        case 'room:peer-joined': {
          if (payload.participants) setParticipants(payload.participants);
          if (payload.participant && payload.participant.id !== currentParticipant?.id) {
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}-${Math.random()}`,
                roomId: roomId || '',
                senderId: 'system',
                senderAlias: 'System',
                senderColor: '#64748b',
                type: 'system',
                content: `${payload.participant.alias} joined the encrypted channel`,
                timestamp: Date.now(),
                burnTimerSec: 0,
                isSender: false,
                status: 'delivered',
              },
            ]);
          }
          break;
        }

        case 'room:peer-left': {
          if (payload.participants) setParticipants(payload.participants);
          break;
        }

        case 'room:settings-updated': {
          if (payload.settings) {
            setRoomSettings(payload.settings);
          }
          break;
        }

        case 'message:received': {
          await ingestWireMessage(payload);
          break;
        }

        case 'typing:broadcast': {
          const { senderId, senderAlias, isTyping } = payload;
          if (senderId === currentParticipant?.id) return;

          if (isTyping) {
            setTypingUsers((prev) => ({
              ...prev,
              [senderId]: { alias: senderAlias, expiresAt: Date.now() + 3000 },
            }));

            if (typingTimeoutsRef.current[senderId]) {
              clearTimeout(typingTimeoutsRef.current[senderId]);
            }
            typingTimeoutsRef.current[senderId] = setTimeout(() => {
              setTypingUsers((prev) => {
                const next = { ...prev };
                delete next[senderId];
                return next;
              });
            }, 3000);
          } else {
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[senderId];
              return next;
            });
          }
          break;
        }

        case 'message:reaction-added': {
          const { messageId, emoji, senderAlias } = payload;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== messageId) return msg;
              const reactions = { ...(msg.reactions || {}) };
              const users = reactions[emoji] || [];
              if (users.includes(senderAlias)) {
                reactions[emoji] = users.filter((u) => u !== senderAlias);
                if (reactions[emoji].length === 0) delete reactions[emoji];
              } else {
                reactions[emoji] = [...users, senderAlias];
              }
              return { ...msg, reactions };
            })
          );
          break;
        }

        case 'message:deleted': {
          const { messageId } = payload || {};
          if (messageId) {
            expiredMessageIdsRef.current.add(messageId);
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
          }
          break;
        }

        case 'room:destroyed': {
          isDestroyedRef.current = true;
          setMessages([]);
          setParticipants([]);
          if (onRoomDestroyed) {
            onRoomDestroyed(payload.reason || 'Room incinerated.');
          }
          break;
        }

        case 'webrtc:signal-received': {
          if (onWebRTCSignal) {
            onWebRTCSignal(payload.senderId, payload.signalData);
          }
          break;
        }

        default:
          break;
      }
    },
    [currentParticipant, roomId, ingestWireMessage, onRoomDestroyed, onWebRTCSignal]
  );

  // Poll fallback function
  const pollServer = useCallback(async () => {
    if (!roomId || !currentParticipant || isDestroyedRef.current) return;
    try {
      const res = await fetch(
        `/api/room/${encodeURIComponent(roomId)}/poll?since=${lastEventTimestampRef.current}&participantId=${encodeURIComponent(currentParticipant.id)}`
      );
      if (!res.ok) return;
      const data = await res.json();

      if (data.destroyed) {
        isDestroyedRef.current = true;
        setMessages([]);
        setParticipants([]);
        if (onRoomDestroyed) onRoomDestroyed('Room incinerated.');
        return;
      }

      setIsConnected(true);

      if (data.participants) {
        setParticipants(data.participants);
      }
      if (data.settings) {
        setRoomSettings(data.settings);
      }

      if (data.events && Array.isArray(data.events)) {
        for (const evt of data.events) {
          if (evt.timestamp > lastEventTimestampRef.current) {
            lastEventTimestampRef.current = evt.timestamp;
          }
          await handleEventData(evt.type, evt.payload);
        }
      }
    } catch {
      // Background poll failure is normal during sleep/navigation
    }
  }, [roomId, currentParticipant, handleEventData, onRoomDestroyed]);

  // Initial HTTP Join + SSE + Optional WebSocket
  const connect = useCallback(() => {
    if (!roomId || !currentParticipant || isDestroyedRef.current) return;

    // 1. Initial HTTP Join for immediate state sync
    fetch(`/api/room/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant: currentParticipant,
        settings: initialSettings,
      }),
    })
      .then((res) => res.json())
      .then(async (data) => {
        if (data.success) {
          setIsConnected(true);
          if (data.participants) setParticipants(data.participants);
          if (data.settings) setRoomSettings(data.settings);
          if (data.messages && Array.isArray(data.messages)) {
            for (const m of data.messages) {
              await ingestWireMessage(m);
            }
          }
        }
      })
      .catch(() => {});

    // 2. Open Server-Sent Events (SSE) Stream
    if (typeof EventSource !== 'undefined') {
      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        const sse = new EventSource(
          `/api/room/${encodeURIComponent(roomId)}/events?participantId=${encodeURIComponent(currentParticipant.id)}`
        );
        eventSourceRef.current = sse;

        sse.onmessage = async (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type && data.type !== 'ping') {
              await handleEventData(data.type, data.payload);
            }
          } catch {}
        };

        sse.onopen = () => {
          setIsConnected(true);
        };

        sse.onerror = () => {
          // SSE reconnects automatically
        };
      } catch {}
    }

    // 3. Establish WebSocket connection if supported
    if (!wsDisabledRef.current && typeof WebSocket !== 'undefined') {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          ws.send(
            JSON.stringify({
              type: 'room:join',
              payload: {
                roomId,
                participant: currentParticipant,
                settings: initialSettings,
              },
            })
          );
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            await handleEventData(data.type, data.payload);
          } catch {}
        };

        ws.onclose = () => {
          wsDisabledRef.current = true;
        };

        ws.onerror = (e) => {
          wsDisabledRef.current = true;
          if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
          }
          try {
            ws.close();
          } catch {}
        };
      } catch {
        wsDisabledRef.current = true;
      }
    }
  }, [roomId, currentParticipant, initialSettings, ingestWireMessage, handleEventData]);

  // Main lifecycle
  useEffect(() => {
    isDestroyedRef.current = false;
    lastEventTimestampRef.current = Date.now() - 5000;
    connect();

    // Start background sync poll fallback (every 2s)
    pollingIntervalRef.current = setInterval(() => {
      pollServer();
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, [connect, pollServer]);

  // Clean up expired burn messages continuously
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => {
        const expired: string[] = [];
        const remaining = prev.filter((m) => {
          if (m.burnExpiresAt && m.burnExpiresAt <= now) {
            expired.push(m.id);
            return false;
          }
          return true;
        });

        if (expired.length > 0) {
          expired.forEach((id) => {
            expiredMessageIdsRef.current.add(id);
            if (roomId) {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'message:delete',
                    payload: { messageId: id },
                  })
                );
              } else {
                fetch(`/api/room/${encodeURIComponent(roomId)}/message/delete`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messageId: id }),
                }).catch(() => {});
              }
            }
          });
          return remaining;
        }

        return prev;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [roomId]);

  // Send an encrypted message
  const sendMessage = useCallback(
    async (
      content: string,
      type: 'text' | 'image' | 'file' | 'audio' = 'text',
      extraMeta?: {
        fileName?: string;
        fileSize?: number;
        fileMime?: string;
        audioDuration?: number;
        recipientId?: string;
        recipientAlias?: string;
      }
    ) => {
      if (!encryptionKey || !roomId || !currentParticipant) {
        return false;
      }

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payloadToEncrypt = JSON.stringify({
        type,
        content,
        ...extraMeta,
        timestamp: Date.now(),
        reactions: {},
      });

      // Client-side AES-GCM 256-bit encryption
      const encryptedPayload: EncryptedPayload = await encryptData(encryptionKey, payloadToEncrypt);

      const wireMsg: WireMessage = {
        id: messageId,
        roomId,
        senderId: currentParticipant.id,
        senderAlias: currentParticipant.alias,
        senderColor: currentParticipant.avatarColor,
        recipientId: extraMeta?.recipientId,
        recipientAlias: extraMeta?.recipientAlias,
        encrypted: encryptedPayload,
        timestamp: Date.now(),
        burnTimerSec: roomSettings.burnTimerSec,
      };

      // Ingest locally immediately for snappy responsiveness
      await ingestWireMessage(wireMsg);

      // Send via WebSocket if open, else HTTP API
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'message:send',
            payload: { message: wireMsg },
          })
        );
      } else {
        fetch(`/api/room/${encodeURIComponent(roomId)}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: wireMsg }),
        }).catch(() => {});
      }

      return true;
    },
    [encryptionKey, roomId, currentParticipant, roomSettings.burnTimerSec, ingestWireMessage]
  );

  // Send typing indicator
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!currentParticipant || !roomId) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'typing:update',
            payload: {
              senderAlias: currentParticipant.alias,
              isTyping,
            },
          })
        );
      } else {
        fetch(`/api/room/${encodeURIComponent(roomId)}/typing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: currentParticipant.id,
            senderAlias: currentParticipant.alias,
            isTyping,
          }),
        }).catch(() => {});
      }
    },
    [currentParticipant, roomId]
  );

  // Add emoji reaction
  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!currentParticipant || !roomId) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'message:react',
            payload: {
              messageId,
              emoji,
              senderId: currentParticipant.id,
              senderAlias: currentParticipant.alias,
            },
          })
        );
      } else {
        fetch(`/api/room/${encodeURIComponent(roomId)}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            emoji,
            senderId: currentParticipant.id,
            senderAlias: currentParticipant.alias,
          }),
        }).catch(() => {});
      }
    },
    [currentParticipant, roomId]
  );

  // Update room settings (e.g. burn timer change)
  const updateSettings = useCallback(
    (newSettings: Partial<RoomSettings>) => {
      setRoomSettings((prev) => ({ ...prev, ...newSettings }));
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'room:settings-update',
            payload: { settings: newSettings },
          })
        );
      }
    },
    []
  );

  // Send WebRTC signaling message
  const sendWebRTCSignal = useCallback(
    (targetId: string | null, signalData: any) => {
      if (!currentParticipant || !roomId) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'webrtc:signal',
            payload: {
              targetId,
              signalData,
            },
          })
        );
      } else {
        fetch(`/api/room/${encodeURIComponent(roomId)}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId,
            senderId: currentParticipant.id,
            signalData,
          }),
        }).catch(() => {});
      }
    },
    [currentParticipant, roomId]
  );

  // Panic button: incinerate room on server and client
  const burnRoom = useCallback(() => {
    if (!roomId) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:burn',
          payload: {},
        })
      );
    }
    fetch(`/api/room/${encodeURIComponent(roomId)}/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});

    // Instant client wipe
    setMessages([]);
    setParticipants([]);
    isDestroyedRef.current = true;
  }, [roomId]);

  return {
    isConnected,
    participants,
    messages,
    roomSettings,
    typingUsers,
    unreadCount,
    sendMessage,
    deleteMessage,
    sendTyping,
    addReaction,
    updateSettings,
    sendWebRTCSignal,
    burnRoom,
    clearUnread: () => setUnreadCount(0),
  };
}
