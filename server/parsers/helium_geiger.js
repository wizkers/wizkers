/*
 * A parser for the Medcom USB Geiger dongle
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var events = require('events'),
    recorder = require('../recorder.js'),
    heliumconnection = require('../connections/helium'),
    outputmanager = require('../outputs/outputmanager.js'),
    dbs = require('../pouch-config'),
    debug = require('debug')('wizkers:parsers:helium_geiger');


var HeliumGeiger = function() {
    
    // Driver initialization
    events.EventEmitter.call(this);
    
    /////////
    // Private variables
    /////////
    var port = null;
    var isopen = false;
    var port_close_requested = false;
    var self = this;
    var instrumentid;
    var heliuminfo;

    /////////
    // Private methods
    /////////

    var status = function(stat) {
        debug('Network status change', stat);
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
    
    // Format is called as a callback by the serial port, so
    // 'this' is the serial object, not this driver!
    var format = function(data) {
        var jsresp;
        debug(data);
        switch (data.message[0]) {
                case 0: // CPM Message
                    jsresp = { cpm: { value: data.message[1], valid: data.message[2] },
                    cpm2: { value: data.message[3], valid: data.message[4] }
                   };
                    break;
                case 1: // COUNT Message
                    jsresp = {counts : { input1: data.message[1],
                                     input2: data.message[2],
                                     uptime: data.message[3]
                                    }
                             };
                    break;
                case 2: // String: parse like a Geiger Link
                    jsresp = {};
                    var resp = data.message[1].split(':');
                    if (data.message[1].substr(0,10) == "Geiger Link") {
                        jsresp.version = data.message[1];
                    } else if (resp.length > 1) {
                        jsresp[resp[0]] = resp.slice(1);
                    } else {
                        jsresp.raw = data;
                    }
                    break;
        }
        self.emit('data', jsresp);
        // Send our response to output manager
        // as well
        outputmanager.output(jsresp);
    };

    /////////
    // Public variables
    /////////
    this.name = "heliumgeiger";
    
    /////////
    // Public API
    /////////
    
    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    this.openPort = function(id) {
        instrumentid = id;
        dbs.instruments.get(id, function(err,item) {
            heliuminfo = item.helium; // Save for later use (close esp.)
            port = new heliumconnection(item.helium);
            port.on('data', format);
            port.on('status', status);
            port.open();
        });
    }
    
    this.closePort = function(data) {
        if (!isopen)
            return;
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        port.removeListener('data', format);
        port_close_requested = true;
        port.close(heliuminfo.mac);
    }
    
    this.isOpen = function() {
        return isopen;
    }
    
    this.getInstrumentId = function(format) {
        return instrumentid;
    };

    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    this.sendUniqueID = function() {
        this.emit('data', { uniqueID:'00000000 (n.a.)'});
    };
    
    this.isStreaming = function() {
        return true;
    };
    
    // This dongle always outputs CPM value on the serial port
    this.startLiveStream = function(period) {
    };
    
    // Even though we ask to stop streaming, the dongle will still
    // stream.
    this.stopLiveStream = function(period) {
    };
    
        
    this.output = function(data) {
        debug("Command sent to dongle: " + data);
        if (data == "TAG") {
            this.emit('data', {devicetag: 'Not supported'});
            return '\n';
        }
        port.write(data + '\n');
    }

};

HeliumGeiger.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = HeliumGeiger;
