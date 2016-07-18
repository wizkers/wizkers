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

define(function (require) {
    "use strict";

    var Backbone = require('backbone'),
        Serialport = require('serialport'), // Used for parsing only
        abutils = require('app/lib/abutils'),
        btleConnection = require('connections_btle');


    var parser = function (socket) {

        var self = this,
            socket = socket,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false,
            parser = Serialport.parsers.readline(' '); // Parse line on "space" character

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
            var ins = instrumentManager.getInstrument();
            port = new btleConnection(ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);

        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            port.off('data', format);
            port_close_requested = true;
            port.close();
        }

        this.isOpen = function () {
            return isopen;
        }

        this.isOpenPending = function () {
            return port_open_requested;
        }

        this.getInstrumentId = function (arg) {};

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

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});