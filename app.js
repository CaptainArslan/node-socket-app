const express = require("express");
const app = express();

const server = require("http").createServer(app);

const port = process.env.PORT || 3000;
var userCount = 0

server.listen(port, () => {
    console.log("Server listening at port %d", port);
});

const io = require("socket.io")(server, {
    cors: {
        origin: "*", // allow all origins
    },
});

io.on("connection", (socket) => {
    userCount++
    console.log(`${userCount} User connected : ` + socket.id);

    socket.on("message", (msg) => {
        console.log("New messages received on server: " + msg);
        io.emit("message", msg);
    });

    socket.on("location", (location) => {
        console.log("New location received from client: " + location);
        io.emit("location", {
            id: socket.id,
            ...location
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
        io.emit('user-disconnected', socket.id)
    });
});
