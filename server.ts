import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface ParticipantInfo {
  id: string;
  alias: string;
  avatarColor: string;
  avatarIcon: string;
  joinedAt: number;
  isHost?: boolean;
}

interface RoomEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  senderId?: string;
}

interface EphemeralRoom {
  id: string;
  createdAt: number;
  participants: Map<string, { ws?: WebSocket; info: ParticipantInfo; lastSeen: number }>;
  settings: {
    burnTimerSec: number;
    isPrivate: boolean;
    maxParticipants: number;
    allowVoiceNotes: boolean;
    allowVoiceCall: boolean;
  };
  messages: any[]; // volatile in-memory buffer, strictly 0 disk/db
  events: RoomEvent[]; // volatile events for sync/poll fallback
  cleanupTimeout?: NodeJS.Timeout;
}

// In-memory zero-persistence room storage. Wiped when empty or burned.
const activeRooms = new Map<string, EphemeralRoom>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // Explicit static routes for PWA manifest, service worker, and icons
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));
  app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(publicDir, 'manifest.json'));
  });
  app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(publicDir, 'sw.js'));
  });

  // API endpoints FIRST
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeRooms: activeRooms.size,
      zeroStorage: true,
      e2eeRelay: true,
      timestamp: Date.now(),
    });
  });

  app.get('/api/room/:roomId/exists', (req, res) => {
    const roomId = req.params.roomId;
    const room = activeRooms.get(roomId);
    if (!room) {
      return res.json({ exists: false, participantCount: 0 });
    }
    return res.json({
      exists: true,
      participantCount: room.participants.size,
      settings: room.settings,
    });
  });

  // HTTP Fallback Endpoints for 100% resilient messaging in all network conditions
  app.post('/api/room/:roomId/join', (req, res) => {
    const roomId = req.params.roomId;
    const { participant, settings } = req.body;
    if (!roomId || !participant) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    let room = activeRooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        createdAt: Date.now(),
        participants: new Map(),
        messages: [],
        events: [],
        settings: settings || {
          burnTimerSec: 0,
          isPrivate: false,
          maxParticipants: 10,
          allowVoiceNotes: true,
          allowVoiceCall: true,
        },
      };
      activeRooms.set(roomId, room);
    } else if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
      room.cleanupTimeout = undefined;
    }

    room.participants.set(participant.id, {
      info: participant,
      lastSeen: Date.now(),
    });

    const participantList = Array.from(room.participants.values()).map((p) => p.info);
    
    // Broadcast peer joined
    broadcastToRoom(roomId, participant.id, {
      type: 'room:peer-joined',
      payload: {
        participant,
        participants: participantList,
      },
    });

    res.json({
      success: true,
      roomId,
      participants: participantList,
      settings: room.settings,
      messages: room.messages.slice(-50),
    });
  });

  app.post('/api/room/:roomId/message', (req, res) => {
    const roomId = req.params.roomId;
    const { message } = req.body;
    const room = activeRooms.get(roomId);
    if (!room || !message) {
      return res.status(404).json({ error: 'Room not found or invalid message' });
    }

    // Add to volatile memory buffer (capped at 50)
    room.messages.push(message);
    if (room.messages.length > 50) {
      room.messages.shift();
    }

    const event: RoomEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'message:received',
      payload: message,
      timestamp: Date.now(),
      senderId: message.senderId,
    };
    room.events.push(event);
    if (room.events.length > 100) room.events.shift();

    broadcastToRoom(roomId, null, {
      type: 'message:received',
      payload: message,
    });

    res.json({ success: true, messageId: message.id });
  });

  app.post('/api/room/:roomId/message/delete', (req, res) => {
    const roomId = req.params.roomId;
    const { messageId } = req.body;
    const room = activeRooms.get(roomId);
    if (!room || !messageId) {
      return res.status(404).json({ error: 'Room or message not found' });
    }

    // Remove from in-memory messages buffer
    room.messages = room.messages.filter((m) => m.id !== messageId);

    const event: RoomEvent = {
      id: `evt-del-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'message:deleted',
      payload: { messageId },
      timestamp: Date.now(),
    };
    room.events.push(event);
    if (room.events.length > 100) room.events.shift();

    broadcastToRoom(roomId, null, {
      type: 'message:deleted',
      payload: { messageId },
    });

    res.json({ success: true, messageId });
  });

  app.get('/api/room/:roomId/poll', (req, res) => {
    const roomId = req.params.roomId;
    const since = parseInt(req.query.since as string, 10) || 0;
    const participantId = req.query.participantId as string;

    const room = activeRooms.get(roomId);
    if (!room) {
      return res.json({ destroyed: true });
    }

    if (participantId && room.participants.has(participantId)) {
      const p = room.participants.get(participantId)!;
      p.lastSeen = Date.now();
    }

    const newEvents = room.events.filter((e) => e.timestamp > since);
    const participantList = Array.from(room.participants.values()).map((p) => p.info);

    res.json({
      events: newEvents,
      participants: participantList,
      settings: room.settings,
      timestamp: Date.now(),
    });
  });

  app.post('/api/room/:roomId/typing', (req, res) => {
    const roomId = req.params.roomId;
    const { senderId, senderAlias, isTyping } = req.body;
    const room = activeRooms.get(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const event: RoomEvent = {
      id: `evt-${Date.now()}-${Math.random()}`,
      type: 'typing:broadcast',
      payload: { roomId, senderId, senderAlias, isTyping },
      timestamp: Date.now(),
      senderId,
    };
    room.events.push(event);
    if (room.events.length > 100) room.events.shift();

    broadcastToRoom(roomId, senderId, {
      type: 'typing:broadcast',
      payload: { roomId, senderId, senderAlias, isTyping },
    });

    res.json({ success: true });
  });

  app.post('/api/room/:roomId/burn', (req, res) => {
    const roomId = req.params.roomId;
    incinerateRoom(roomId, 'Emergency Burn Protocol Activated by Room Host. All messages and encryption keys deleted.');
    res.json({ success: true, burned: true });
  });

  const server = http.createServer(app);

  // WebSocket Server with robust upgrade handling
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;
      if (pathname === '/ws' || pathname.startsWith('/ws')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let currentParticipantId: string | null = null;
    let isAlive = true;

    ws.on('pong', () => {
      isAlive = true;
    });

    ws.on('message', (rawMessage: string) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        const { type, payload } = data;

        switch (type) {
          case 'room:join': {
            const { roomId, participant, settings } = payload;
            if (!roomId || !participant) return;

            let room = activeRooms.get(roomId);
            if (!room) {
              room = {
                id: roomId,
                createdAt: Date.now(),
                participants: new Map(),
                messages: [],
                events: [],
                settings: settings || {
                  burnTimerSec: 0,
                  isPrivate: false,
                  maxParticipants: 10,
                  allowVoiceNotes: true,
                  allowVoiceCall: true,
                },
              };
              activeRooms.set(roomId, room);
            } else if (room.cleanupTimeout) {
              clearTimeout(room.cleanupTimeout);
              room.cleanupTimeout = undefined;
            }

            currentRoomId = roomId;
            currentParticipantId = participant.id;

            // Register socket
            room.participants.set(participant.id, { ws, info: participant, lastSeen: Date.now() });

            // Send room joined confirmation with participant list
            const participantList = Array.from(room.participants.values()).map((p) => p.info);
            
            ws.send(JSON.stringify({
              type: 'room:joined',
              payload: {
                roomId,
                participants: participantList,
                settings: room.settings,
              },
            }));

            // Broadcast to other participants that a new peer joined
            broadcastToRoom(roomId, participant.id, {
              type: 'room:peer-joined',
              payload: {
                participant,
                participants: participantList,
              },
            });
            break;
          }

          case 'room:settings-update': {
            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (room && payload.settings) {
              room.settings = { ...room.settings, ...payload.settings };
              broadcastToRoom(currentRoomId, null, {
                type: 'room:settings-updated',
                payload: { settings: room.settings },
              });
            }
            break;
          }

          case 'message:send': {
            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (room && payload?.message) {
              room.messages.push(payload.message);
              if (room.messages.length > 50) room.messages.shift();
              
              const event: RoomEvent = {
                id: `evt-${Date.now()}-${Math.random()}`,
                type: 'message:received',
                payload: payload.message,
                timestamp: Date.now(),
                senderId: payload.message.senderId,
              };
              room.events.push(event);
              if (room.events.length > 100) room.events.shift();
            }

            // Zero-knowledge blind relay: Forward encrypted payload directly to all room members
            broadcastToRoom(currentRoomId, null, {
              type: 'message:received',
              payload: payload.message,
            });
            break;
          }

          case 'typing:update': {
            if (!currentRoomId || !currentParticipantId) return;
            const room = activeRooms.get(currentRoomId);
            if (room) {
              const event: RoomEvent = {
                id: `evt-${Date.now()}-${Math.random()}`,
                type: 'typing:broadcast',
                payload: {
                  roomId: currentRoomId,
                  senderId: currentParticipantId,
                  senderAlias: payload.senderAlias,
                  isTyping: payload.isTyping,
                },
                timestamp: Date.now(),
                senderId: currentParticipantId,
              };
              room.events.push(event);
              if (room.events.length > 100) room.events.shift();
            }

            broadcastToRoom(currentRoomId, currentParticipantId, {
              type: 'typing:broadcast',
              payload: {
                roomId: currentRoomId,
                senderId: currentParticipantId,
                senderAlias: payload.senderAlias,
                isTyping: payload.isTyping,
              },
            });
            break;
          }

          case 'message:delete': {
            if (!currentRoomId || !payload?.messageId) return;
            const room = activeRooms.get(currentRoomId);
            if (room) {
              room.messages = room.messages.filter((m) => m.id !== payload.messageId);
              const event: RoomEvent = {
                id: `evt-del-${Date.now()}-${Math.random()}`,
                type: 'message:deleted',
                payload: { messageId: payload.messageId },
                timestamp: Date.now(),
              };
              room.events.push(event);
              if (room.events.length > 100) room.events.shift();
            }

            broadcastToRoom(currentRoomId, null, {
              type: 'message:deleted',
              payload: { messageId: payload.messageId },
            });
            break;
          }

          case 'message:react': {
            if (!currentRoomId) return;
            const room = activeRooms.get(currentRoomId);
            if (room) {
              const event: RoomEvent = {
                id: `evt-${Date.now()}-${Math.random()}`,
                type: 'message:reaction-added',
                payload,
                timestamp: Date.now(),
              };
              room.events.push(event);
              if (room.events.length > 100) room.events.shift();
            }

            broadcastToRoom(currentRoomId, null, {
              type: 'message:reaction-added',
              payload,
            });
            break;
          }

          case 'message:read': {
            if (!currentRoomId || !currentParticipantId) return;
            broadcastToRoom(currentRoomId, currentParticipantId, {
              type: 'message:read-receipt',
              payload: {
                messageIds: payload.messageIds,
                readerId: currentParticipantId,
              },
            });
            break;
          }

          case 'room:burn': {
            // Panic Button / Burn Room triggered: instantly disconnect all users and purge room
            if (!currentRoomId) return;
            incinerateRoom(currentRoomId, 'Emergency Burn Protocol Activated by Room Host. All messages and encryption keys deleted.');
            break;
          }

          case 'webrtc:signal': {
            // P2P WebRTC audio call signaling relay
            if (!currentRoomId) return;
            const { targetId, signalData } = payload;
            if (targetId) {
              sendToPeer(currentRoomId, targetId, {
                type: 'webrtc:signal-received',
                payload: {
                  senderId: currentParticipantId,
                  signalData,
                },
              });
            } else {
              broadcastToRoom(currentRoomId, currentParticipantId, {
                type: 'webrtc:signal-received',
                payload: {
                  senderId: currentParticipantId,
                  signalData,
                },
              });
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Error processing WS message:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomId && currentParticipantId) {
        handleParticipantLeave(currentRoomId, currentParticipantId);
      }
    });

    ws.on('error', () => {
      // Handled silently
    });
  });

  // Heartbeat interval to clean up dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((wsClient) => {
      // @ts-expect-error custom ws ping state
      if (wsClient.isAlive === false) {
        return wsClient.terminate();
      }
      // @ts-expect-error custom ws ping state
      wsClient.isAlive = false;
      try {
        wsClient.ping();
      } catch {}
    });
  }, 25000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  function incinerateRoom(roomId: string, reason?: string) {
    const room = activeRooms.get(roomId);
    if (!room) return;

    const payload = {
      reason: reason || 'Emergency Burn Protocol Activated by Room Host. All messages and encryption keys deleted.',
      timestamp: Date.now(),
    };

    // 1. Broadcast immediate destruction packet
    broadcastToRoom(roomId, null, {
      type: 'room:destroyed',
      payload,
    });

    // 2. Add to event queue for any active polling or SSE clients
    room.events.push({
      id: `evt-burn-${Date.now()}`,
      type: 'room:destroyed',
      payload,
      timestamp: Date.now(),
    });

    // 3. Close all client WebSocket connections immediately
    room.participants.forEach(({ ws: clientWs }) => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.close(1000, 'Room destroyed');
        } catch {}
      }
    });

    // 4. Zero memory wipe
    room.participants.clear();
    room.messages = [];
    room.events = [];
    if (room.cleanupTimeout) clearTimeout(room.cleanupTimeout);
    activeRooms.delete(roomId);
    console.log(`[vroom] Room ${roomId} incinerated. Zero trace remains.`);
  }

  function broadcastToRoom(roomId: string, excludeSenderId: string | null, data: object) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    const json = JSON.stringify(data);
    room.participants.forEach(({ ws }, pid) => {
      if (excludeSenderId && pid === excludeSenderId) return;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(json);
        } catch {}
      }
    });
  }

  function sendToPeer(roomId: string, targetId: string, data: object) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    const target = room.participants.get(targetId);
    if (target && target.ws && target.ws.readyState === WebSocket.OPEN) {
      try {
        target.ws.send(JSON.stringify(data));
      } catch {}
    }
  }

  function handleParticipantLeave(roomId: string, participantId: string) {
    const room = activeRooms.get(roomId);
    if (!room) return;

    room.participants.delete(participantId);

    if (room.participants.size === 0) {
      // Last participant left: wipe room after 20-second grace period in case of accidental refresh
      room.cleanupTimeout = setTimeout(() => {
        if (room.participants.size === 0) {
          activeRooms.delete(roomId);
          console.log(`[vroom] Room ${roomId} wiped from memory (zero trace).`);
        }
      }, 20000);
    } else {
      // Notify remaining members
      const participantList = Array.from(room.participants.values()).map((p) => p.info);
      broadcastToRoom(roomId, null, {
        type: 'room:peer-left',
        payload: {
          participantId,
          participants: participantList,
        },
      });
    }
  }

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[vroom] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
