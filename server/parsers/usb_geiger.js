/*
 * A parser for the Medcom USB Geiger dongle
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var serialport = require('serialport'),
    events = require('events'),
    recorder = require('../recorder.js'),
    serialconnection = require('../connections/serial');
    outputmanager = require('../outputs/outputmanager.js'),
    debug = require('debug')('parsers:usb_geiger');


var USBGeiger = function() {
    
    // Driver initialization
    events.EventEmitter.call(this);
    
    /////////
    // Private variables
    /////////
    var port = null;
    var isopen = false;
    var port_close_requested = false;
    var self = this;

    /////////
    // Private methods
    /////////

    var status = function(stat) {
        debug('Port status change', stat);
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
        // All commands now return JSON
        try {
            if (data.length < 2)
                return;
            data = data.replace('\n','');
            
            var resp = data.split(':');
            var jsresp = {};
            if (resp[0] == "CPM") {
                var inputs = parseInt(resp[1]);
                
                jsresp.cpm = { value: parseInt(resp[2]) };
                switch (resp[3]) {
                        case 'X':
                        jsresp.cpm.valid = false;
                        break;
                        case 'V':
                        jsresp.cpm.valid = true;
                        break;
                        default:
                        break;
                }
                if (inputs == 2) {
                    jsresp.cpm2 = { value: parseInt(resp[4]) };
                    switch (resp[5]) {
                            case 'X':
                            jsresp.cpm2.valid = false;
                            break;
                            case 'V':
                            jsresp.cpm2.valid = true;
                            break;
                            default:
                            break;
                    }
                }
            } else if (data.substr(0,10) == "USB Geiger") {
                jsresp.version = data;
            } else if (resp[0] == 'COUNTS') {
                var inputs = parseInt(resp[1]);
                jsresp.counts = { input1: parseInt(resp[2])};
                if (inputs == 2) {
                    jsresp.counts.input2 = parseInt(resp[3]);
                    jsresp.counts.uptime = parseInt(resp[4]);
                } else {
                    jsresp.counts.uptime = parseInt(resp[3]);
                }   
            }else if (resp.length > 1) {
                jsresp[resp[0]] = resp.slice(1);
            } else {
                jsresp.raw = data;
            }
            // Send the response to the front-end
            // Why 'self' below ?
            // 'format' is called as a callback by the serial port, so
            // 'this' is the serial object, not this driver!
            self.emit('data', jsresp);
            // Send our response to the recorder and the output manager
            // as well
            recorder.record(jsresp);
            outputmanager.output(jsresp);
        } catch (err) {
            debug('Not able to parse data from device:\n' + data + '\n' + err);
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
            parser: serialport.parsers.readline(),
        }
    };

    
    /////////
    // Public variables
    /////////
    this.name = "usbgeiger";
    
    /////////
    // Public API
    /////////
    
    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    this.openPort = function(path) {
        port = new serialconnection(path, portSettings());
        port.on('data', format);
        port.on('status', status);
    }
    
    this.closePort = function(data) {
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        port.removeListener('data', format);
        port_close_requested = true;
        port.close();
    }
        
    this.setInstrumentRef = function(i) {
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
    
    this.isOpen = function() {
        return isopen;
    }
        
    this.output = function(data) {
        debug("[USB Geiger] Command sent to dongle: " + data);
        if (data == "TAG") {
            this.emit('data', {devicetag: 'Not supported'});
            return '\n';
        }
        port.write(data + '\n');
    }

};

USBGeiger.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = USBGeiger;
