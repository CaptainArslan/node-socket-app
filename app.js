const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");

const app = express();

// Set CORS options if needed for other routes
app.use(cors());

app.get("/", (req, res) => {
  res.send("Server is running");
});

const server = http.createServer(app);

const port = process.env.PORT || 3000;
let userCount = 0;

server.listen(port, () => {
  console.log("Server listening at port %d", port);
});

const io = socketIo(server, {
  cors: {
    origin: "*", // You might want to restrict this to your domain
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: false,
  },
  allowEIO3: true,
});

let managers = {};
let trips = {};
let admins = {};
let adminTrips = {};
let adminSocketId = null;

io.on("connection", (socket) => {
  userCount++;
  console.log(`${userCount} client(s) connected: ${socket.id}`);

  socket.emit("user-connected", socket.id);

  // Handle the "admin-connected" event
  socket.on("admin-connected", (admin) => {
    const adminId = admin.id;

    // if (!admins[adminId]) {
    admins[adminId] = {
      socketId: socket.id, // Store the socket ID
      admin: admin, // Store the admin object
    };
    adminSocketId = socket.id;
    socket.emit("admin-connected", {
      admin: admin,
      managers: managers,
      trips: adminTrips,
      adminSocketId: adminSocketId,
    });
    // } else {
    //   console.log(`Admin with ID ${adminId} already exists.`);
    // }
  });

  // Handle the "manager-connected" event
  socket.on("manager-connected", (manager) => {
    const managerId = manager.id;

    // if (!managers[managerId]) {
    managers[managerId] = {
      socketId: socket.id, // Store the socket ID
      manager: manager, // Store the manager object
    };
    console.log("Managers: ", managers);
    socket.emit("manager-connected", {
      manager: manager,
      trips: trips[managerId],
    });

    // Notify the admin of a new manager connection
    if (adminSocketId) {
      socket.to(adminSocketId).emit("manager-connected", manager);
    }
    // } else {
    //   if (adminSocketId) {
    //     socket.to(adminSocketId).emit("manager-exists", manager);
    //   }
    //   console.log(`Manager with ID ${managerId} already exists.`);
    // }
  });

  // Handle the "manager-disconnected" event
  socket.on("manager-disconnected", (manager) => {
    if (managers[manager.id]) {
      delete managers[manager.id];
      console.log(`Manager ${manager.id} disconnected.`);
      console.log("Managers: ", managers);
    } else {
      console.log(`Manager with ID ${manager.id} does not exist.`);
    }
  });

  socket.on("trip-started", (trip) => {
    const tripId = trip.selected_schedule.id;
    const managerId = trip.managerId;

    if (!trips[managerId]) {
      trips[managerId] = {};
    }

    trips[managerId][tripId] = {
      trip: trip,
    };

    adminTrips[tripId] = {
      trip: trip,
    };

    // Broadcast trip start to the manager and admin
    if (managers[managerId]) {
      socket.to(managers[managerId].socketId).emit("trip-started", trip);
    }
    if (adminSocketId) {
      socket.to(adminSocketId).emit("trip-started", trip);
    }
    // } else {
    //   socket.to(socket.id).emit("trip-exists", trip);
    //   console.log(
    //     `Trip with ID ${tripId} for manager ${managerId} already exists.`
    //   );
    // }
  });

  // Handle the "trip-locations" event (emit location updates to manager and admin)
  socket.on("trip-location", (location) => {
    console.log(`New location from driver ${socket.id}:`, location);

    const managerId = location.managerId;
    if (managers[managerId]) {
      socket.to(managers[managerId].socketId).emit("trip-location", location);
    }

    if (adminSocketId) {
      socket.to(adminSocketId).emit("trip-location", location);
      ``;
    }
  });

  // Handle the "trip-ended" event
  socket.on("trip-ended", (trip) => {
    const tripId = trip.selected_schedule.id;
    const managerId = trip.managerId;

    // Broadcast trip end to the manager and admin
    if (managers[managerId]) {
      console.log("mahnager socket id: " + managers[managerId].socketId);
      socket.to(managers[managerId].socketId).emit("trip-ended", trip);
    }

    if (adminSocketId) {
      socket.to(adminSocketId).emit("trip-ended", trip);
    }

    socket.to(socket.id).emit("trip-ended", trip);

    if (trips[managerId]) {
      delete trips[managerId][tripId];
    }

    if (adminTrips[tripId]) {
      delete adminTrips[tripId];
    }
    // } else {
    //   socket.to(socket.id).emit("trip-not-found", trip);
    //   console.log(
    //     `Trip with ID ${tripId} for manager ${managerId} does not exist.`
    //   );
    // }
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    userCount--;
    console.log(`User ${socket.id} disconnected`);

    console.log("Managers: ", managers);

    // Remove the user from managers or admins
    Object.keys(managers).forEach((managerId) => {
      if (managers[managerId].socketId === socket.id) {
        console.log(`Manager ${managerId} removed on disconnect.`);
        delete managers[managerId];
      }
    });

    if (adminSocketId === socket.id) {
      adminSocketId = null;
      console.log("Admin disconnected.");
    }
  });
});

// Add error handling for server and socket
server.on("error", (err) => {
  console.error("Server error:", err);
});

io.on("error", (err) => {
  console.error("Socket.IO error:", err);
});
