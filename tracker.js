import { Server } from 'bittorrent-tracker';

const port = 8000;

const server = new Server({
  udp: false, // Disable UDP for browser compatibility
  http: false, // Disable HTTP 
  ws: true, // Enable WebSocket only
  stats: true,
  trustProxy: false,
  filter: function (infoHash, params, cb) {
    // Log every announce/scrape
    console.log(`📡 [FILTER] InfoHash: ${infoHash}, Params:`, {
      type: params.type,
      peerId: params.peer_id?.toString('hex').substring(0, 10) + '...',
      left: params.left,
      event: params.event,
      numwant: params.numwant,
      port: params.port
    });
    cb(null); // Allow all torrents
  }
});

// Track all peers by infoHash
const peerMap = new Map();

server.on('error', function (err) {
  console.error('❌ [TRACKER ERROR]', err.message);
});

server.on('warning', function (warn) {
  console.warn('⚠️ [TRACKER WARNING]', warn.message);
});

server.on('listening', function () {
  console.log('✅ [TRACKER] WebSocket tracker listening on ws://localhost:' + port);
  console.log('📊 [TRACKER] Stats URL: http://localhost:' + port + '/stats');
});

// WebSocket specific events
server.on('websocket-connection', function (ws, req) {
  const ip = req.socket.remoteAddress;
  console.log(`🔌 [WS CONNECTED] New WebSocket connection from ${ip}`);
  
  ws.on('close', () => {
    console.log(`🔴 [WS CLOSED] WebSocket disconnected from ${ip}`);
  });
  
  ws.on('error', (err) => {
    console.error(`❌ [WS ERROR] WebSocket error from ${ip}:`, err.message);
  });
});

// Main tracking events
server.on('start', function (peer) {
  const peerId = peer.peer_id?.toString('hex').substring(0, 10) + '...';
  const infoHash = peer.info_hash?.toString('hex');
  
  console.log(`🚀 [START] Peer started:`, {
    infoHash: infoHash,
    peerId: peerId,
    ip: peer.ip,
    port: peer.port,
    left: peer.left
  });
  
  // Track this peer
  if (!peerMap.has(infoHash)) {
    peerMap.set(infoHash, new Set());
  }
  peerMap.get(infoHash).add(peerId);
  
  console.log(`👥 [PEERS] Total peers for ${infoHash?.substring(0, 10)}...: ${peerMap.get(infoHash).size}`);
});

server.on('announce', function (peer) {
  const peerId = peer.peer_id?.toString('hex').substring(0, 10) + '...';
  const infoHash = peer.info_hash?.toString('hex');
  
  console.log(`📢 [ANNOUNCE] Peer announced:`, {
    infoHash: infoHash?.substring(0, 20) + '...',
    peerId: peerId,
    event: peer.event || 'update',
    downloaded: peer.downloaded,
    uploaded: peer.uploaded,
    left: peer.left,
    numwant: peer.numwant
  });
  
  // Show current swarm
  const swarm = server.torrents[infoHash];
  if (swarm) {
    console.log(`🌐 [SWARM] InfoHash ${infoHash?.substring(0, 10)}... has:`, {
      complete: swarm.complete,
      incomplete: swarm.incomplete,
      peers: swarm.peers.length
    });
    
    // List all peers in swarm
    if (swarm.peers.length > 0) {
      console.log(`📋 [PEER LIST] for ${infoHash?.substring(0, 10)}...:`);
      swarm.peers.forEach((p, i) => {
        console.log(`  ${i + 1}. Peer ${p.peer_id?.toString('hex').substring(0, 10)}... - ${p.ip}:${p.port} (${p.type})`);
      });
    }
  }
});

server.on('complete', function (peer) {
  const peerId = peer.peer_id?.toString('hex').substring(0, 10) + '...';
  const infoHash = peer.info_hash?.toString('hex');
  
  console.log(`✅ [COMPLETE] Peer completed download:`, {
    infoHash: infoHash?.substring(0, 20) + '...',
    peerId: peerId
  });
});

server.on('stop', function (peer) {
  const peerId = peer.peer_id?.toString('hex').substring(0, 10) + '...';
  const infoHash = peer.info_hash?.toString('hex');
  
  console.log(`🛑 [STOP] Peer stopped:`, {
    infoHash: infoHash?.substring(0, 20) + '...',
    peerId: peerId
  });
  
  // Remove from tracking
  if (peerMap.has(infoHash)) {
    peerMap.get(infoHash).delete(peerId);
    if (peerMap.get(infoHash).size === 0) {
      peerMap.delete(infoHash);
    }
  }
});

server.on('scrape', function (peer) {
  const infoHash = peer.info_hash?.toString('hex');
  console.log(`🔍 [SCRAPE] Scrape request for ${infoHash?.substring(0, 20)}...`);
});

// Periodic status report
setInterval(() => {
  console.log('\n📊 [STATUS REPORT]');
  console.log(`Total torrents tracked: ${Object.keys(server.torrents).length}`);
  
  for (const [infoHash, swarm] of Object.entries(server.torrents)) {
    console.log(`  📦 ${infoHash.substring(0, 10)}... - Seeders: ${swarm.complete}, Leechers: ${swarm.incomplete}, Total Peers: ${swarm.peers.length}`);
  }
  
  if (Object.keys(server.torrents).length === 0) {
    console.log('  (No active torrents)');
  }
  console.log('');
}, 10000); // Every 10 seconds

// Start the server
server.listen(port);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 [SHUTDOWN] Shutting down tracker...');
  server.close(() => {
    console.log('✅ [SHUTDOWN] Tracker closed');
    process.exit(0);
  });
});
