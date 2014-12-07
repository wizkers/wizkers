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
    debug = require('debug')('wizkers:connections:serial'),
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
                                    debug("Open attempt error: " + err);
                                    self.emit('status', {portopen: portOpen});
                                }
                            });    
    
    this.write = function(data) {
        try {
            myPort.write(data);
        } catch (err) {
            debug('Port write error! ' + err);
        }
    }
    
    this.close = function() {
        myPort.close();
    }
        
    // Callback once the port is actually open: 
   myPort.on('open', function () {
       myPort.flush(function(err,result){ debug(err + " - " + result); });
       myPort.resume();
       portOpen = true;
       debug('Port open');
       self.emit('status', {portopen: portOpen});
   });

    // listen for new serial data:
   myPort.on('data', function (data) {
        self.emit('data',data);
   });
    
    myPort.on('error', function(err) {
        debug("Serial port error: "  + err);
        portOpen = false;
        self.emit('status', {portopen: portOpen});
    });
        
    myPort.on('close', function() {
        debug('Port closing');
        debug(myPort);
        portOpen = false;
        self.emit('status', {portopen: portOpen});
    });
    
    return this;
}

util.inherits(SerialConnection, EventEmitter);

module.exports = SerialConnection;

