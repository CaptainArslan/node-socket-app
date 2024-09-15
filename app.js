const express = require("express");
const cors = require("cors"); // Import the cors middleware
const http = require("http");
const socketIo = require("socket.io");

const app = express();

// Use CORS middleware
app.use(cors());

// Optionally, you can set CORS options
app.use(
  cors({
    origin: "*",
    allowedHeaders: ["Content-Type"],
  })
);

app.get("/", (req, res) => {
  res.send("Server is running");
});

const server = require("http").createServer(app);

const port = process.env.PORT || 3000;
var userCount = 0;

server.listen(port, () => {
  console.log("Server listening at port %d", port);
});

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["*"],
    transports: ["websocket", "polling"],
    credentials: false,
  },
  allowEIO3: true,
});

io.on("connection", (socket) => {
  userCount++;
  console.log(`${userCount} g client : ` + socket.id);

  socket.emit("client-connected", socket.id);

  socket.on("location", (location) => {
    console.log("New location :", location);
    io.emit("location", {
      id: socket.id,
      ...location,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    io.emit("user-disconnected", socket.id);
  });
});
