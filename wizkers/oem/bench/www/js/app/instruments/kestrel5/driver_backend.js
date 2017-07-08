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
    DataView = require('buffer-dataview'), // Important for compatibility
    events = require('events'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var Serialport = require('serialport'), // Used for parsing only
        abutils = require('app/lib/abutils'),
        btleConnection = require('connections/btle');


    var parser = function (socket) {

        var self = this,
            socket = socket,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        // We have to have those in lowercase
        var KESTREL_SERVICE_UUID  = '03290000-eab4-dea1-b24e-44ec023874db';
        var WX1_UUID     = '03290310-eab4-dea1-b24e-44ec023874db';
        var WX2_UUID     = '03290320-eab4-dea1-b24e-44ec023874db';
        var WX3_UUID     = '03290330-eab4-dea1-b24e-44ec023874db';

        // small utility to convert DDMM.MMM or DDDMM.MMM to decimal
        var parseDecDeg = function (c, hemi) {
            var i = c.indexOf('.');
            var deg = c.substring(0, i - 2);
            var decMin = c.substring(i - 2, c.length - 1);
            var decDeg = parseInt(deg, 10) + (decMin / 60);
            if (hemi === 'W' || hemi === 'S')
                decDeg *= -1;
            return decDeg;
        };


        /////////////
        // Private methods
        /////////////

        var portSettings = function () {
            return {
                service_uuid: KESTREL_SERVICE_UUID,
                characteristic_uuid: WX1_UUID
            }
        };

        // Format can act on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            if (!data.value || !data.uuid) {
                debug('No value or uuid received');
                return;
            }
            // console.log(data);
            var dv = new DataView(data.value);
            if (data.uuid ==  WX1_UUID.replace(/-/gi,'')) {
                var windspeed = dv.getInt16(0, true);
                var temp = dv.getInt16(2, true);
                var rh = dv.getInt16(6, true);
                var pressure = dv.getInt16(8,true);
                var compass = dv.getInt16(10,true);

                var jsresp = {
                    temperature: temp/100,
                    rel_humidity: rh/100,
                    pressure: pressure/10,
                    compass_mag: compass,
                    wind: { dir: compass, speed: windspeed*1.94384/1000},
                    unit: {
                        temperature: 'celsius',
                        rel_humidity: '%',
                        barometer: 'mb',
                        compass_mag: 'degree',
                        wind: { dir: 'degree', speed: 'knots'}
                    }
                };

                // debug(jsresp);
                self.trigger('data', jsresp);
                return;
            }

            if (data.uuid ==  WX2_UUID.replace(/-/gi,'')) {
                var compass2 = dv.getInt16(0, true);
                // Todo: byte 6 is probably part of altitude
                var altitude = dv.getInt16(4, true);
                var barometer = dv.getInt16(7, true);
                var dens_altitude = dv.getInt16(14, true);
                var xwind = dv.getInt16(9, true);
                var hwind = dv.getInt16(11, true);

                var jsresp = {
                    compass_true: compass2,
                    altitude: altitude/10,
                    dens_altitude: dens_altitude/10,
                    barometer: barometer /10,
                    crosswind: xwind/1000,
                    headwind: hwind/1000,

                    unit: {
                        compass2: 'degree',
                        altitude: 'm',
                        dens_altitude: 'm',
                        barometer: 'mb',
                        crosswind: 'm/s',
                        headwind: 'm/s'

                    }
                };

                // debug(jsresp);
                self.trigger('data', jsresp);
                return;
            }

            if (data.uuid ==  WX3_UUID.replace(/-/gi,'')) {
                var dew_point = dv.getInt16(0, true);
                var heat_index = dv.getInt16(2, true);
                var wetbulb = dv.getInt16(16, true);
                var chill = dv.getInt16(18, true);

                var jsresp = {
                    dew_point: dew_point/100,
                    heat_index: heat_index/100,
                    wetbulb: wetbulb/100,
                    wind_chill: chill/100,
                    unit: {
                        dew_point: 'celsius',
                        heat_index: 'celsius',
                        wetbulb: 'celsius',
                        wind_chill: 'celsius'

                    }
                };
                self.trigger('data', jsresp);
                return;
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
            if (stat.reconnecting != undefined) {
                // Forward the message to front-end
                self.trigger('data', {reconnecting:stat.reconnecting});
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
                    service_uuid: KESTREL_SERVICE_UUID,
                    characteristic_uuid: [ WX1_UUID, WX2_UUID, WX3_UUID ]
                });
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    if (port.off)
                        port.off('status', status);
                    else
                        port.removeListener('status', status);

                    port_close_requested = false;
                }
            }
        };

        var openPort_app = function (insid) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            if (port == null) {
                port = new btleConnection(item.port, portSettings());
            } else {
                console.log("Already have a driver, reusing it");
            }
            port.open();
            port.on('data', format);
            port.on('status', status);
        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                if (port == null) {
                    port = new btleConnection(item.port, portSettings());
                } else {
                    console.log("Already have a driver, reusing it.");
                }
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