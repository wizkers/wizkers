/**
 * The Node.js backend server that communicates with the hardware and serves the
 * HTML web app.
 *
 * This server does several things:
 *
 * - Handles call to the various instruments on the local serial port.
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
 * Interface for managing instrument logs
 *
 */
app.get('/instruments/:id/logs', deviceLogs.findByInstrumentId);
app.post('/instruments/:id/logs', deviceLogs.addEntry);
app.get('/logs/', deviceLogs.findAll);
app.put('/instruments/:iid/logs/:id', deviceLogs.updateEntry);
app.delete('/instruments/:idd/logs/:id', deviceLogs.deleteEntry);


/**
 * Interface for managing the cars
 */
/*
app.get('/cars', cars.findAll);
app.get('/cars/:id', cars.findById);
app.post('/cars', cars.addCar);
app.post('/cars/:id/picture', cars.uploadPic);
app.put('/cars/:id', cars.updateCar);
app.delete('/cars/:id', cars.deleteCar);
*/

/**
 * Interface for managing the layouts
 */
/*
app.get('/layouts', layouts.findAll);
app.get('/layouts/:id', layouts.findById);
app.post('/layouts', layouts.addLayout);
app.put('/layouts/:id', layouts.updateLayout);
app.post('/layouts/:id/picture', layouts.uploadPic);
app.delete('/layouts/:id', layouts.deleteLayout);
*/

/**
 * Interface for managing controllers
 */
/*
app.get('/controllers', controllers.findAll);
app.get('/controllers/:id', controllers.findById);
app.post('/controllers', controllers.addController);
app.put('/controllers/:id', controllers.updateController);
app.delete('/controllers/:id', controllers.deleteController);
*/

/**
 * Interface for managing accessories
 */
/*
app.get('/accessories', accessories.findAll);
app.get('/accessories/:id', accessories.findById);
app.post('/accessories', accessories.addAccessory);
app.put('/accessories/:id', accessories.updateAccessory);
app.delete('/accessories/:id', accessories.deleteAccessory);
*/

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
// port on the server, but in the future we could
// extend this to support multiple simultaneous
// connections to several devices.
var portsList = new Array();
var myPort = null;
var portOpen = false;

var driver = Onyx;



// listen for new socket.io connections:
io.sockets.on('connection', function (socket) {
	// if the client connects:
	if (!connected) {
            console.log('User connected');
            connected = true;
    }

    // if the client disconnects, we close the 
    // connection to the controller:
    socket.on('disconnect', function () {
        console.log('User disconnected');
        console.log('Closing port');
        if (myPort)
            myPort.close();
        connected = false;
        portOpen = false;
    });
    
    socket.on('openport', function(data) {
        console.log('Port open request for port name ' + data);
        // data contains connection type: IP or Serial
        // and the port name or IP address.
        // It also contains the type of parser (TODO)
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
    });
        
    socket.on('closeport', function(data) {
        // TODO: support multiple ports, right now we
        // discard 'data' completely.
        // I assume closing the port will remove
        // the listeners ?? NOPE!
        console.log('Closing port');
        if (myPort) {
            myPort.close();
           portOpen = false;
        }
    });
    
    socket.on('portstatus', function() {
        socket.emit('status', {portopen: portOpen});
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
        
        // Close the serial port if it is open:
        if (myPort) {
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
        }
        
    });
    
});
