/*
 * A parser for the Medcom USB Geiger dongle
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort,
    events = require('events'),
    recorder = require('../recorder.js'),
    outputmanager = require('../outputs/outputmanager.js');


var USBGeiger = function() {
        
    events.EventEmitter.call(this);

    this.name = "usbgeiger";
    
    // Set a reference to the port
    this.port = null;
    
    this.setPortRef = function(s) {
        this.port = s;
    };
        
    this.setInstrumentRef = function(i) {
    };

    // How the device is connected on the serial port            
    this.portSettings = function() {
        return  {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            parser: serialport.parsers.readline(),
        }
    };
    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    this.sendUniqueID = function() {
        // TODO: implement serial number query here
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
    
    this.format = function(data, recording) {        
        
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
            this.emit('data', jsresp);
            // Send our response to the recorder and the output manager
            // as well
            recorder.record(data);
            outputmanager.output(data);
        } catch (err) {
            console.log('Not able to parse data from device:\n' + data + '\n' + err);
        }
    };
    
    this.output = function(data) {
        console.log("[USB Geiger] Command sent to dongle: " + data);
        if (data == "TAG") {
            this.emit('data', {devicetag: 'Not supported'});
            return '\n';
        }
        return data + '\n';
    }

};

USBGeiger.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = USBGeiger;
