/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * The Node.js backend server that communicates with the hardware and serves the
 * HTML web app.
 *
 * This server does several things:
 *
 * - Handles call to the various instruments on the local serial port.
 * - Parses instrument responses into JSON dta structures
 * - Does the actual recording of live logs
 *
 * @author Edouard Lafargue
 */


/**
 *   Setup access to serial ports
 */
var serialport = require('serialport'),
    SerialPort = serialport.SerialPort,
    PouchDB = require('pouchdb'),
    ConnectionManager = require('./connectionmanager'),
    flash = require('connect-flash'),
    debug = require('debug')('wizkers:server'),
    socket_debug = require('debug')('wizkers:server:socket');



// Utility function to get a Hex dump
var Hexdump = require('./hexdump.js');
var Debug = false;

/**
 * Setup Db connection before anything else
 */
// Returns an object containing all databases we use
var dbs = require('./pouch-config.js');


/**
 * Setup our authentication middleware
 */
var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    ConnectRoles = require('connect-roles');

var user = new ConnectRoles();

require('./config/passport')(passport); // Our Passport configuration
require('./config/roles')(user); // Configure user roles

var jwt = require('jsonwebtoken');
var socketioJwt = require('socketio-jwt');

/**
 * Setup the HTTP server and routes
 */
var express = require('express'),
    cookieParser = require('cookie-parser'),
    favicon = require('serve-favicon'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    instruments = require('./routes/instruments.js'),
    outputs = require('./routes/outputs.js'),
    deviceLogs = require('./routes/logs.js'),
    settings = require('./routes/settings.js'),
    backup = require('./routes/backup.js');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(cookieParser()); // passport authentication needs to read cookies
app.use(favicon(__dirname + '/www/img/ico/favicon.png'));
app.use(bodyParser({
    keepExtensions: true
}));

app.set('view engine', 'ejs'); // Setup templating for login forms

// Configure Passport
app.use(session({
    secret: 'LKJQDHFGLKJHpiusdhfgpsidf!à§98769876654è§!ç'
}));
app.use(passport.initialize());
app.use(passport.session()); // Persistent login sessions, makes user life easier
app.use(flash()); // Flash messages upon login, stored in session




// Before starting our server, make sure we reset any stale authentication token:
dbs.settings.get('coresettings', function (err, item) {
    debug("Getting settings: " + item);
    if (err) {
        debug('Issue finding my own settings ' + err);
    }
    if (item == null) {
        item = dbs.defaults('settings');
    }

    item.token = "_invalid_";
    dbs.settings.put(item, 'coresettings', function (err, response) {
        if (err) {
            console.log('***** WARNING ****** Could not reset socket.io session token at server startup');
            console.log(err);
            return;
        }
        debug(response);
        server.listen(8090);
    });

});


debug("Listening for new clients on port 8090");
var connected = false;

/****************
 *   ROUTES
 ****************/

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated()) {
        if (req.user.role === 'pending') {
            res.render('profile.ejs', {
                user: req.user,
                message: 'Your account is created, access approval is pending.'
            });
            return;
        }
        return next();
    }

    // if they aren't redirect them to the login page
    res.redirect('/login');
}

/**
 *  Authentication: before anything else, make sure all
 * request to our root are authenticated:
 */

app.get('/',
    isLoggedIn,
    function (req, res) {
        res.sendFile(__dirname, 'www/index.html');
    });

app.get('/login', function (req, res) {
    // Before logging in, we need to make sure there are users defined on our system.
    dbs.users.info(function (err, info) {
        if (info.doc_count == 0) {
            var adm = dbs.defaults('user');
            adm.local.email = "admin";
            adm.local.password = dbs.utils.users.generateHash('admin');
            adm.role = 'admin';
            adm._id = 'admin'; // The userID has to be unique, we can use this as the CouchDB ID
            dbs.users.put(adm, function (err, response) {
                if (err)
                    debug("Error during first user creation " + err);
                debug(response);

                // Now create de admin user's settings too:
                var settings = dbs.defaults('settings');
                settings.currentUserRole = 'admin';
                settings._id = 'admin';
                dbs.settings.put(settings, function (err, response) {
                    if (err)
                        debug('Error during first user settings creation', err);
                    res.render('login.ejs', {
                        message: 'Welcome! Your default login/password is admin/admin'
                    });
                });
            });
        } else {
            res.render('login.ejs', {
                message: req.flash('loginMessage')
            });
        }
    });
});
app.get('/signup', function (req, res) {
    res.render('signup.ejs', {
        message: req.flash('signupMessage')
    });
});
app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});
// process the signup form
app.post('/signup', passport.authenticate('local-signup', {
    successRedirect: '/profile', // redirect to the secure profile section
    failureRedirect: '/signup', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
}));
// process the login form
app.post('/login', passport.authenticate('local-login', {
    failureRedirect: '/login', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
}), function (req, res) {

    // If the login process generated a flash message, go to the warning page
    // first
    var w = req.flash('warningMessage');
    if (w != '') {
        debug("Warning: " + w);
        res.render('warning.ejs', {
            message: w
        });
        return;
    }

    // We're good: we gotta generate a json web token
    var profile = {
        username: req.user.local.email,
        role: req.user.role
    };

    // we are sending the profile in the token
    var token = jwt.sign(profile, 'asdfKJHSADFkh876234879876sdfllKJsPOIU' + secret_salt);


    // Now store our token into the settings, so that the app can get it when it starts:
    dbs.settings.get(req.user.local.email, function (err, item) {
        if (err && err.status != 404) {
            debug('Issue finding my own settings ' + err);
            res.redirect('/login');
        }
        if (item == null) {
            item = dbs.defaults('settings');
        }
        item.token = token;
        dbs.settings.put(item, req.user.local.email, function (err) {
            if (err)
                res.redirect('/login');
            res.redirect('/');
        });
    });


});

app.get('/profile', isLoggedIn, function (req, res) {
    res.render('profile.ejs', {
        user: req.user,
        message: ''
    });
});
app.post('/profile', isLoggedIn, function (req, res) {
    dbs.users.get(req.user.local.email, function (err, record) {
        debug(record);
        record.local.password = dbs.utils.users.generateHash(req.body.password);
        dbs.users.put(record, function (err) {
            var msg = (err) ? 'Error changing password' : 'Password changed';
            res.render('profile.ejs', {
                user: req.user,
                message: msg
            });
        });

    });
});

app.get('/admin', isLoggedIn, user.is('admin'), function (req, res) {
    dbs.users.allDocs({
        include_docs: true
    }, function (err, users) {
        res.render('admin.ejs', {
            user: req.user,
            users: users.rows,
            message: ''
        });
    });
});
app.post('/admin', isLoggedIn, user.is('admin'), function (req, res) {
    debug(req.body);
    dbs.users.get(req.body.id, function (err, user) {
        var msg = "Role updated to " + req.body.newrole + " for user " + user.local.email;
        if (err)
            msg = "Someting went wrong, no change was made.";
        if (req.body.newrole == 'delete') {
            dbs.users.remove(user, function (err, result) {
                if (err)
                    debug(err);
                debug('User ' + req.body.id + ' deleted');
                var msg = 'User ' + req.body.id + " deleted";
                dbs.users.allDocs({
                    include_docs: true
                }, function (err, users) {
                    res.render('admin.ejs', {
                        user: req.user,
                        users: users.rows,
                        message: msg
                    });
                });
            });
        } else {
            user.role = req.body.newrole;
            dbs.users.put(user, function (err) {
                if (err)
                    msg = "Something went wrong, no change was made.";
                dbs.users.allDocs({
                    include_docs: true
                }, function (err, users) {
                    res.render('admin.ejs', {
                        user: req.user,
                        users: users.rows,
                        message: msg
                    });
                });
            });
        }
    });
});


/**
 * Interface for managing instruments
 */
app.get('/instruments', isLoggedIn, instruments.findAll);
app.get('/instruments/:id', isLoggedIn, instruments.findById);
app.post('/instruments', isLoggedIn, user.is('operator'), instruments.addInstrument);
app.post('/instruments/:id/picture', isLoggedIn, user.is('operator'), instruments.uploadPic);
app.put('/instruments/:id', isLoggedIn, user.is('operator'), instruments.updateInstrument);
app.delete('/instruments/:id', isLoggedIn, user.is('operator'), instruments.deleteInstrument);

/**
 * Interface for managing output plugins. Outputs are only defined
 * relative to an instrument, which is reflected in the URL
 */
app.get('/instruments/:id/outputs', isLoggedIn, user.is('operator'), outputs.findByInstrumentId);
app.post('/instruments/:id/outputs', isLoggedIn, user.is('operator'), outputs.addOutput);
app.get('/instruments/:iid/outputs/:id', isLoggedIn, user.is('operator'), outputs.findById);
app.put('/instruments/:iid/outputs/:id', isLoggedIn, user.is('operator'), outputs.updateOutput);
app.delete('/instruments/:iid/outputs/:id', isLoggedIn, user.is('operator'), outputs.deleteOutput);

/**
 * Interface for managing instrument logs (summary)
 */
app.get('/instruments/:id/logs', isLoggedIn, deviceLogs.findByInstrumentId);
app.post('/instruments/:id/logs', isLoggedIn, user.is('operator'), deviceLogs.addLog);
app.get('/logs/', isLoggedIn, deviceLogs.findAll);
app.get('/logs/:id', isLoggedIn, deviceLogs.findById);
app.get('/logs/:id/entries', isLoggedIn, deviceLogs.getLogEntries);
app.post('/logs/:id/entries', isLoggedIn, user.is('operator'), deviceLogs.addLogEntry);
app.put('/instruments/:iid/logs/:id', isLoggedIn, user.is('operator'), deviceLogs.updateEntry);
app.delete('/instruments/:idd/logs/:id', isLoggedIn, user.is('operator'), deviceLogs.deleteLog);
app.delete('/logs/:lid/entries/:id', isLoggedIn, user.is('operator'), deviceLogs.deleteLogEntry);


/**
 * Interface for extracting logs in json format
 *
 * /export/:id/:start/:end/:format (need API key in URL ?)
 *     Extract a particular instrument log with a start & end timestamp
 * /live/:period : period being in minutes
 *     Get the current live recording for the last ':period'
 */
app.get('/live/:id/:period', deviceLogs.getLive);


/**
 * Interface for our settings. Only one settings object,
 * so no getting by ID here. Note: I now mostly store settings
 * in-browser rather than on-server.
 */
app.get('/settings', isLoggedIn, settings.getSettings);
app.put('/settings', isLoggedIn, settings.updateSettings);

/**
 * Interface for triggering a backup and a restore
 */
app.get('/backup', isLoggedIn, user.is('admin'), backup.generateBackup);
app.post('/restore', isLoggedIn, user.is('admin'), backup.restoreBackup);

// Our static resources are in 'www'
// GET /javascripts/jquery.js
// GET /style.css
// GET /favicon.ico
// Everything static should be authenticated: therefore we are inserting a checkpoint middleware
// at this point
app.use(function (req, res, next) {
    // debug("*** checkpoint ***");
    if (req.isAuthenticated())
        return next();

    // We are allowing CSS and img folders
    if (req.path.indexOf("/css") == 0 || req.path.indexOf("/fonts") == 0)
        return next();

    res.redirect('/');
});

app.use(express.static(__dirname + '/www'));


/////////
// A small utility here (to be moved elswhere...)
/////////
//http://stackoverflow.com/questions/2454295/javascript-concatenate-properties-from-multiple-objects-associative-array

function Collect(ob1, ob1) {
    var ret = {},
        len = arguments.length,
        arg, i = 0,
        p;

    for (i = 0; i < len; i++) {
        arg = arguments[i];
        if (typeof arg !== "object") {
            continue;
        }
        for (p in arg) {
            if (arg.hasOwnProperty(p)) {
                ret[p] = arg[p];
            }
        }
    }
    return ret;
}

// Output plugin management: we have an outputmanager, whose role
// is to send data to various third parties (twitter, Safecast, HTTP REST calls
// etc. There is one single instance for the application.
var outputmanager = require('./outputs/outputmanager.js');

// Backend logging: we want to let the backend record stuff into
// the database by itself, this object is in charge of precisely that.
// Unique instance available throughout the application.
var recorder = require('./recorder.js');

// And last, the Connection manager, which keeps track of what device is open/closed
var connectionmanager = new ConnectionManager();

// Automatically connect all the instruments that have that option
// turned on
connectionmanager.autoConnect();

//////////////////
// Socket management: supporting multiple clients at a time now!
//////////////////

var secret_salt = new Date().getMilliseconds();

// Setup Socket.io authorization based on JSON Web Tokens so that we get
// authorization info from our login process:
io.use(socketioJwt.authorize({
    secret: 'asdfKJHSADFkh876234879876sdfllKJsPOIU' + secret_salt,
    handshake: true,
}));

// listen for new socket.io connections:
io.sockets.on('connection', function (socket) {

    var self = this;

    // Reference to the instrument driver for this socket.
    // it is returned by the connection manager.
    var driver = null;
    // We want to track the current instrument ID, in case
    // we switch instrument during the same session, and need to
    // subscribe/unsubscribe to events coming from the old/previous
    // instruments
    var currentInstrumentid = null;

    // We keep a buffer of the last 500 events to repopulate
    // the live view of instruments which support it.
    //
    // TODO: move this next to the recorder, so that
    // we keep the data even when no one is connected, which
    // makes better sense.
    //
    var data_buffer = [];
    var data_buffer_max = 500;
    var suspend_data = false;

    socket_debug(socket.decoded_token.role, 'connected');
    var userinfo = socket.decoded_token;
    // For security purposes, load the role of the user from our server-side
    // database, and don't trust the role given to us by the client. In theory
    // the client only has an encrypted token, but better safe than sorry
    dbs.users.get(userinfo.username, function (err, user) {
        userinfo.role = user.role;
        debug("Updated userinfo role to " + user.role);
    });

    // We want to listen for data coming in from drivers:
    var sendDataToFrontEnd = function (data) {
        socket_debug('data coming in for socket ' + socket.id, data);
        if (data === undefined) {
            debug('Warning, we were just asked to send empty data to the front-end');
            return;
        }
        // Temporary: detect "uniqueID" key and send as 'uniqueID' message
        if (data.uniqueID) {
            socket.emit('uniqueID', data.uniqueID);
            return;
        }
        // Now also keep the data in our data buffer:
        var stamp = (data.timestamp) ? new Date(data.timestamp).getTime() : new Date().getTime();
        data_buffer.push({
            replay_ts: stamp,
            data: data
        });
        if (data_buffer.length > data_buffer_max)
            data_buffer = data_buffer.slice(1);

        if (!suspend_data)
            socket.emit('serialEvent', data);
    }

    /**
     * Resend the contents of the data buffer all at once.
     * Note: we send the data points as an object with the
     *       time stamp embedded for accurate replay.
     * @param {Number} l Number of points to resend (not used)
     */
    var replayData = function (l) {
        suspend_data = true;
        for (var i = 0; i < data_buffer.length; i++) {
            socket.emit('serialEvent', data_buffer[i]);
        }
        suspend_data = false;
    }

    var openInstrument = function (insid) {
        // Only let "admin" and "operator" open an instrument, unless the
        // instrument is already open:
        debug("Open instrument request from front-end for " + insid);
        var isopen = connectionmanager.isOpen(insid);
        if (userinfo.role == 'operator' || userinfo.role == 'admin' ||
            isopen) {
            // Flush the data buffer if the instrument is not open already
            if (!isopen)
                data_buffer = [];
            // If the instrument is already open, openInstrument just
            // returns the reference to the already-created driver
            connectionmanager.openInstrument(insid, function (d) {
                driver = d;
                currentInstrumentid = insid;
                // Listen for data coming in from our driver
                driver.on('data', sendDataToFrontEnd);
            });
        } else
            socket_debug("Unauthorized attempt to open instrument");
    };

    socket.on('disconnect', function (data) {
        socket_debug('This socket got disconnected ', data);
        if (driver != null) {
            driver.removeListener('data', sendDataToFrontEnd);
        }
    });

    // Get information on the current user:
    //   - username
    //   - role
    //
    // Note: html5 UI will use this to remove some links that don't make sense
    // for certain roles, but this backend enforces access, not the HTML5 UI.
    socket.on('userinfo', function () {
        socket.emit('userinfo', userinfo);
    });

    // Open a port by instrument ID: this way we can track which
    // instrument is being used by the app.
    socket.on('openinstrument', openInstrument);

    socket.on('closeinstrument', function (insid) {
        if (insid != currentInstrumentid) {
            debug("**** ERROR, the socket asked to close an instrument that is not the current instrument on this socket.");
            return;
        }
        if (userinfo.role == 'operator' || userinfo.role == 'admin') {
            socket_debug('Instrument close request for instrument ID ' + insid);
            // Don't close a closed instrument...
            if (!connectionmanager.isOpen(insid))
                return;
            driver.removeListener('data', sendDataToFrontEnd);
            recorder.stopRecording(insid);
            outputmanager.disconnectOutputs(insid);
            connectionmanager.closeInstrument(insid);
            currentInstrumentid = null;
        } else
            socket_debug("Unauthorized attempt to close instrument");
    });

    /**
     * Ask whether an instrument is open (used by the instrument list display
     * to know at a glance which instruments are open
     */
    socket.on('isinstrumentopen', function (insid) {
        var isopen = connectionmanager.isOpen(insid);
        socket.emit('instrumentStatus', {
            id: insid,
            open: isopen
        });

    });

    socket.on('portstatus', function (instrumentid) {
        if (instrumentid) {
            // In case we are asked to check a particular
            // instrument, we can restore the driver state
            // in case the instrument is already open.
            //
            // But if the instrumentid is different from our
            // current instrument, then we need to unsubscribe
            // to events coming from our previous instrument, as they
            // don't make sense for the new one
            if (instrumentid != currentInstrumentid) {
                socket_debug('We are switching to a new instrument ID: ' + instrumentid);
                if (driver) {
                    driver.removeListener('data', sendDataToFrontEnd);
                    // Clear our reference to the instrument driver, it is
                    // not relevant anymore
                    driver = null;
                }
                currentInstrumentid = instrumentid;
            }
            if (connectionmanager.isOpen(instrumentid))
                openInstrument(instrumentid);
        }
        var s = {
            portopen: (driver) ? driver.isOpen() : false,
            recording: recorder.isRecording(currentInstrumentid),
            streaming: (driver) ? driver.isStreaming() : false
        };
        var ds = {};
        if (driver && driver.status)
            ds = driver.status();
        socket.emit('status', Collect(s, ds));
    });

    socket.on('controllerCommand', function (data) {
        if (Debug) socket_debug('Controller command: ' + data);
        driver.output(data);
    });

    socket.on('startrecording', function (logid) {
        recorder.startRecording(logid, driver);
    });

    socket.on('stoprecording', function () {
        recorder.stopRecording(currentInstrumentid);
    });

    socket.on('replaydata', function () {
        replayData();
    });

    socket.on('startlivestream', function (data) {
        if (driver)
            driver.startLiveStream(data);
    });

    socket.on('stoplivestream', function () {
        if (driver)
            driver.stopLiveStream();
    });

    // Request a unique identifier to our driver
    socket.on('uniqueID', function () {
        socket_debug("Unique ID requested by HTML app");
        if (driver)
            driver.sendUniqueID();
    });

    // Return a list of serial ports available on the
    // server
    socket.on('ports', function () {
        socket_debug('Request for a list of serial ports');
        serialport.list(function (err, ports) {
            var portlist = [];
            for (var i = 0; i < ports.length; i++) {
                portlist.push(ports[i].comName);
            }
            socket.emit('ports', portlist);
        });
    });

    // This call is required, because the user can change the outputs
    // while an instrument is connected, and uses this command to get the
    // server outputs to refresh.
    socket.on('outputs', function (instrumentId) {
        socket_debug("Front-end request to update the outputs for this instrument");
        if (userinfo.role == 'operator' || userinfo.role == 'admin') {
            if (driver) {
                outputmanager.enableOutputs(instrumentId, driver);
            } else {
                socket_debug("Skipped updating outputs because we have no driver (instrument is closed?)");
            }
        } else {
            socket_debug('Unauthorized attempt to reconnect outputs');
        }
    });

    socket.on('driver', function (data) {
        socket_debug('[Deprecated] Socket asked to select the driver (now done automatically at instrument open)');
    });

});