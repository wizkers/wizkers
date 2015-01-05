/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Browser-side Parser for IMI USB Geiger devices.
 *
 * This Browser-side parser is used when running as a Chrome or Cordova app.
 * 
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";

    var Serialport = require('serialport');
    
    var parser = function(socket) {
        
        var socket = socket;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = true;
        
        this.isStreaming = function() {
            return streaming;
        };
        
        this.portSettings = function() {
            return  {
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: false,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: Serialport.parsers.readline(),
            }
        };

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Geiger counter GUID.
        this.sendUniqueID = function() {
            socket.trigger('uniqueID','00000000 (n.a.)');
        };
        
        // period in seconds
        this.startLiveStream = function(period) {
            streaming = true;
        };
        
        this.stopLiveStream = function(args) {
            streaming = true;

        };
        
        // Format can act on incoming data from the counter, and then
        // forwards the data to the app through a 'serialEvent' event.
        this.format = function(data) {

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
            socket.sendDataToFrontend(jsresp);
            } catch (err) {
                console.log('Not able to parse data from device:\n' + data + '\n' + err);
            }
            
        };
    
        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function(data) {
            if (data == "TAG") {
                socket.emit('serialEvent', {devicetag: 'Not supported'});
                return '\n';
            }
            return data + '\n';
        };
        
        // Status returns an object that is concatenated with the
        // global server status
        this.status = function() {
            return { tcpserverconnect: false };
        };
    
        // Not used
        this.onOpen =  function(success) {
            console.log("USB Geiger in-browser Driver: got a port open signal");
        };
    
        // Not used
        this.onClose = function(success) {
            console.log("USB Geiger in-browser Driver: got a port close signal");
        };

    }
    
    return parser;
});