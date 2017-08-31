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
 * Browser-side Parser for IMI Onyx devices.
 *
 * This Browser-side parser is used when running as a Chrome or Cordova app.
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var Backbone = require('backbone'),
        Serialport = require('serialport'),
        serialConnection = require('connections/serial'),
        abutils = require('app/lib/abutils');

    var parser = function (socket) {

        var self = this,
            socket = socket,
            instrumentid = null,
            livePoller = null, // Reference to the live streaming poller
            streaming = false,
            uidrequested = false,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false,
            current_loc = null,
            location_status = '',
            watchid = null;

        /////////////
        // Private methods
        /////////////

        var portSettings = function () {
            return {
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: true,
                flowControl: false,
                parser: new Serialport.parsers.Readline({ delimiter: '\r\n' }),
            }
        };

        // Format can act on incoming data from the counter, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            //console.log('RX', data);

            // All commands now return JSON
            try {
                if (data.substr(0, 2) == "\n>")
                    return;
                if (data.length < 3)
                    return;
                var response = JSON.parse(data);
                if (uidrequested && response.guid != undefined) {
                    self.trigger('data', {
                        uniqueID: response.guid
                    });
                    uidrequested = false;
                } else {
                    // Add geolocation information to the response
                    response['loc'] = current_loc;
                    response['loc_status'] = location_status;
                    self.trigger('data', response);
                }
            } catch (err) {
                console.log('Not able to parse JSON response from device:\n' + data + '\n' + err);
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
                // Now regularly ask the navigator for current position and refresh map
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
                    port.off('status', stat);
                    port_close_requested = false;
                    if (watchid != null)
                        navigator.geolocation.clearWatch(watchid);
                }
            }
        };

        var newLocation = function (loc) {
            location_status = 'OK';
            // loc is an object with functions, not a pure JSON
            // structure, which causes issues w/ indexeddb, so we copy
            // just what we want into current loc - also saves storage space
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



        /////////////
        // Public methods
        /////////////


        this.openPort = function (insid) {
            port_open_requested = true;
            instrumentid = insid;
            var ins = instrumentManager.getInstrument();
            port = new serialConnection(ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);

        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            port.off('data', format);
            // If we are streaming, stop it!
            // The Home view does this explicitely, but if we switch
            // instrument while it is open, then it's up to the driver to do it.
            if (streaming)
                this.stopLiveStream();

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

        this.isStreaming = function () {
            return streaming;
        };


        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Geiger counter GUID.
        this.sendUniqueID = function () {
            uidrequested = true;
            this.output('{ "get": "guid" }');
        };

        // period in seconds
        this.startLiveStream = function (period) {
            var self = this;
            if (!streaming) {
                livePoller = setInterval(function () {
                    self.output('GETCPM');
                }, (period) ? period * 1000 : 1000);
                streaming = true;
            }
        };

        this.stopLiveStream = function (args) {
            if (streaming) {
                console.log("Stopping live data stream");
                clearInterval(livePoller);
                streaming = false;
            }
        };

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            //console.log('TX', data);
            port.write(data + '\n\n');
        };


    }

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});