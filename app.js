var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var session = require("express-session")({
    secret: "wahoowa",
    resave: true,
    saveUninitialized: true
});
var sharedsession = require("express-socket.io-session");

app.use(session);

app.use(express.static(__dirname + '/static'));

app.get('/help', function(req, res) {
    res.sendFile(__dirname + '/pages/help.html');
});

app.get('/about', function(req, res) {
    res.sendFile(__dirname + '/pages/about.html');
});

app.get('*', function(req, res) {
    res.sendFile(__dirname + '/pages/index.html');
});

io.use(sharedsession(session, {
    autoSave:true
}));

rooms = {};
users = {};
io.on('connection', function(socket){
    var id = socket.handshake.sessionID;
    var connected = users[id];
    console.log('a user connected');
    if (connected) {
        console.log('session: ' + id);
        connected.expire = new Date().getTime();
        if (connected.inroom) {
            socket.emit('alreadyInRoom');
        }
        else {
            connected.inroom = socket.id;
            joinRoom(connected.code, connected.name)
        }
    }
    else {
        socket.emit('startMain');
    }

    socket.on('disconnect', function(){
        console.log('a user disconnected');
        var discId;
        var connected = users[id];
        if (connected) {
            discId = connected.inroom;
            if (discId === socket.id) connected.inroom = null;
        }

        let timeout = 5000;
        setTimeout(function() {
            if (connected) {
                if (connected.expire + timeout < new Date().getTime() && discId === socket.id) {
                    leaveRoom();
                }
            }
        }, timeout);
    });

    socket.on('createRoom', function(name) {
        var connected = users[id];
        if (connected) {
            if (connected.inroom) {
                socket.emit('alreadyInRoom');
                return;
            }
        }
        var code = makeCode(4);
        while (rooms[code]) {
            code = makeCode(4);
        }
        rooms[code] = {host: name, users: [], started: false, usersAndRoles: {}, middleRoles: []};
        joinRoom(code, name);
    });

    socket.on('joinRoom', function(code, name) {
        code = code.toUpperCase();
        if(rooms[code]) {
            if (rooms[code].users.indexOf(name) !== -1) {
                socket.emit('nameTaken');
                return;
            }
            joinRoom(code, name);
        }
        else {
            socket.emit('noSuchRoom');
        }
    });

    socket.on('leaveRoom', function() {
        leaveRoom();
    });

    socket.on('endGame', function(code) {
        if (users[id].name !== rooms[code].host) return;
        rooms[code].started = false;
        io.to(code).emit('endGame');
    });

    socket.on('codeLinkFollowed', function(code) {
        if (!users[id]) socket.emit('newJoiner', code);
    });

    socket.on('startGame', function(code) {
        if (users[id].name !== rooms[code].host) return;
        rooms[code].started = true;
    });

    socket.on('assignRoles', function(values, code) {
        if (users[id].name !== rooms[code].host) return;
        io.to(code).emit('rolesChosen');
        var roomUsers = rooms[code].users;
        var usersAndRoles = {};
        var rolesArray = [];
        Object.keys(values).forEach(function(key) {
            while (values[key] > 0) {
                rolesArray.push(key.substring(0, key.length-5));
                values[key]--;
            }
        });
        shuffle(rolesArray);
        for (let i = 0; i < roomUsers.length; i++) {
            usersAndRoles[roomUsers[i]] = rolesArray[i];
        }
        rooms[code].usersAndRoles = usersAndRoles;
        var middleRoles = rolesArray.slice(roomUsers.length);
        rooms[code].middleRoles = middleRoles;
        io.to(code).emit('displayRoles', usersAndRoles, middleRoles, rooms[code].host, true);
    });

    socket.on('getRoles', function(code) {
        socket.emit('displayRoles', rooms[code].usersAndRoles, rooms[code].middleRoles, rooms[code].host, false);
    });

    function joinRoom(code, name) {
        if (!rooms[code]) {
            socket.emit('noSuchRoom');
            return;
        }
        if (rooms[code].users.indexOf(name) === -1) {
            if (rooms[code].started) {
                socket.emit('gameAlreadyStarted');
                return;
            }
            rooms[code].users.push(name);
        }
        var connected = users[id];
        if (!connected) {
            users[id] = {};
        }
        users[id] = {name: name, code: code, expire: new Date().getTime(), inroom: socket.id};
        console.log('%s joined room %s', name, code);
        socket.join(code);
        socket.emit('roomJoined', code, name, rooms[code].host, rooms[code].started);
        io.to(code).emit('updateUsers', rooms[code], rooms[code].started);
    }

    function leaveRoom() {
        var code = users[id].code;
        var name = users[id].name;
        delete users[id];
        var room = rooms[code];
        if (!room) return;
        var index = room.users.indexOf(name);
        if (index > -1) {
            room.users.splice(index, 1);
        }
        if (room.users.length === 0) {
            delete rooms[code];
        }
        else {
            if (name === room.host) {
                room.host = room.users[0];
            }
            io.to(code).emit('updateUsers', rooms[code], rooms[code].started);
        }
    }
});

http.listen(process.env.PORT || 3000, function() {
    console.log('listening!');
});

function makeCode(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}
