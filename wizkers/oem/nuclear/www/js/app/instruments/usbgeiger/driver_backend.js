/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 * Browser-side Parser for IMI USB Geiger devices.
 *
 * This Browser-side parser is used when running as a Chrome or Cordova app.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    events = require('events'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var Serialport = require('serialport'),
        serialConnection = require('connections/serial');

    var parser = function (socket) {

        /////////////
        // Private methods
        /////////////

        var socket = socket;

        var self = this,
            port = null,
            instrumentid = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        // If possible, we want to keep track of the location of the measurement.
        var current_loc = null,
            location_status = '',
            watchid = null;


        var portSettings = function () {
            return {
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: true,
                flowControl: false,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: new Serialport.parsers.Readline({ delimiter: '\r\n' }),
            }
        };

        /**
         *  Format can act on incoming data from the counter, and then
         *  forwards the data to the app through a 'serialEvent' event.
         */
        var format = function (data) {

            // All commands now return JSON
            try {
                if (data.length < 2)
                    return;
                data = data.replace('\n', '');

                var resp = data.split(':');
                var jsresp = {};
                if (resp[0] == "CPM") {
                    var inputs = parseInt(resp[1]);

                    jsresp.cpm = {
                        value: parseInt(resp[2])
                    };
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
                        jsresp.cpm2 = {
                            value: parseInt(resp[4])
                        };
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
                } else if (data.substr(0, 10) == "USB Geiger") {
                    jsresp.version = data;
                } else if (resp[0] == 'COUNTS') {
                    var inputs = parseInt(resp[1]);
                    jsresp.counts = {
                        input1: parseInt(resp[2])
                    };
                    if (inputs == 2) {
                        jsresp.counts.input2 = parseInt(resp[3]);
                        jsresp.counts.uptime = parseInt(resp[4]);
                    } else {
                        jsresp.counts.uptime = parseInt(resp[3]);
                    }
                } else if (resp[0] == 'HZ1') {
                    // Debug output
                    jsresp.HZ = {
                        I1: resp[1],
                        I2: resp[3]
                    };
                    jsresp.RAM = resp[5];
                    jsresp.WIN1 = resp[7];
                    jsresp.WIN2 = resp[9];
                } else if (resp.length > 1) {
                    jsresp[resp[0]] = resp.slice(1);
                } else {
                    jsresp.raw = data;
                }
                // Add location info to data containing a CPM information:
                if (jsresp.cpm) {
                    jsresp.loc = current_loc;
                    jsresp.loc_status = location_status;
                }
                self.trigger('data', jsresp);
            } catch (err) {
                console.log('Not able to parse data from device:\n' + data + '\n' + err);
            }
        };


        // Status returns an object that is concatenated with the
        // global server status
        var status = function (stat) {
            port_open_requested = false;
            console.log('Port status change', stat);
            if (stat.openerror) {
                // We could not open the port: warn through
                // a 'data' messages
                var resp = {
                    openerror: true
                };
                if (stat.reason != undefined)
                    resp.reason = stat.reason;
                if (stat.description != undefined)
                    resp.description = stat.description;
                self.trigger('data', resp);
                return;
            }

            isopen = stat.portopen;

            if (isopen) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
                //
                // Regularly ask the navigator for current position and refresh map
                if (typeof navigator == 'undefined') // Note: Node.js requires using typeof
                    return;
                if (watchid == null) {
                    watchid = navigator.geolocation.watchPosition(newLocation, geolocationError, {
                        maximumAge: 10000,
                        timeout: 20000,
                        enableHighAccuracy: true
                    });
                }

            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    if (port.off)
                        port.off('status', stat);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                    if (typeof navigator == 'undefined')
                        return;
                    if (watchid != null)
                        navigator.geolocation.clearWatch(watchid);
                }
            }
        };

        var newLocation = function (loc) {
            location_status = 'OK';
            current_loc = {
                coords: {
                    accuracy: loc.coords.accuracy,
                    altitude: loc.coords.altitude,
                    altitudeAccuracy: loc.coords.altitudeAccuracy,
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    heading: loc.coords.heading,
                    speed: loc.coords.speed
                }
            };
        }

        var geolocationError = function (err) {
            console.log('Location error', err);
            if (err.code == 3) {
                location_status = 'no fix (timeout)';
            } else
                location_status = err.message;
        }

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                port = new serialConnection(item.port, portSettings());
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };

        var openPort_app = function(insid) {
            var ins = instrumentManager.getInstrument();
            // We now support serial over TCP/IP sockets: if we detect
            // that the port is "TCP/IP", then create the right type of
            // tcp port:
            var p = ins.get('port');
            if (p == 'TCP/IP') {
                // Note: we just use the parser info from portSettings()
                port = new tcpConnection(ins.get('tcpip'), portSettings().parser);
            } else if (p == 'Wizkers Netlink') {
                port = new tcpConnection(ins.get('netlink'), portSettings().parser);
                proto = new Protocol();
                proto.on('data', onProtoData);
            } else if (p == 'Bluetooth') {
                port = new btConnection(ins.get('btspp'), portSettings().parser);
            } else {
                port = new serialConnection(ins.get('port'), portSettings());
            }
            port.on('data', format);
            port.on('status', status);
            port.open();
        }

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            instrumentid = insid;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid);
            }
        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            if (port.off)
                port.off('data', format);
            else
                port.removeListener('data', format);
            port_close_requested = true;
            port.close();
        }

        this.isOpen = function () {
            return isopen;
        }

        this.isOpenPending = function () {
            return port_open_requested;
        }

        this.getInstrumentId = function (arg) {
            return instrumentid;
        };

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Geiger counter GUID.
        this.sendUniqueID = function () {
            self.trigger('data', {
                uniqueID: '00000000 (n.a.)'
            });
        };

        this.isStreaming = function () {
            return true;
        };


        // period in seconds
        this.startLiveStream = function (period) {};

        this.stopLiveStream = function (args) {};

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            if (data == "TAG") {
                self.trigger('data', {
                    devicetag: 'Not supported'
                });
            }
            port.write(data + '\n');
        };

    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    if (vizapp.type != 'server') {
        // Add event management to our parser, from the Backbone.Events class:
        _.extend(parser.prototype, Backbone.Events);
    } else {
        parser.prototype.__proto__ = events.EventEmitter.prototype;
        parser.prototype.trigger = parser.prototype.emit;
    }

    return parser;
});