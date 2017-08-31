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


        var self = this,
            socket = socket,
            instrumentid = null,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false,
            rlparser = readline('\n');

        var CUSTOM_SERVICE_UUID  = 'ef080d8c-c3be-41ff-bd3f-05a5f4795d7f';
        var SERIAL_PORT_UUID     = 'a1e8f5b1-696b-4e4c-87c6-69dfe0b0093b';

        var v200_service_uuid     = '067978ac-b59f-4ec9-9c09-2ab6e5bdad0b';
        var v200_serial_port_uuid = '067978ac-b99f-4ec9-9c09-2ab6e5bdad0b';

        // This is the CPM to µSv/h conversion coefficient for the tube
        // in the bGeigie. This is the default bGeigie value
        var conversionCoefficient = 1/334;

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
            rlparser(self, data.value);
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
                var s_uuid = '';
                var c_uuid = '';
                for (var i in stat.services) {
                    // Note: some api calls return upper case UUIDs, some lowercase, there is
                    // apparently no consistency...
                    var  s = stat.services[i].uuid.toLowerCase().replace(/-/gi,'');
                    if (s === CUSTOM_SERVICE_UUID.replace(/-/gi,'')) {
                        s_uuid = CUSTOM_SERVICE_UUID;
                        c_uuid = SERIAL_PORT_UUID;
                        if (typeof stats != 'undefined') // No Google Analytics in Server mode
                            stats.instrumentEvent('blebee_version', 'v2.0.1');
                        self.trigger('data', { blebee_version: 'v2.0.1'});
                        break;
                    } else if (s === v200_service_uuid.replace(/-/gi,'')) {
                        s_uuid = v200_service_uuid;
                        c_uuid = v200_serial_port_uuid;
                        if (typeof stats != 'undefined')
                            stats.instrumentEvent('blebee_version', 'v2.0.0');
                        self.trigger('data', { blebee_version: 'v2.0.0'});
                        break;
                    }
                }

                debug('Subscribing to:', s_uuid, c_uuid);

                port.subscribe({
                    service_uuid: s_uuid,
                    characteristic_uuid: c_uuid
                });

            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    if (port.off) // If we're running on NodeJS, then we've gotta use removeListener
                        port.off('status', status);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                }
            }
        };

        var openPort_app = function (insid) {
            var ins = instrumentManager.getInstrument();
            port = new btleConnection(ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);
        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                debug('BLEBee UUID', item.port);
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
         * For some mysterious reason, the bGeigie outputs an NMEA-like
         * sentence, which is very 90's like, but mostly a pain.
         *
         * The Safecast API wants this NMEA data, so we will keep it intact
         * in our own database for easy log export, but add a JSON copy for
         * ease of use for a couple of fields.
         */
        this.onDataReady = function (data) {

            debug('onDataReady', data);
            // Remove any carriage return
            data = data.replace('\r\n', '');
            var fields = data.split(',');
            if (fields[0] != '$BNRDD') {
                console.log('Unknown bGeigie sentence');
                self.trigger('data', { error: "Err. Data" });
                return;
            }

            // Since we have a checksum, check it
            var chk = 0;
            for (var i = 1; i < data.indexOf('*'); i++) {
                chk = chk ^ data.charCodeAt(i);
            }
            var sum = parseInt(data.substr(data.indexOf('*')+1), 16);
            if ( chk != sum) {
                self.trigger('data', { error: "Err. Checksum" });
                return;
            }


            var cpm = parseInt(fields[3]);
            var lat = parseDecDeg(fields[7], fields[8]);
            var lng = parseDecDeg(fields[9], fields[10]);
            var sats = parseInt(fields[13]);

            var response = {
                cpm: {
                    value: cpm,
                    count: parseInt(fields[5]),
                    usv: cpm * conversionCoefficient,
                    valid: fields[6] == 'A'
                },
                nmea: data,
                batt_ok: false,
                loc: {
                    coords: {
                        latitude: lat,
                        longitude: lng
                    },
                    sats: sats
                },
                loc_status: (fields[12] == 'A') ? 'OK' : 'No GPS Lock'
            };

            self.trigger('data', response);
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