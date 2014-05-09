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
 * (c) 2013 Edouard Lafargue, edouard@lafargue.name
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


/**
 *   Setup access to serial ports
 */
var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort,
    flash = require('connect-flash');



// Utility function to get a Hex dump
var Hexdump = require('./hexdump.js');
var Debug = false;


var deviceTypes = [];

// Preload the parsers we know about:

// TODO: automate this by parsing the "parsers" directory listing
var Fluke289 = require('./parsers/fluke289.js');
deviceTypes.push(Fluke289);

var Onyx = require('./parsers/safecast_onyx.js');
deviceTypes.push(Onyx);

var FCOled = require('./parsers/fried_usb_tester.js');
deviceTypes.push(FCOled);

var W433 = require('./parsers/w433.js');
deviceTypes.push(W433);

var Elecraft = require('./parsers/elecraft.js');
deviceTypes.push(Elecraft);


/**
 * Debug: get a list of available serial
 * ports on the server - we'll use this later
 * to populate options on controller settings
 * on the application
 */
serialport.list(function (err, ports) {
    ports.forEach(function(port) {
      console.log(port.comName);
      console.log(port.pnpId);
      console.log(port.manufacturer);
    });
  });

/**
 * Setup Db connection before anything else
 */
require('./db.js');
var mongoose = require('mongoose');
var Instrument = mongoose.model('Instrument');
var User = mongoose.model('User');
var Settings = mongoose.model('Settings');


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
    deviceLogs = require('./routes/logs.js');
    settings = require('./routes/settings.js'),
    backup = require('./routes/backup.js');

var app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server, { log: true });

app.configure(function () {
    app.use(express.logger('dev'));     // 'default', 'short', 'tiny', 'dev'
    app.use(express.cookieParser());    // passport authentication needs to read cookies
    app.use(express.favicon());         
    app.use(express.bodyParser({ keepExtensions: true }));
    
    app.set('view engine', 'ejs'); // Setup templating for login forms
    
    // Configure Passport
    app.use(express.session({secret: 'LKJQDHFGLKJHpiusdhfgpsidf!à§98769876654è§!ç' }));
    app.use(passport.initialize());
    app.use(passport.session());     // Persistent login sessions, makes user life easier
    app.use(flash());               // Flash messages upon login, stored in session
});



// Before starting our server, make sure we reset any stale authentication token:
Settings.findOne({}, function(err, item) {
    if (err) {
        console.log('Issue finding my own settings ' + err);
    }
    if (item == null) {
      item = new Settings(); // First run
    }
    console.log("Settings ID: " + item._id);
    item.token = "_invalid_";
    item.save(function(err) {
        if (err) {
            console.log('***** WARNING ****** Could not reset socket.io session token at server startup');
            console.log(err);
            return;
        }
        server.listen(8080);
    });
});


console.log("Listening for new clients on port 8080");
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
    // Checking this each time has a marginal performance hit on the server, but we
    // are not designed to handle huge loads since this runs on a small embedded Linux
    // or a laptop - just a couple of users altogether.
    User.find({}, function(err, users) {
      if (users.length == 0) {
        var adm = new User();
        adm.local.email = "admin";
        adm.local.password = adm.generateHash('admin');
        adm.role = 'admin';
        adm.save(function(err) {
           if (err)
              console.log("Error during first user creation");
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
    // successRedirect : '/',      // redirect to the secure profile section
    failureRedirect : '/login', // redirect back to the signup page if there is an error
    failureFlash : true         // allow flash messages
}), function(req,res) {

    // If the login process generated a flash message, go to the warning page
    // first
    var w = req.flash('warningMessage');
    console.log("Warning: " + w);
    if (w != '') {
	res.render('warning.ejs', { message: w });
	return;
    }
    // We're good: we gotta generate a json web token
    var profile = {
        username: req.user.local.email,
        role: req.user.role
    };

    // we are sending the profile in the token
    var token = jwt.sign(profile, 'superSecretYesYesYes' + secret_salt, { expiresInMinutes: 60*5 });

    // Now store our token into the settings, so that the app can get it when it starts:
    Settings.findOne({}, function(err, item) {
        if (err) {
            console.log('Issue finding my own settings ' + err);
            res.redirect('/login');
        }
        item.token = token;
        item.save(function(err) {
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
     User.findOne({ 'local.email': req.user.local.email }, function(err, record) {
         console.log(record);
         record.local.password = record.generateHash(req.body.password);
         record.save(function(err) {
             var msg  = (err) ? 'Error changing password': 'Password changed';
             res.render('profile.ejs', {user: req.user, message: msg});
         });

     });
});

app.get('/admin', isLoggedIn, user.is('admin'), function(req,res) {
    User.find({}, function(err, users) {
        res.render('admin.ejs', {user: req.user, users: users, message: '' });
    });
});
app.post('/admin', isLoggedIn, user.is('admin'), function(req,res) {
    console.log(req.body);
    User.findOne({_id: req.body.id}, function(err, user) {
        var msg = "Role updated to " + req.body.newrole + " for user " + user.local.email;
        if (err)
            msg = "Someting went wrong, no change was made.";
        
        user.role = req.body.newrole;
        user.save(function(err) {
            if (err)
                msg = "Something went wrong, no change was made.";
            User.find({}, function(err, users) {
                res.render('admin.ejs', {user: req.user, users: users, message: msg });
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
 * Interface for managing instrument logs (summary)
 */
app.get('/instruments/:id/logs', isLoggedIn, deviceLogs.findByInstrumentId);
app.post('/instruments/:id/logs', isLoggedIn, user.is('operator'), deviceLogs.addEntry);
app.get('/logs/', isLoggedIn, deviceLogs.findAll);
app.get('/logs/:id', isLoggedIn, deviceLogs.findById);
app.get('/logs/:id/entries', isLoggedIn, deviceLogs.getLogEntries);
app.post('/logs/:id/entries', isLoggedIn, user.is('operator'), deviceLogs.addLogEntry);
app.put('/instruments/:iid/logs/:id', isLoggedIn, user.is('operator'), deviceLogs.updateEntry);
app.delete('/instruments/:idd/logs/:id', isLoggedIn, user.is('operator'), deviceLogs.deleteEntry);
app.delete('/logs/:lid/entries/:id', isLoggedIn, user.is('operator'), deviceLogs.deleteLogEntry);

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
    // console.log("*** checkpoint ***");
    if (req.isAuthenticated())
        return next();
    
    // We are allowing CSS and img folders
    if (req.path.indexOf("/css") == 0)
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
    arg,
    i = 0,
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
 



//
// For now, we are supporting only one communication
// port on the server, but in the future we need to
// extend this to support multiple simultaneous
// connections to several devices.
var portsList = new Array();
var myPort = null;
var portOpen = false;

var driver = Onyx;

//
// Backend logging: we want to let the backend record stuff into
// the database by itself, so we keep a global variable for doing this
var recorder = require('./recorder.js');

var recordingSessionId = 0; // Is set by the front-end when pressing the 'Record' button.
app.get('/startrecording/:id', recorder.startRecording);
app.get('/stoprecording', recorder.stopRecording);

//
// In order to be more flexible, we are also going to keep track globally of a few things
// such as the currently selected instrument. At the moment there is no good way to know
// server-side that an instrument is selected, unfortunately.
var currentInstrument = null;


//////////////////
// Port management
//////////////////
openPort = function(data, socket) {
     //  This opens the serial port:
    if (myPort && portOpen) {
           try { 
               myPort.close();
           } catch (e) { console.log("Port close attempt error: " + e); }
	}
    
    myPort = new SerialPort(data,
                            driver.portSettings(),
                            true, 
                            function(err, result) {
                                if (err) {
                                    console.log("Open attempt error: " + err);
                                    socket.emit('status', {portopen: portOpen});
                                }
                            });    
    console.log('Result of port open attempt:'); console.log(myPort);
        
    // Callback once the port is actually open: 
   myPort.on("open", function () {
       console.log('Port open');
       myPort.flush(function(err,result){ console.log(err + " - " + result); });
       myPort.resume();
       portOpen = true;
       driver.setPortRef(myPort); // We need this for drivers that manage a command queue...
       driver.setSocketRef(socket);
       driver.setRecorderRef(recorder);
       if (driver.onOpen) {
           driver.onOpen(true);
       }
       socket.emit('status', {portopen: portOpen});
   });

    // listen for new serial data:
   myPort.on('data', function (data) {
       // if (Debug) console.log('.');
       // Pass this data to on our driver
       if (Debug) { try {
            // console.log('Raw input:\n' + Hexdump.dump(data));
           console.log("Data: " + data);
       } catch(e){}}
        driver.format(data);
   });
    
    myPort.on('error', function(err) {
        console.log("Serial port error: "  + err);
        portOpen = false;
       if (driver.onClose) {
           driver.onClose(true);
       }
        socket.emit('status', {portopen: portOpen});
    });
        
    myPort.on("close", function() {
        console.log("Port closing");
        console.log(myPort);
        portOpen = false;
       driver.setPortRef(null);
       driver.setSocketRef(null);
       driver.setRecorderRef(null);
       if (driver.onClose) {
           driver.onClose(true);
       }
        socket.emit('status', {portopen: portOpen});
    });
}



//////////////////
// Socket management: supporting one client at a time for now
//////////////////

var secret_salt = new Date().getMilliseconds();

// Setup Socket.io authorization based on JSON Web Tokens so that we get
// authorization info from our login process:
io.set('authorization', socketioJwt.authorize({
  secret: 'superSecretYesYesYes' + secret_salt,
  handshake: true,
}));

// listen for new socket.io connections:
io.sockets.on('connection', function (socket) {
    
    console.log(socket.handshake.decoded_token.role, 'connected');
    var userinfo = socket.handshake.decoded_token;
    
	// if the client connects:
	if (!connected) {
            console.log('User connected');
            connected = true;
    }
    
    // If we have an existing open port, we need to update the socket
    // reference for its driver:
    if (portOpen && driver != null) {
       driver.setSocketRef(socket);
    }
    
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
    socket.on('openinstrument', function(data) {
        if (userinfo.role == 'operator' || userinfo.role == 'admin') {
            console.log('Instrument open request for instrument ID ' + data);
            Instrument.findById(data, function(err,item) {
                currentInstrument = item;
                driver.setInstrumentRef(currentInstrument);
                openPort(item.port, socket);
            });
        } else
            console.log("Unauthorized attempt to open instrument");
    });
    
    // TODO: support multiple ports, right now we
    // discard 'data' completely.
    // I assume closing the port will remove
    // the listeners ?? NOPE! To be checked.
    socket.on('closeinstrument', function(data) {
        if (userinfo.role == 'operator' || userinfo.role == 'admin') {
            console.log('Instrument close request for instrument ID ' + data);
            Instrument.findById(data, function(err,item) {
                if(portOpen) {
                    myPort.close();
                    portOpen = false;
                }
            });
        } else
            console.log("Unauthorized attempt to open instrument");
    });

    socket.on('portstatus', function() {
        var s = {portopen: portOpen, recording: recorder.isRecording()};
        var ds = {};
        if (driver.status)
            ds= driver.status();
        socket.emit('status', Collect(s,ds));
    });
        
    socket.on('controllerCommand', function(data) {
        // TODO: do a bit of sanity checking here
        if (Debug) console.log('Controller command: ' + data);
        if (portOpen)
            myPort.write(driver.output(data));
    });
    
    // Request a unique identifier to our driver
    socket.on('uniqueID', function() {
        console.log("Unique ID requested by HTML app");
        driver.sendUniqueID();
    });

    // Return a list of serial ports available on the
    // server    
    socket.on('ports', function() {
        console.log('Request for a list of serial ports');
        serialport.list(function (err, ports) {
            var portlist = [];
            for (var i=0; i < ports.length; i++) {
                portlist.push(ports[i].comName);
            }
            socket.emit('ports', portlist);
        });
     });

    socket.on('driver', function(data) {
        
        if (!(userinfo.role == 'operator' || userinfo.role == 'admin')) {
            console.log('Unauthorized attempt to change instrument driver');
            return;
        }
        console.log('Request to update our serial driver to ' + data);
        
        // Close the serial port if it is open and the driver has changed:
        if (portOpen && data != driver.name) {
            console.log("Driver changed! closing port");
            portOpen = false;
            myPort.close();
        }
        
        socket.emit('status', {portopen: portOpen});
        
        // For now, we have only a few drivers, so let's just hardcode...
        if (data == "onyx") {
            driver = Onyx;
        } else if ( data == "fcoledv1" ) {
            driver = FCOled;
        } else if ( data == "fluke28x") {
            driver = Fluke289;
        } else if ( data == "w433") {
            driver = W433;
        } else if ( data == "elecraft") {
            driver = Elecraft;
        }
        
    });
    
});
    
