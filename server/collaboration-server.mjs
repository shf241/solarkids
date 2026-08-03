import { createHash } from 'node:crypto';
import { createServer } from 'node:net';

const port = Number(process.env.SOLARKIDS_WS_PORT || 8787);
const peers = new Set();

function encodeFrame(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

function send(peer, message) {
  if (peer.socket.destroyed || !peer.handshaken) return;
  peer.socket.write(encodeFrame(JSON.stringify(message)));
}

function broadcast(room, message) {
  for (const peer of peers) {
    if (peer.room === room) send(peer, message);
  }
}

function roomCount(room) {
  let count = 0;
  for (const peer of peers) if (peer.room === room) count += 1;
  return count;
}

function unmask(payload, mask) {
  const output = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    output[index] = payload[index] ^ mask[index % 4];
  }
  return output;
}

function readFrame(peer) {
  while (peer.buffer.length >= 2) {
    const first = peer.buffer[0];
    const second = peer.buffer[1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (peer.buffer.length < 4) return;
      length = peer.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (peer.buffer.length < 10) return;
      const longLength = Number(peer.buffer.readBigUInt64BE(2));
      if (!Number.isSafeInteger(longLength)) return peer.socket.destroy();
      length = longLength;
      offset = 10;
    }
    const maskLength = masked ? 4 : 0;
    if (peer.buffer.length < offset + maskLength + length) return;
    const mask = masked ? peer.buffer.subarray(offset, offset + 4) : null;
    const payloadStart = offset + maskLength;
    const payload = peer.buffer.subarray(payloadStart, payloadStart + length);
    peer.buffer = peer.buffer.subarray(payloadStart + length);
    const data = mask ? unmask(payload, mask) : payload;
    if (opcode === 0x8) return peer.socket.end();
    if (opcode === 0x9) {
      peer.socket.write(Buffer.from([0x8a, data.length]));
      continue;
    }
    if (opcode !== 0x1) continue;
    try {
      handleMessage(peer, JSON.parse(data.toString('utf8')));
    } catch {
      // Ignore malformed client messages so one peer cannot break the room.
    }
  }
}

function handleMessage(peer, message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'join') {
    peer.room = String(message.room || 'STAR-ROOM');
    peer.user = String(message.user || '小探险家').slice(0, 18);
    broadcast(peer.room, { type: 'presence', room: peer.room, peerCount: roomCount(peer.room) });
    return;
  }
  if (!peer.room || message.room !== peer.room) return;
  if (message.type === 'activity') {
    broadcast(peer.room, {
      type: 'activity',
      clientId: String(message.clientId || ''),
      room: peer.room,
      user: peer.user,
      kind: String(message.kind || 'learning'),
      label: String(message.label || '').slice(0, 80),
      at: Number(message.at) || Date.now(),
    });
  }
}

function acceptHandshake(peer, request) {
  const match = request.match(/Sec-WebSocket-Key:\s*(.+)\r?\n/i);
  if (!match) return peer.socket.destroy();
  const accept = createHash('sha1')
    .update(`${match[1].trim()}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  peer.socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  peer.handshaken = true;
}

const server = createServer(socket => {
  const peer = { socket, buffer: Buffer.alloc(0), handshaken: false, room: '', user: '' };
  peers.add(peer);
  socket.on('data', chunk => {
    peer.buffer = Buffer.concat([peer.buffer, chunk]);
    if (!peer.handshaken) {
      const headerEnd = peer.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = peer.buffer.subarray(0, headerEnd + 4).toString('utf8');
      peer.buffer = peer.buffer.subarray(headerEnd + 4);
      acceptHandshake(peer, header);
    }
    if (peer.handshaken) readFrame(peer);
  });
  socket.on('close', () => {
    const room = peer.room;
    peers.delete(peer);
    if (room) broadcast(room, { type: 'presence', room, peerCount: roomCount(room) });
  });
  socket.on('error', () => socket.destroy());
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SolarKids learning room WebSocket listening on ws://127.0.0.1:${port}`);
});
