import http from "http";
import { Server } from "socket.io";
import app from "../app.js";

const httpServer = http.createServer(app); 

const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN, credentials: true },
});

const userSocketMap = new Map();

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap.set(userId, socket.id);
  socket.on("disconnect", () => userSocketMap.delete(userId));
});

export { io, userSocketMap, httpServer };