/*
 * A parser for the SafeCast Onyx.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 * Only works on the current devel branch with json-compliant
 * serial output.
 */

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort,
    recorder = require('../recorder.js'),
    events = require('events'),
    outputmanager = require('../outputs/outputmanager.js');

var Onyx = function() {
    
    // Init the EventEmitter
    events.EventEmitter.call(this);

    /////////
    // Public variables
    /////////    
    this.name = "onyx";
    
    /////////
    // Private variables
    /////////    
    var port = null;
    var isopen = false;
    var port_close_requested = false;
    var self = this;

    var uidrequested = false;
    var streaming = false;
    var livePoller = null;
    
    /////////
    // Private methods
    /////////

    var status = function(stat) {
        console.log('[onyx] Port status change', stat);
        isopen = stat.portopen;
        
        if (isopen) {
            // Should run any "onOpen" initialization routine here if
            // necessary.
        } else {
            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                port.removeListener('status', status);
                port_close_requested = false;
            }
        }
    };

    // How the device is connected on the serial port            
    var portSettings = function() {
        return  {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            // simply pass each line to our JSON streaming parser
            // Note: the Onyx outputs json with \n at the end, so
            // the default readline parser works fine (it separates on \r)
            parser: serialport.parsers.readline()
        }
    };
    
    var format = function(data) {
        // All commands now return JSON
        try {
            //console.log(Hexdump.dump(data.substr(0,5)));
            if (data.substr(0,2) == "\n>")
                return;
            if (data.length < 2)
                return;
            var response = JSON.parse(data);
            if (this.uidrequested && response.guid != undefined) {
                this.socket.emit('data',{uniqueID: response.guid});
                this.uidrequested = false;
            } else {
                // Send the response to the front-end
                self.emit('data', response);
                // Send our response to the recorder and the output manager
                // as well
                recorder.record(response);
                outputmanager.output(response);
            }
        } catch (err) {
            console.log('Not able to parse JSON response from device:\n' + data);
            console.log('Error code: ' + err);
        }
    };

    

    /////////
    // Public methods
    /////////
    
    this.setInstrumentRef = function(i) {
    };

    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same
    this.sendUniqueID = function() {
        this.uidrequested = true;
        this.port.write(this.output('{ "get": "guid" }'));
    };
    
    this.isStreaming = function() {
        return this.streaming;
    };
    
    this.startLiveStream = function(period) {
        var self = this;
        if (!this.streaming) {
            console.log("[Onyx] Starting live data stream");
            this.livePoller = setInterval(function() {
                        self.port.write(self.output('GETCPM'));
                    }, (period) ? period*1000: 1000);
            this.streaming = true;
        }
    };
    
    this.stopLiveStream = function(period) {
        if (this.streaming) {
            console.log("[Onyx] Stopping live data stream");
            clearInterval(this.livePoller);
            this.streaming = false;
        }
    };
        
    this.output = function(data) {
        port.write(data + '\n\n');
    };

};

Onyx.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Onyx;
