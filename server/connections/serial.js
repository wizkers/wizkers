/**
 *  Serial port connection
 *
 * Opens at create, sends 'data' events,
 * and 'status' events.
 *
 * Supports a "write" method.
 *
 * At this point, this is just a simple wrapper around
 * serialport, it just gives us a bit of abstraction in
 * case we want to implement other kinds of connections/drivers
 * later on.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var serialport = require('serialport'),
    SerialPort = serialport.SerialPort,
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    dbs = require('../pouch-config');

var Debug = false;

//////////////////
// Serial port interface:
//////////////////
var SerialConnection = function(path, settings) {
    
    EventEmitter.call(this);
    var portOpen = false;
    var self = this;

    var myPort = new SerialPort(path,
                            settings,
                            true, 
                            function(err, result) {
                                if (err) {
                                    console.log("Open attempt error: " + err);
                                    self.emit('status', {portopen: portOpen});
                                }
                            });    
    
    this.write = function(data) {
        myPort.write(data);
    }
    
    this.close = function() {
        myPort.close();
    }
        
    // Callback once the port is actually open: 
   myPort.on('open', function () {
       myPort.flush(function(err,result){ console.log(err + " - " + result); });
       myPort.resume();
       portOpen = true;
       console.log('Port open');
       self.emit('status', {portopen: portOpen});
   });

    // listen for new serial data:
   myPort.on('data', function (data) {
       if (Debug) { try {
           console.log("Data: ", data[0]);
       } catch(e){}}
        self.emit('data',data);
   });
    
    myPort.on('error', function(err) {
        console.log("Serial port error: "  + err);
        portOpen = false;
        self.emit('status', {portopen: portOpen});
    });
        
    myPort.on('close', function() {
        console.log('Port closing');
        console.log(myPort);
        portOpen = false;
        self.emit('status', {portopen: portOpen});
    });
    
    return this;
}

util.inherits(SerialConnection, EventEmitter);

module.exports = SerialConnection;

