// server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { readDB, writeDB } = require("./datastore");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ["http://localhost:3000"], methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// Helpers
function findUserByUsername(username) {
  const db = readDB("users");
  return db.find((u) => u.username === username);
}
function getUserById(id) {
  const db = readDB("users");
  return db.find((u) => u.id === id);
}
function saveSession(token, userId) {
  const db = readDB("sessions");
  db.sessions = db || [];
  db.sessions.push({
    token,
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  });
  writeDB(db, "sessions");
}
function validateToken(token) {
  const db = readDB("sessions");
  const s = (db || []).find((x) => x.token === token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) return null;
  return getUserById(s.userId);
}

// Auth endpoints (very simple, not production-ready)
app.post("/api/register", (req, res) => {
  const { username, password, firstName } = req.body;
  if (!username || !password || !firstName)
    return res.status(400).json({ error: "Missing fields" });
  const db = readDB("users");
  if ((db || []).some((u) => u.username === username)) {
    return res.status(409).json({ error: "Username taken" });
  }
  const user = { id: `u_${uuidv4()}`, username, password, firstName };
  // db = db || [];
  db.push(user);
  writeDB(db, "users");
  res.json({
    ok: true,
    user: { id: user.id, username: user.username, firstName: user.firstName },
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = findUserByUsername(username);
  if (!user || user.password !== password)
    return res.status(401).json({ error: "Invalid" });
  const token = uuidv4();
  saveSession(token, user.id);
  res.json({
    ok: true,
    token,
    user: { id: user.id, username: user.username, firstName: user.firstName },
  });
});

// Get chat history for a room
app.get("/api/rooms/:roomId", (req, res) => {
  const db = readDB("chats");
  const room = (db || []).find((r) => r.id === req.params.roomId);
  res.json({ ok: true, room: room || { id: req.params.roomId, messages: [] } });
});

// Basic middleware to decode token from Authorization header (Bearer token)
app.use((req, res, next) => {
  const auth = req.header("authorization");
  if (!auth) return next();
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    const user = validateToken(parts[1]);
    if (user) req.user = user;
  }
  next();
});

// Socket.IO
io.use((socket, next) => {
  // We'll accept token via query param token for simplicity
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(); // allow unauth but mark as guest
  const user = validateToken(token);
  if (user) {
    socket.user = user;
  }
  next();
});

io.on("connection", (socket) => {
  console.log(
    "socket connected",
    socket.id,
    socket.user ? socket.user.username : "guest"
  );

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    // optionally emit history upon join
    const db = readDB("chats");
    const room = (db || []).find((r) => r.id === roomId) || {
      id: roomId,
      messages: [],
    };
    socket.emit("history", room.messages);
  });

  socket.on("message", ({ roomId, text }) => {
    if (!text) return;
    const user = socket.user || {
      id: "guest",
      username: "Guest",
      firstName: "guest",
    };
    const msg = {
      id: `m_${uuidv4()}`,
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
      text,
      ts: Date.now(),
    };

    // persist to JSON
    const db = readDB("chats");
    let room = db.find((r) => r.id === roomId);
    if (!room) {
      room = { id: roomId, messages: [] };
      db.push(room);
    }
    room.messages.push(msg);
    writeDB(db, "chats");

    // broadcast
    io.to(roomId).emit("message", msg);
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
