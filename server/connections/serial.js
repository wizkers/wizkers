/**
 *  Serial port connection
 *
 * Opens at create, sends 'data' events,
 * 'status' events
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var SerialPort = require('serialport').SerialPort,
    events = require('events'),
    dbs = require('../pouch-config');

//////////////////
// Serial port interface:
//////////////////
var SerialConnection = function(path, settings) {
    
    events.EventEmitter.call(this);
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
    console.log('Result of port open attempt:'); console.log(myPort);
        
    // Callback once the port is actually open: 
   myPort.on('open', function () {
       console.log('Port open');
       myPort.flush(function(err,result){ console.log(err + " - " + result); });
       myPort.resume();
       portOpen = true;
       self.emit('status', {portopen: portOpen});
   });

    // listen for new serial data:
   myPort.on('data', function (data) {
       // if (Debug) console.log('.');
       // Pass this data to on our driver
       if (Debug) { try {
            // console.log('Raw input:\n' + Hexdump.dump(data));
           console.log("Data: " + data);
       } catch(e){}}
        self.emit('data',data);
   });
    
    myPort.on('error', function(err) {
        console.log("Serial port error: "  + err);
        portOpen = false;
       if (driver.onClose) {
           driver.onClose(true);
       }
        self.emit('status', {portopen: portOpen});
    });
        
    myPort.on('close', function() {
        console.log('Port closing');
        console.log(myPort);
        portOpen = false;
       
       if (driver.onClose) {
           driver.onClose(true);
       }
        self.emit('status', {portopen: portOpen});
    });
    
    return myPort;
}

SerialConnection.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = SerialConnection;

