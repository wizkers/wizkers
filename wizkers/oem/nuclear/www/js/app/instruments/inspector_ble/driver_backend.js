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


// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    events = require('events'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var abutils = require('app/lib/abutils'),
        btleConnection = require('connections/btle');


    var parser = function (socket) {

        var self = this,
            socket = socket,
            instrumentid = null,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        /**
         *   We are redefining the parser here because we need it to work
         * in both client mode and server mode (browser + cordova + node)
         * @param {*} delimiter
         * @param {*} encoding
         */
        var readline = function (delimiter, encoding) {
            if (typeof delimiter === "undefined" || delimiter === null) { delimiter = "\r"; }
            if (typeof encoding  === "undefined" || encoding  === null) { encoding  = "utf8"; }
            // Delimiter buffer saved in closure
            var data = "";
            return function (emitter, buffer) {
              // Collect data
              data += abutils.ab2str(buffer);
              // Split collected data by delimiter
              var parts = data.split(delimiter);
              data = parts.pop();
              parts.forEach(function (part, i, array) {
                emitter.onDataReady(part);
              });
            };
        }

        var parser = readline(','); // Parse line on "comma" character

        var CUSTOM_SERVICE_UUID = '39b31fec-b63a-4ef7-b163-a7317872007f';
        var SERIAL_PORT_UUID = 'd68236af-266f-4486-b42d-80356ed5afb7';

        // This is the CPM to µSv/h conversion coefficient for the tube
        // in the Inspector.
        var conversionCoefficient = 1 / 334;

        // If possible, we want to keep track of the location of the measurement.
        var current_loc = null,
            location_status = '',
            watchid = null;


        /////////////
        // Private methods
        /////////////

        var portSettings = function () {
            return {
                service_uuid: CUSTOM_SERVICE_UUID,
                characteristic_uuid: SERIAL_PORT_UUID
            }
        };

        // Format can act on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            if (!data.value) {
                console.log('No value received');
                return;
            }
            parser(self, data.value);
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
                // We need to unsubscribe from data/status messages now
                // since the port never opened.
                if (port.off) { // If we're running on NodeJS, then we've gotta use removeListener
                    port.off('status', status);
                    port.off('data', format);
                }  else {
                    port.removeListener('status', status);
                    port.removeListener('data', format);
                }
                return;
            }
            if (stat.reconnecting != undefined) {
                // Forward the message to front-end
                self.trigger('data', {
                    reconnecting: stat.reconnecting
                });
                return;
            }
            isopen = stat.portopen;
            if (isopen && stat.services) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
                console.log('We found those services', stat.services);
                // ToDo: depending on the services we found, we can subscribe
                // to different service/characteristic UUIDs so that we can support
                // multiple versions of the Bluetooth module.
                port.subscribe({
                    service_uuid: CUSTOM_SERVICE_UUID,
                    characteristic_uuid: SERIAL_PORT_UUID
                });

                // Now regularly ask the navigator for current position and refresh map
                if (watchid == null) {
                    current_loc = null;
                    if (typeof navigator == 'undefined') // Note: Node.js requires using typeof
                        return;
                    watchid = navigator.geolocation.watchPosition(newLocation, geolocationError, {
                        maximumAge: 10000,
                        timeout: 20000,
                        enableHighAccuracy: true
                    });
                }

            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    if (port.off) // If we're running on NodeJS, then we've gotta use removeListener
                        port.off('status', status);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                    if (typeof navigator == 'undefined') // Note: Node.js requires using typeof
                        return;
                    if (watchid != null) {
                        navigator.geolocation.clearWatch(watchid);
                        watchid = null; // Nullify watchid otherwise we won't re-enable loc tracking at reopen
                    }
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
                // It seems that iOS ends up throwing a code 3 when the phone
                // is not moving. This indicates our position has not changed, so this is
                // not really an error as long as current_loc is not empty
                if (current_loc != null)
                    return;
                else
                   location_status = 'no fix (timeout)';
            } else
                location_status = err.message;
        }

        var openPort_app = function (insid) {
            var ins = instrumentManager.getInstrument();
            port = new btleConnection(ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);
        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                if (port == null)
                    port = new btleConnection(item.port, portSettings());
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };


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

        this.isStreaming = function () {
            return streaming;
        };

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // TODO: Returns the instrument GUID.
        this.sendUniqueID = function () {};

        // period in seconds
        this.startLiveStream = function (period) {};

        this.stopLiveStream = function (args) {};

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            //console.log('TX', data);
            port.write(data);
        };

        /**
         *This is called by the serial parser (see 'format' above)
         */
        this.onDataReady = function (data) {
            // Remove the comma
            data = data.replace(',', '');
            if (data.length == 0)
                return;

            var cpm = parseInt(data);
            if (cpm != undefined) {
                var response = {
                    cpm: {
                        value: cpm,
                        usv: cpm * 0.00294,
                        valid: true
                    },
                    loc: current_loc,
                    loc_status: location_status
                };
                self.trigger('data', response);
            }
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