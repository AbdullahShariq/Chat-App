const Fastify = require("fastify");
const fastify = Fastify({ logger: true });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const http = require("http");
// Problem Solving Line code 
const server = http.createServer((req, res) => {
  fastify.routing(req, res);
});
const io = require("socket.io")(server, { cors: { origin: "*" } });

// Parse JSON and handle CORS
// This tells the server to accept requests from ANYWHERE
fastify.register(require("@fastify/cors"), { 
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"], // Added OPTIONS for the browser's secret check
  allowedHeaders: ["Content-Type"]
});
fastify.register(require("@fastify/formbody"));


// Routes

// Get all users
fastify.get("/users", async (req, reply) => {
  const users = await prisma.user.findMany();
  reply.send(users);
});

// Create a new user (with error handling)
fastify.post("/users", async (req, reply) => {
  try {
    // THIS LINE IS THE KEY:
    console.log("Incoming Registration Data:", req.body); 

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      console.log("Validation failed: Missing fields");
      return reply.code(400).send({ message: "Missing required fields" });
    }

    const user = await prisma.user.create({
      data: { username, email, password },
    });
    
    console.log("User created in DB:", user.username);
    reply.send(user);
  } catch (err) {
    console.error("Prisma Error:", err);
    if (err.code === 'P2002') {
      return reply.code(409).send({ message: "Username or Email already exists" });
    }
    reply.code(500).send({ message: "Internal Server Error" });
  }
});

// Get all messages
fastify.get("/messages", async (req, reply) => {
  const messages = await prisma.message.findMany({
    include: { sender: true, receiver: true },
  });
  reply.send(messages);
});

// Start server

//Running Socket.io 

// const start = async () => {
//   try {
//     await fastify.ready();
//     // Use 0.0.0.0 to allow Docker, but ensure your terminal says it's alive
//     server.listen(3000, "0.0.0.0", (err, address) => {
//       if (err) {
//         console.error(err);
//         process.exit(1);
//       }
//       console.log(` Server is definitely running at: ${address}`);
//     });
//   } catch (err) {
//     fastify.log.error(err);
//     process.exit(1);
//   }
// };

//Running Fastify Routes

// const start = async () => {
//   try {
//     await fastify.ready();
//     // Start listening on the FASTIFY instance directly to ensure routes are active
//     await fastify.listen({ port: 3000, host: "0.0.0.0" }); 
    
//     // Then attach your Socket.io to that same port
//     console.log(" Server is now listening on Port 3000");
//   } catch (err) {
//     fastify.log.error(err);
//     process.exit(1);
//   }
// };

// start();

// Start Server

const start = async () => {
  try {
    // 1. Important: Wait for Fastify to prepare all its routes (/users, /messages)
    await fastify.ready();
    
    // 2. Start the SHARED server (the 'server' variable you created at the top)
    // This 'server' contains both Fastify and Socket.io
    server.listen(3000, "0.0.0.0", () => {
      console.log("SUCCESS! Everything is running on Port 3000");
    //   console.log("Routes like /users are active");
    //   console.log("Socket.io is active");
    });

  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

start();



//Existing imports and routes

//     io.on("connection", (socket) => {
//     console.log("User connected: " + socket.id);

//     socket.on("sendMessage", async (data) => {
//         try {
//         // Find sender and receiver by username instead of ID
//         const [sender, receiver] = await Promise.all([
//             prisma.user.findUnique({ where: { username: data.senderName } }),
//             prisma.user.findUnique({ where: { username: data.receiverName } })
//         ]);

//         if (!sender || !receiver) {
//             socket.emit("errorMessage", { message: "One or both users not found!" });
//             return;
//         }

//         const message = await prisma.message.create({
//             data: {
//             text: data.text,
//             senderId: sender.id,   // Use the IDs found from the database
//             receiverId: receiver.id,
//             },
//             include: { sender: true, receiver: true },
//         });

//         io.emit("newMessage", message);
//         } catch (err) {
//         console.error(err);
//         socket.emit("errorMessage", { message: "Server error while sending." });
//         }
//     });

//     socket.on("disconnect", () => {
//     console.log("User disconnected: " + socket.id);

//     });

// });

// MAIN LOGIC (with Rooms)
io.on("connection", (socket) => {
    console.log("User connected: " + socket.id);

    // [ROOMS] - User enters a room
    socket.on("joinRoom", (roomName) => {
        socket.join(roomName);
        console.log(`User ${socket.id} joined room: ${roomName}`);
        
        // [BROADCAST] - Send to everyone in room EXCEPT the sender
        socket.to(roomName).emit("newMessage", {
            sender: { username: "System" },
            text: `Someone new just joined the ${roomName} chat!`
        });
    });

    // [ROOMS] - Sending to a specific room
    socket.on("sendToRoom", (data) => {
        const { roomName, senderName, text } = data;
        // io.to() sends to EVERYONE in the room including the sender
        io.to(roomName).emit("newMessage", {
            sender: { username: senderName },
            text: `[ROOM: ${roomName}] ${text}`
        });
    });

    // [GLOBAL] - Standard Private/Global Message
    socket.on("sendMessage", async (data) => {
        try {
            const [sender, receiver] = await Promise.all([
                prisma.user.findUnique({ where: { username: data.senderName } }),
                prisma.user.findUnique({ where: { username: data.receiverName } })
            ]);

            if (!sender || !receiver) {
                socket.emit("errorMessage", { message: "User not found!" });
                return;
            }

            const message = await prisma.message.create({
                data: { text: data.text, senderId: sender.id, receiverId: receiver.id },
                include: { sender: true, receiver: true },
            });

            // io.emit sends to everyone connected to the server
            io.emit("newMessage", message);

            // [BROADCAST] - Send a generic alert to everyone else
            socket.broadcast.emit("notification", `New activity in the global chat!`);

        } catch (err) {
            console.error(err);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected: " + socket.id);
    });
});