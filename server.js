const Fastify = require("fastify");
const fastify = Fastify({ logger: true });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const http = require("http");
const server = http.createServer(fastify.server);
const io = require("socket.io")(server, { cors: { origin: "*" } });

// Parse JSON and handle CORS
fastify.register(require("@fastify/cors"));
fastify.register(require("@fastify/formbody"));

// --- Routes ---

// Get all users
fastify.get("/users", async (req, reply) => {
  const users = await prisma.user.findMany();
  reply.send(users);
});

// Create a new user
fastify.post("/users", async (req, reply) => {
  const { username, email, password } = req.body;
  const user = await prisma.user.create({
    data: { username, email, password },
  });
  reply.send(user);
});

// Get all messages
fastify.get("/messages", async (req, reply) => {
  const messages = await prisma.message.findMany({
    include: { sender: true, receiver: true },
  });
  reply.send(messages);
});

// --- Start server ---
const start = async () => {
  try {
    await fastify.ready();

    server.listen(3000, () => {
      console.log("Server + Socket.IO running at http://localhost:3000");
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// --- Socket.io real-time chat ---
io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  // Listen for sending message
  socket.on("sendMessage", async (data) => {
    // data = { senderId, receiverId, text }

    try {
      // Check if sender exists
      const sender = await prisma.user.findUnique({
        where: { id: data.senderId },
      });
      if (!sender) {
        socket.emit("errorMessage", { message: "Sender does not exist!" });
        return;
      }

      // Check if receiver exists
      const receiver = await prisma.user.findUnique({
        where: { id: data.receiverId },
      });
      if (!receiver) {
        socket.emit("errorMessage", { message: "Receiver does not exist!" });
        return;
      }

      // Create the message
      const message = await prisma.message.create({
        data: {
          text: data.text,
          senderId: data.senderId,
          receiverId: data.receiverId,
        },
        include: { sender: true, receiver: true },
      });

      // Emit to all users
      io.emit("newMessage", message);
    } catch (err) {
      console.error("Error sending message:", err.message);
      socket.emit("errorMessage", { message: "Failed to send message." });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});
