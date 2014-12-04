/**
 * The Node.js backend server that communicates with the hardware and serves the
 * HTML web app.
 *
 * This server does several things:
 *
 * - Handles call to the various instruments on the local serial port.
 * - Parses instrument responses into JSON dta structures
 * - Does the actual recording of live logs
 * -
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */


/**
 *   Setup access to serial ports
 */
var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort,
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
require('./config/roles')(user);        // Configure user roles

var jwt = require('jsonwebtoken');
var socketioJwt = require('socketio-jwt');

/**
 * Setup the HTTP server and routes
 */
var express = require('express'),
    instruments = require('./routes/instruments.js'),
    outputs = require('./routes/outputs.js'),
    deviceLogs = require('./routes/logs.js'),
    settings = require('./routes/settings.js'),
    backup = require('./routes/backup.js');

var app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server, { log: false });

app.configure(function () {
    //app.use(express.logger('dev'));     // 'default', 'short', 'tiny', 'dev'
    app.use(express.cookieParser());    // passport authentication needs to read cookies
    app.use(express.favicon());         
    app.use(express.bodyParser({ keepExtensions: true }));
    
    app.set('view engine', 'ejs'); // Setup templating for login forms
    
    // Configure Passport
    app.use(express.session({secret: 'LKJQDHFGLKJHpiusdhfgpsidf!à§98769876654è§!ç' }));
    app.use(passport.initialize());
    app.use(passport.session());     // Persistent login sessions, makes user life easier
    app.use(flash());                // Flash messages upon login, stored in session
});



// Before starting our server, make sure we reset any stale authentication token:
dbs.settings.get('coresettings', function (err, item) {
    debug("Getting settings: " + item);
    if (err) {
        debug('Issue finding my own settings ' + err);
    }
    if (item == null) {
      item = dbs.defaults.settings;
    }

    item.token = "_invalid_";
    dbs.settings.put(item, 'coresettings', function(err,response) {
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
            res.render('profile.ejs', {user: req.user, message: 'Your account is created, access approval is pending.'});
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

app.get ('/',
         isLoggedIn,
         function(req,res) {
             res.sendfile('www/index.html');
         });

app.get('/login', function(req, res) {
    // Before logging in, we need to make sure there are users defined on our system.
    dbs.users.info( function(err, info) {
      if (info.doc_count == 0) {
        var adm = dbs.defaults.user;
        adm.local.email = "admin";
        adm.local.password = dbs.utils.users.generateHash('admin');
        adm.role = 'admin';
        adm._id = 'admin'; // The userID has to be unique, we can use this as the CouchDB ID
        dbs.users.put(adm, function(err, response) {
           if (err)
                debug("Error during first user creation " + err);
            debug(response);
            res.render('login.ejs', { message: 'Welcome! Your default login/password is admin/admin'  });
       });
      } else {
       res.render('login.ejs', { message: req.flash('loginMessage') }); 
     }
    });
});
app.get('/signup', function(req,res) {
    res.render('signup.ejs', { message: req.flash('signupMessage')});
});
app.get('/logout', function(req,res) {
    req.logout();
    res.redirect('/');
});
// process the signup form
app.post('/signup', passport.authenticate('local-signup', {
    successRedirect : '/profile', // redirect to the secure profile section
    failureRedirect : '/signup',  // redirect back to the signup page if there is an error
    failureFlash : true           // allow flash messages
}));
// process the login form
app.post('/login', passport.authenticate('local-login', {
    failureRedirect : '/login', // redirect back to the signup page if there is an error
    failureFlash : true         // allow flash messages
}), function(req,res) {
    
    // If the login process generated a flash message, go to the warning page
    // first
    var w = req.flash('warningMessage');
    if (w != '') {
        debug("Warning: " + w);
        res.render('warning.ejs', { message: w });
        return;
    }
    
    // We're good: we gotta generate a json web token
    var profile = {
        username: req.user.local.email,
        role: req.user.role
    };

    // we are sending the profile in the token
    var token = jwt.sign(profile, 'superSecretYesYesYes' + secret_salt);

    
    // Now store our token into the settings, so that the app can get it when it starts:
    dbs.settings.get('coresettings', function (err, item) {
        if (err) {
            debug('Issue finding my own settings ' + err);
            res.redirect('/login');
        }
        item.token = token;
        dbs.settings.put(item, function(err) {
            if (err)
                res.redirect('/login');
            res.redirect('/');
        });
    });

    
});

app.get('/profile', isLoggedIn, function(req,res) {
    res.render('profile.ejs', { user: req.user, message: '' });
});
app.post('/profile', isLoggedIn, function(req,res) {
     dbs.users.get(req.user.local.email, function(err, record) {
         debug(record);
         record.local.password = dbs.utils.users.generateHash(req.body.password);
         dbs.users.put(record, function(err) {
             var msg  = (err) ? 'Error changing password': 'Password changed';
             res.render('profile.ejs', {user: req.user, message: msg});
         });

     });
});

app.get('/admin', isLoggedIn, user.is('admin'), function(req,res) {
    dbs.users.allDocs({include_docs:true}, function(err, users) {
        res.render('admin.ejs', {user: req.user, users: users.rows, message: '' });
    });
});
app.post('/admin', isLoggedIn, user.is('admin'), function(req,res) {
    debug(req.body);
    dbs.users.get( req.body.id, function(err, user) {
        var msg = "Role updated to " + req.body.newrole + " for user " + user.local.email;
        if (err)
            msg = "Someting went wrong, no change was made.";
        
        user.role = req.body.newrole;
        dbs.users.put(user, function(err) {
            if (err)
                msg = "Something went wrong, no change was made.";
            dbs.users.allDocs({include_docs:true}, function(err, users) {
                res.render('admin.ejs', {user: req.user, users: users.rows, message: msg });
            });
        });
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
app.put('/instruments/:iid/logs/:id', isLoggedIn, user.is('operator'), deviceLogs.updateEntry);
app.delete('/instruments/:idd/logs/:id', isLoggedIn, user.is('operator'), deviceLogs.deleteLog);
app.delete('/logs/:lid/entries/:id', isLoggedIn, user.is('operator'), deviceLogs.deleteLogEntry);


/**
 * Interface for extracting logs in json format
 *
 * /export/:id/:start/:end/:format (need API key in URL ?)
 *     Extract a particular log ID with a start & end timestamp
 * /live/:period : period being in minutes
 *     Get the current live recording for the last ':period'
 */
app.get('/live/:period', deviceLogs.getLive);
 

/**
 * Interface for our settings. Only one settings object,
 * so no getting by ID here. Note: I now mostly store settings
 * in-browser rather than on-server.
 */
app.get('/settings', isLoggedIn, settings.getSettings);
app.put('/settings', isLoggedIn, user.is('operator'),  settings.updateSettings);

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
app.use(function(req,res,next) {
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
    arg, i = 0, p;
 
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
// etc... 
var outputmanager = require('./outputs/outputmanager.js');

//
// Backend logging: we want to let the backend record stuff into
// the database by itself, so we keep a global variable for doing this
var recorder = require('./recorder.js');

// And last, the Connection manager, which keeps track of what device is open/closed
var connectionmanager = new ConnectionManager();


var recordingSessionId = 0; // Is set by the front-end when pressing the 'Record' button.

//
// In order to be more flexible, we are also going to keep track globally of a few things
// such as the currently selected instrument. At the moment there is no good way to know
// server-side that an instrument is selected, unfortunately.
var currentInstrument = null;


//////////////////
// Socket management: supporting one client at a time for now
//////////////////

var secret_salt = new Date().getMilliseconds();

// Setup Socket.io authorization based on JSON Web Tokens so that we get
// authorization info from our login process:
io.use(socketioJwt.authorize({
  secret: 'superSecretYesYesYes' + secret_salt,
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
    var currentinstrumentid = null;
    
    socket_debug(socket.decoded_token.role, 'connected');
    var userinfo = socket.decoded_token;    
    
    // We want to listen for data coming in from drivers:
    var sendDataToFrontEnd = function(data) {
        socket_debug('data coming in for socket ' + socket.id, data);
        // Temporary: detect "uniqueID" key and send as 'uniqueID' message
        if (data.uniqueID) {
            socket.emit('uniqueID', data.uniqueID);
            return;
        }
        socket.emit('serialEvent', data);
    }
    
    var openInstrument = function(insid) {
        if (userinfo.role == 'operator' || userinfo.role == 'admin') {
            connectionmanager.openInstrument(insid, function(d) {
                driver = d;
                currentinstrumentid = insid;
                // Listen for data coming in from our driver
                driver.on('data',sendDataToFrontEnd);
            });
        } else
            socket_debug("Unauthorized attempt to open instrument");
    };
    
    socket.on('disconnect', function(data) {
        socket_debug('This socket got disconnected ', data);
        if (driver != null) {
            driver.removeListener('data',sendDataToFrontEnd);
        }
    });

    // Get information on the current user:
    //   - username
    //   - role
    //
    // Note: html5 UI will use this to remove some links that don't make sense
    // for certain roles, but this backend enforces access, not the HTML5 UI.
    socket.on('userinfo', function() {
        socket.emit('userinfo', userinfo);
    });

    // Open a port by instrument ID: this way we can track which
    // instrument is being used by the app.
    socket.on('openinstrument', openInstrument);
    
    socket.on('closeinstrument', function(data) {
        if (userinfo.role == 'operator' || userinfo.role == 'admin') {
            socket_debug('Instrument close request for instrument ID ' + data);
            driver.removeListener('data',sendDataToFrontEnd);
            connectionmanager.closeInstrument(data);
            currentInstrument= null;
        } else
            socket_debug("Unauthorized attempt to open instrument");
    });

    socket.on('portstatus', function(instrumentid) {
        if (instrumentid) {
            // In case we are asked to check a particular
            // instrument, we can restore the driver state
            // in case the instrument is already open.
            //
            // But if the instrumentid is different from our
            // current instrument, then we need to unsubscribe
            // to events coming from our previous instrument, as they
            // don't make sense for the new one
            if (instrumentid != currentInstrument) {
                socket_debug('We are switching to a new instrument ID: ' + instrumentid);
                if (driver) {
                    driver.removeListener('data',sendDataToFrontEnd);
                    // Clear our reference to the instrument driver, it is
                    // not relevant anymore
                    driver = null;
                }
            }
            if (connectionmanager.isOpen(instrumentid))
                openInstrument(instrumentid);
        }
        var s = {portopen: (driver)? driver.isOpen() : false,
                 recording: recorder.isRecording(),
                 streaming: (driver)? driver.isStreaming() : false};
        var ds = {};
        if (driver && driver.status)
            ds= driver.status();
        socket.emit('status', Collect(s,ds));
    });
        
    socket.on('controllerCommand', function(data) {
        if (Debug) socket_debug('Controller command: ' + data);
        driver.output(data);
    });
    
    socket.on('startrecording', function(id) {
        recorder.startRecording(id);
    });
    
    socket.on('stoprecording', function() {
        recorder.stopRecording();
    });
    
    socket.on('startlivestream', function(data) {
            driver.startLiveStream(data);
    });
    
    socket.on('stoplivestream', function() {
            driver.stopLiveStream();
    });
    
    // Request a unique identifier to our driver
    socket.on('uniqueID', function() {
        socket_debug("Unique ID requested by HTML app");
        driver.sendUniqueID();
    });

    // Return a list of serial ports available on the
    // server    
    socket.on('ports', function() {
        socket_debug('Request for a list of serial ports');
        serialport.list(function (err, ports) {
            var portlist = [];
            for (var i=0; i < ports.length; i++) {
                portlist.push(ports[i].comName);
            }
            socket.emit('ports', portlist);
        });
     });
    
    socket.on('outputs', function(instrumentId) {
        socket_debug("[server.js]  Update the outputs for this instrument");
        outputmanager.enableOutputs(instrumentId);
    });

    socket.on('driver', function(data) {
        
        if (!(userinfo.role == 'operator' || userinfo.role == 'admin')) {
            socket_debug('Unauthorized attempt to change instrument driver');
            return;
        }
        socket_debug('[Deprecated] Socket asked to select the driver (now done automatically at instrument open)');
    });
    
});
    
