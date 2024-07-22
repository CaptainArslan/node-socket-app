const express = require("express");
const cors = require("cors"); // Import the cors middleware
const http = require("http");
const socketIo = require("socket.io");

const app = express();

// Use CORS middleware
app.use(
  cors({
    origin: "*", // Allow all origins
    allowedHeaders: ["Content-Type"],
  })
);

app.get("/", (req, res) => {
  res.send("Server is running");
});

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins
  },
});

let userCount = 0;

io.on("connection", (socket) => {
  userCount++;
  console.log(`${userCount} User connected : ` + socket.id);

  socket.on("message", (msg) => {
    console.log("New messages received on server: " + msg);
    io.emit("message", msg);
  });

  socket.on("location", (location) => {
    console.log("New location received from client: " + location);
    io.emit("location", {
      id: socket.id,
      ...location,
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    userCount--;
    io.emit("user-disconnected", socket.id);
  });
});

// Listen on a dynamic port
server.listen(0, () => {
  console.log(`Server listening at port ${server.address().port}`);
});
