var express = require('express'),
    everyauth = require('everyauth');

everyauth.twitter
    .consumerKey('bPbCynUWdNXLcyt0hb5Tsg')
    .consumerSecret('SCobLZc3ncEaR8qBAnPn929YcuFvghr2ru2FpFR74')
    .callbackPath('/auth/twitter/callback')
    .findOrCreateUser( function (session, accessToken, accessTokenSecret, twitterUserMetadata) {
        // find or create user logic goes here
        console.log(twitterUserMetadata);
        return {id: '0', username: '@bundy_kim'};
    })
    .redirectPath('/');

everyauth.facebook
    .appId('287592404587592')
    .appSecret('047d93f6c0370cce2044f91a20b55d95')
    .findOrCreateUser( function (session, accessToken, accessTokExtra, fbUserMetadata) {
        // find or create user logic goes here
        console.log(fbUserMetadata);
        return {id: '0', username: '@bundy_kim'};
    })
    .redirectPath('/');

everyauth.debug = true;

var app = express.createServer();
var io = require('socket.io').listen(app);
var port = 7777;

var transports = ['websocket', 'flashsocket',  'xhr-polling', 'htmlfile', 'jsonp-polling'];
io.configure(function() {
    io.set('transports', transports);
});
io.configure('production', function(){
    io.enable('browser client etag');
    io.set('log level', 1);
});

app.configure(function() {
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(express.session({secret: '$3CR3#'}));
    app.use(everyauth.middleware());
    app.use(app.router);


    app.use('/media', express.static(__dirname + '/media'));
    app.use('/', express.static(__dirname + '/templates/'));
});
app.configure('production', function() {
    app.set('log level', 1);
    app.use(express.errorHandler());
});
app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

everyauth.helpExpress(app);

app.listen(port);
console.log("      `,,,,,    ,,,          ,,     ,,`              ,,,                                    `,,                    \n      `....,    ,.,          ..     ,.`              ,.,                                    `..                    \n      `::::,    ,.,          ::     ,.`              ,.,                                    `..                    \n    ,,,    `,,  ,,,,,,,,         ,,,,,,,,            ,,,,,,,,       ,,,,,       :,,,,,,:  ,,,,,,,,    :,,,,,,:     \n    ,,,    `,,  ,,,,,,,,         ,,,,,,,,            ,,,,,,,,       ,,,,,       :,,,,,,:  ,,,,,,,,    :,,,,,,:     \n      `::::,    ,,,     ::`  ::     ,,`              ,,,    `::  ,::  ,,,::`  ::     :,:    `,,     ::,,:          \n      `,,,,,    ,,,     ,,`  ,,     ,,`              :,,    `,,  ,,,  ,,,,,`  ,,     :,:    `,,     ,,,,:          \n      `::::,    ,,:     ,,`  ,,     ,,`              :,,    `,,  ,,:  ,::::`  ,,     :,:    `,,     :::::          \n    ::,    `::  ,::     ::`  ::     ::`              ::,    `::  ,::::`       ::     :::    `::          :::::     \n    ::,    `::  ,::     ::`  ::     ::`              ::,    `::  ,::::`       ::     :::    `::          :::::     \n      `::::,    ,:::::::     ::       ,::            :::::::,       :::::       ::::::::       ::,  :::::::        \n      `::::,    ,:::::::     ::       ,::            :::::::,       :::::       ::::::::       ::,  :::::::        \n      `::::,    ,:::::::     ::       ,::            :::::::,       :::::       ::::::::       ::,  :::::::        \n");
console.log('eightbitbeats.com! Listening on port ' + app.address().port);
var TRACK_COUNT = 8;
var STEP_COUNT = 64;
var users = {};
var tracks = {};
for(var i = 0; i < TRACK_COUNT; i++) {
    var trackID = 'track' + i
    tracks[trackID] = {
        instrument:null,
        user:null,
        steps:[],
        timestamp: null,
        release: function(data, userTrack) {
            // data = {'trackID': 'track0' }
            if (userTrack != null && userTrack == data.trackID) {
                // clear ownership of track
                socket.set('track', null, function() {
                    tracks[userTrack].user = null;
                    tracks[userTrack].instrument = null;
                    tracks[userTrack].clearSteps();
                    socket.broadcast.emit('release', data);
                    console.log('released: ' + data.trackID);
                });
            }
        },
        clearSteps: function() {
            for (var sCnt=0; sCnt < STEP_COUNT; sCnt++) {
                this.steps[sCnt] = {'notes': []};
            }
        }
    };
    for(var j = 0; j < STEP_COUNT; j++) {
        tracks[trackID].steps[j] = {'notes': []};
    }
}
tracks.getClaimed = function() {
    var trackID;
    var claimedTracks = {};
    for(var i = 0; i < TRACK_COUNT; i++) {
        trackID = 'track' + i;
        if (tracks[trackID].user != null) {
            claimedTracks[trackID] = tracks[trackID];
        }
    }
    return claimedTracks;
};

tracks.releaseClaimed = function(userSocket) {
    userSocket.get('track', function(err, userTrack) {

        // clear ownership of track if we own one
        if (userTrack != null) {
            userSocket.set('track', null, function() {
                tracks[userTrack].user = null;
                tracks[userTrack].instrument = null;
                tracks[userTrack].clearSteps();
                userSocket.broadcast.emit('release', {'trackID': userTrack});
            });
        }
    });
};

function disconnectUser(userSocket, data) {
    userSocket.get('track', function(err, userTrack) {
        tracks.releaseClaimed(userSocket);
    });
    userSocket.get('name', function(err, username) {
        if (username != null && users[username] != undefined) {
            console.log(username + ' logged out!');
            delete users[username];
        }
    });
}

io.sockets.on('connection', function(socket) {

    //----------- LOGIN ------------
    socket.on('login', function(data) {

        // add double username check
        if(!data.name.match(/^[a-zA-Z0-9_]{3,16}$/)) {
            socket.emit('error', {'msg': "Please choose a username that's alphanumeric and up to 16 characters long. Underscores are ok too."});
            return;
        }
        else if(users[data.name] != undefined) {
            socket.emit('error', {'msg': "Sorry, but that username is already being used by someone"});
            return;
        }

        socket.get('name', function(err, username) {
            if (username == null) {
                socket.set('name', data.name, function() {
                    users[data.name] = data.name;

                    // sync new user's tracks
                    socket.emit('sync', {'tracks': tracks.getClaimed(), 'user': data});
                    console.log(data.name + ' logged in!');
                });
            }
        });
    });

    //----------- SYNC ------------

    socket.on('sync', function(data) {
        socket.emit('sync', tracks.getClaimed());
    });

    //----------- DISCONNECT ------------
    socket.on('disconnect', function(data) {
        disconnectUser(socket, data);
    });

    //----------- CHANGE ------------

    socket.on('change', function(data) {
         // Takes in changes to a step in a track
         // {track: 'track1', step: 3, notes: [0,0,0,...]}

        socket.get('track', function(err, userTrack) {
            if (userTrack != null && data.track == userTrack) {
                tracks[data.track].steps[data.step].notes = data.notes;
                socket.broadcast.emit('change', data);
            }
        });
    });

    //----------- CLAIM ------------

    socket.on('claim', function(data) {
        // check if we already own a track
        socket.get('track', function(err, userTrack) {
            if (userTrack != null) {
                socket.emit('error', {'msg': 'You can only control one track at a time!'});
                return;
            }

            // assign a track id
            var trackID = undefined;
            for(var i = 0; i < TRACK_COUNT; i++) {
                trackID = 'track' + i;
                if (tracks[trackID].user == null) {
                    tracks[trackID].user = data.user;
                    tracks[trackID].instrument = data.instrument;
                    break;
                }
                trackID = undefined;
            }
            if (trackID != undefined) {
                socket.set('track', trackID, function() {
                    console.log('assigned ' + trackID);
                    // broadcast claim call to everyone including claimer
                    var claimTimestamp = +new Date();
                    tracks[trackID].timestamp = claimTimestamp;
                    var return_data = {
                        'trackID': trackID,
                        'user': data.user,
                        'timestamp': claimTimestamp,
                        'instrument': data.instrument
                    };
                    io.sockets.emit('claim', return_data);
                });
            }
            // all tracks taken
            else {
                socket.emit('error', {'msg': 'Sorry all tracks are currently occupied by other users :('});
            }
        });
    });

    //----------- RELEASE ------------
    socket.on('release', function() {
        tracks.releaseClaimed(socket);
    });

    //----------- INSTRUMENT ------------
    socket.on('instrument', function(data) {
        // TODO update server track owner data
        socket.get('track', function(err, userTrack) {
            if (userTrack != null && userTrack == data.trackID) {
                console.log(data.trackID + ' instrument changed to ' + data.instrument.name);

                if (data.instrument.sounds.length != tracks[data.trackID].instrument.sounds.length) {
                    tracks[data.trackID].clearSteps();
                }
                tracks[data.trackID].instrument = data.instrument;
                socket.broadcast.emit('instrument', data);
            }
        });
    });

    //------------ CHAT --------------
    socket.on('chat', function(data) {
        socket.get('name', function(err, username) {
            if (username != null) {
                socket.broadcast.emit('chat', {'username': username, 'content': data.content});
            }
        });
    });
});

