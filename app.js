const express = require("express");
const cors = require("cors"); // Import the cors middleware
const http = require("http");
const socketIo = require("socket.io");

const app = express();

// Optionally, you can set CORS options for Express if needed for other routes
app.use(cors());

app.get("/", (req, res) => {
  res.send("Server is running");
});

const server = http.createServer(app);

const port = process.env.PORT || 3000;
var userCount = 0;

server.listen(port, () => {
  console.log("Server listening at port %d", port);
});

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: false,
  },
  allowEIO3: true,
});

var managers = {};
var clients = {};
var locations = {};
var drivers = {};

io.on("connection", (socket) => {
  userCount++;
  console.log(`${userCount} client connected: ${socket.id}`);

  socket.emit("user-connected", socket.id);

  // Handle the "manager-connected" event
  socket.on("manager-connected", (manager) => {
    const managerId = manager.id;

    // Check if the managerId already exists in the managers object
    if (!managers[managerId]) {
      // Add a new entry for the managerId
      managers[managerId] = {
        socketId: socket.id, // Store the socket ID
        manager: manager, // Store the manager object
      };
      console.log("Managers: ", managers);
      socket.emit("manager-connected", manager);
    } else {
      // Optionally, update the existing manager's information if needed
      console.log(`Manager with ID ${managerId} already exists.`);
    }
  });

  // Handle the "driver-connected" event
  socket.on("driver-connected", (driver) => {
    const driverId = driver.id;

    // Check if the driverId already exists in the drivers object
    if (!drivers[driverId]) {
      console.log(`New driver connected:`, driver);
      // Add a new entry for the driverId
      drivers[driverId] = {
        socketId: socket.id, // Store the socket ID
        driver: driver, // Store the driver object
      };
      console.log("driver added:", drivers);
      socket.emit("driver-connected", driver);
    } else {
      // Optionally, update the existing driver's information if needed
      console.log(`driver with ID ${driverId} already exists.`);
    }
  });

  // Handle the "client-connected" event
  socket.on("client-connected", (client) => {
    const clientId = client.id;

    // Check if the clientId already exists in the clients object
    if (!clients[clientId]) {
      // Add a new entry for the clientId
      clients[clientId] = {
        socketId: socket.id, // Store the socket ID
        client: client, // Store the client object
      };
      console.log("Clients: ", clients);
      socket.emit("client-connected", client);
    } else {
      // Optionally, update the existing client's information if needed
      console.log(`Client with ID ${clientId} already exists.`);
    }
  });

  // Handle the "location" event
  socket.on("location", (location) => {
    console.log(`New location from ${socket.id}:`, location);
    io.emit("location", {
      id: socket.id,
      ...location,
    });
  });

  // Handle the "request-ride" event
  socket.on("disconnect", () => {
    console.log(`User ${socket.id} disconnected`);
    io.emit("user-disconnected", socket.id);

    // Optionally handle cleanup here, e.g., remove user from arrays
  });
});

// Add error handling for server and socket
server.on("error", (err) => {
  console.error("Server error:", err);
});

io.on("error", (err) => {
  console.error("Socket.IO error:", err);
});
