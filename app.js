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
    console.log('a user connected');
    if (socket.handshake.session.username) {
        console.log('session: ' + socket.handshake.session.username);
        var connected = users[socket.handshake.session.username];
        if (connected) {
            connected.expire = new Date().getTime();
        }
    }

    socket.on('disconnect', function(){
        console.log('a user disconnected');
        var connected = users[socket.handshake.session.username];
        var discId;
        if (connected) {
            discId = connected.inroom;
            connected.inroom = null;
        }

        let timeout = 5000;
        setTimeout(function() {
            connected = users[socket.handshake.session.username];
            if (connected) {
                if (connected.expire + timeout < new Date().getTime() && discId === socket.id) {
                    leaveRoom();
                }
            }
        }, timeout);
    });

    socket.on('createRoom', function(name) {
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
            var connected = users[socket.handshake.session.username];
            if (connected) {
                if (connected.inroom) {
                    socket.emit('alreadyInRoom');
                    return;
                }
                else {
                    connected.inroom = socket.id;
                }
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

    socket.on('codeLinkFollowed', function(code) {
        if (socket.handshake.session.username) {
            if (rooms[code] && rooms[code].users.indexOf(socket.handshake.session.username) === -1) {
                socket.emit('newJoiner', code);
                return;
            }
            var connected = users[socket.handshake.session.username];
            if (connected) {
                if (connected.inroom) {
                    socket.emit('alreadyInRoom');
                    return;
                }
                else {
                    connected.inroom = socket.id;
                }
            }
            joinRoom(code, socket.handshake.session.username);
        }
        else {
            socket.emit('newJoiner', code);
        }
    });

    socket.on('startGame', function(code) {
        rooms[code].started = true;
    });

    socket.on('assignRoles', function(values, code) {
        io.to(code).emit('rolesChosen');
        var users = rooms[code].users;
        var usersAndRoles = {};
        var rolesArray = [];
        Object.keys(values).forEach(function(key) {
            while (values[key] > 0) {
                rolesArray.push(key.substring(0, key.length-5));
                values[key]--;
            }
        });
        for (let i = 0; i < users.length; i++) {
            usersAndRoles[users[i]] = rolesArray[i];
        }
        rooms[code].usersAndRoles = usersAndRoles;
        var middleRoles = rolesArray.slice(users.length);
        rooms[code].middleRoles = middleRoles;
        io.to(code).emit('displayRoles', usersAndRoles, middleRoles, true);
    });

    socket.on('getRoles', function(code) {
        socket.emit('displayRoles', rooms[code].usersAndRoles, rooms[code].middleRoles, false);
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
        if (!socket.handshake.session.username) {
            socket.handshake.session.username = name;
            socket.handshake.session.code = code;
        }
        users[name] = {expire: new Date().getTime(), inroom: socket.id};
        console.log('%s joined room %s', name, code);
        socket.join(code);
        socket.emit('roomJoined', code, name, rooms[code].host, rooms[code].started);
        io.to(code).emit('updateUsers', rooms[code]);
    }

    function leaveRoom() {
        var name = socket.handshake.session.username;
        var code = socket.handshake.session.code;
        delete socket.handshake.session.username;
        delete socket.handshake.session.code;
        delete users[name];
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
            io.to(code).emit('updateUsers', rooms[code]);
        }
    }
});

http.listen(3000, function() {
    console.log('listening on *:3000');
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
