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
    SerialPort  = serialport.SerialPort;



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
    io = require('socket.io').listen(server, { log: false });

app.configure(function () {
    app.use(express.logger('dev'));     /* 'default', 'short', 'tiny', 'dev' */
    app.use(express.favicon()); // Test please
    app.use(express.bodyParser({ keepExtensions: true }));
});

server.listen(8080);
console.log("Listening for new clients on port 8080");
var connected = false;

/**
 * Interface for managing instruments
 */
app.get('/instruments', instruments.findAll);
app.get('/instruments/:id', instruments.findById);
app.post('/instruments', instruments.addInstrument);
app.post('/instruments/:id/picture', instruments.uploadPic);
app.put('/instruments/:id', instruments.updateInstrument);
app.delete('/instruments/:id', instruments.deleteInstrument);

/**
 * Interface for managing instrument logs (summary)
 *
 */
app.get('/instruments/:id/logs', deviceLogs.findByInstrumentId);
app.post('/instruments/:id/logs', deviceLogs.addEntry);
app.get('/logs/', deviceLogs.findAll);
app.get('/logs/:id', deviceLogs.findById);
app.get('/logs/:id/entries', deviceLogs.getLogEntries);
app.post('/logs/:id/entries', deviceLogs.addLogEntry);
app.put('/instruments/:iid/logs/:id', deviceLogs.updateEntry);
app.delete('/instruments/:idd/logs/:id', deviceLogs.deleteEntry);


/**
 * Interface for our settings. Only one settings object,
 * so no getting by ID here
 */
app.get('/settings', settings.getSettings);
app.put('/settings/:id', settings.updateSettings);

/**
 * Interface for triggering a backup and a restore
 */
app.get('/backup', backup.generateBackup);
app.post('/restore', backup.restoreBackup);


// Our static resources are in 'public'
// GET /javascripts/jquery.js
// GET /style.css
// GET /favicon.ico
app.use(express.static(__dirname + '/public'));

// TODO:
//
//  - Create a route to get the list of all device types in JSON, with index

//app.get('/protocols', '');


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
        if (myPort)
            myPort.close();
        myPort = new SerialPort(data, driver.portSettings);
        myPort.flush();
        console.log('Result of port open attempt: ' + myPort);
        
        // Callback once the port is actually open: 
       myPort.on("open", function () {
           console.log('Port open');
           portOpen = true;
           driver.setPortRef(myPort); // We need this for drivers that manage a command queue...
           driver.setSocketRef(socket);
           driver.setRecorderRef(recorder);
           socket.emit('status', {portopen: portOpen});
           // listen for new serial data:
           myPort.on('data', function (data) {
               // Pass this data to on our driver
               if (Debug) console.log('Raw input:\n' + Hexdump.dump(data));
                driver.format(data);
           });
       });
        
        myPort.on("close", function() {
            portOpen = false;
            socket.emit('status', {portopen: portOpen});
        });
   
}



//////////////////
// Socket management: supporting one client at a time for now
//////////////////


// listen for new socket.io connections:
io.sockets.on('connection', function (socket) {
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

    // if the client disconnects, we close the 
    // connection to the device.
    // TODO: actually... we should just remain open in case we are
    // recording...

    /**
    socket.on('disconnect', function () {
        console.log('User disconnected');
        console.log('Closing port');
        if (myPort)
            myPort.close();
        connected = false;
        portOpen = false;
    });
    */
    
    
    // Open a port by instrument ID: this way we can track which
    // instrument is being used by the app.
    socket.on('openinstrument', function(data) {
        console.log('Instrument open request for instrument ID ' + data);
        Instrument.findById(data, function(err,item) {
            currentInstrument = item;
            driver.setInstrumentRef(currentInstrument);
            openPort(item.port, socket);
        });
    });
    
    // TODO: support multiple ports, right now we
    // discard 'data' completely.
    // I assume closing the port will remove
    // the listeners ?? NOPE! To be checked.
    socket.on('closeinstrument', function(data) {
        console.log('Instrument close request for instrument ID ' + data);
        Instrument.findById(data, function(err,item) {
            if(myPort) {
                myPort.close();
                portOpen = false;
            }
        });
        
    });
        
    socket.on('portstatus', function() {
        socket.emit('status', {portopen: portOpen,
                               recording: recorder.isRecording()});
    });
        
    socket.on('controllerCommand', function(data) {
        // TODO: do a bit of sanity checking here
        console.log('Controller command: ' + data);
        if (myPort)
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
        console.log('Request to update our serial driver to ' + data);
        
        // Close the serial port if it is open and the driver has changed:
        if (myPort && data != driver.name) {
            console.log("Driver changed! closing port");
            myPort.close();
            portOpen = false;
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
        }
        
    });
    
});
