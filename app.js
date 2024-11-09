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

let trips = {};
let admins = {};
let managers = {};
let adminTrips = {};
let adminId = null;

io.on("connection", (socket) => {
  socket.emit("user-connected", socket.id);

  // socket.on("admin-connected", (admin) => {
  //   const adminId = admin.id;

  //   admins[adminId] = {
  //     socketId: socket.id,
  //     admin: admin,
  //   };

  //   adminSocketId = socket.id;
  //   socket.emit("admin-connected", {
  //     admin: admin,
  //     managers: managers,
  //     trips: adminTrips,
  //     adminSocketId: adminSocketId,
  //   });
  // });

  socket.on("admin-connected", (admin) => {
    adminId = admin.id; // Unique identifier for the admin
    const roomName = `room-admin-${adminId}`; // Create a unique room name for the admin

    console.log(`Admin ${adminId} connected to room ${roomName}.`);

    // Join the room (this ensures multiple devices can connect to the same room)
    socket.join(roomName);

    // Track admin connections
    if (!admins[adminId]) {
      admins[adminId] = {
        connections: [], // Store connections (multiple devices)
        admin: admin, // Admin object
      };
    }

    // Add this socket to the connections list
    admins[adminId].connections.push(socket.id);

    // Log the current connections for this admin
    console.log(
      `Admin connections with ${adminId}:`,
      admins[adminId].connections
    );

    // Emit data to the connecting socket (individual acknowledgment)
    socket.emit("admin-connected", {
      admin: admins[adminId],
      managers: managers, // Relevant manager data
      trips: adminTrips, // Relevant trip data
    });

    // Notify all other devices in the room that a new device has joined
    io.to(roomName).emit("admin-joined", {
      // admin: admins[adminId],
      devices: admins[adminId].connections, // Broadcast all connected devices
    });
  });

  socket.on("admin-disconnected", (admin) => {
    const adminId = admin.id;
    const roomName = `room-admin-${adminId}`;

    console.log(`Admin ${adminId} disconnected from room ${roomName}.`);

    // Remove the socket from the connections list
    if (admins[adminId]) {
      admins[adminId].connections = admins[adminId].connections.filter(
        (connection) => connection !== socket.id
      );

      // Log the current connections for this admin
      console.log(
        `admin disconnections with id ${adminId}:`,
        admins[adminId].connections
      );

      // Notify all other devices in the room that a device has left
      io.to(roomName).emit("admin-left", {
        admin: admins[adminId],
        devices: admins[adminId].connections, // Broadcast all connected devices
      });

      // If the admin has no more connections, remove the admin
      if (admins[adminId].connections.length === 0) {
        delete admins[adminId];
        // if not admin, remove room
        socket.leave(roomName);
        adminId = null;
        console.log(`All admins: ${admins}`);
      }
    }
  });

  socket.on("manager-connected", (manager) => {
    const managerId = manager.id;

    managers[managerId] = {
      socketId: socket.id, // Store the socket ID
      manager: manager, // Store the manager object
    };
    console.log("Managers: ", managers);
    socket.emit("manager-connected", {
      manager: managers[managerId],
      trips: trips[managerId] ? trips[managerId] : {},
    });

    // Notify the admin of a new manager connection
    if (adminId) {
      io.to(`room-admin-${adminId}`).emit("manager-connected", {
        manager: managers[managerId],
        trips: trips[managerId] ? trips[managerId] : {},
      });
    }
  });

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

    if (adminId) {
      io.to(`room-admin-${adminId}`).emit("trip-started", trip);
    }
  });

  socket.on("trip-location", (location) => {
    console.log(`New location from driver ${socket.id}:`, location);

    const managerId = location.managerId;
    if (managers[managerId]) {
      socket.to(managers[managerId].socketId).emit("trip-location", location);
    }

    if (adminId) {
      io.to(`room-admin-${adminId}`).emit("trip-started", trip);
    }
  });

  socket.on("trip-ended", (trip) => {
    const tripId = trip.selected_schedule.id;
    const managerId = trip.managerId;

    // Broadcast trip end to the manager and admin
    if (managers[managerId]) {
      console.log("mahnager socket id: " + managers[managerId].socketId);
      socket.to(managers[managerId].socketId).emit("trip-ended", trip);
    }

    if (adminId) {
      io.to(`room-admin-${adminId}`).emit("trip-started", trip);
    }

    socket.to(managerId).emit("trip-ended", trip);

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

  socket.on("disconnect", () => {
    console.log(`User ${socket.id} disconnected`);
    console.log("all rooms", socket.rooms);

    // console.log("Managers: ", managers);

    // Remove the user from managers or admins
    // Object.keys(managers).forEach((managerId) => {
    //   if (managers[managerId].socketId === socket.id) {
    //     console.log(`Manager ${managerId} removed on disconnect.`);
    //     delete managers[managerId];
    //   }
    // });

    // if (adminSocketId === socket.id) {
    //   adminSocketId = null;
    //   console.log("Admin disconnected.");
    // }
  });
});

server.on("error", (err) => {
  console.error("Server error:", err);
});

io.on("error", (err) => {
  console.error("Socket.IO error:", err);
});
