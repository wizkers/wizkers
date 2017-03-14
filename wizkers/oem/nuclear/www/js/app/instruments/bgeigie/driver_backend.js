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
            parser = Serialport.parsers.readline('\n');

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
                    if (stat.services[i].uuid.toLowerCase() == CUSTOM_SERVICE_UUID) {
                        s_uuid = CUSTOM_SERVICE_UUID;
                        c_uuid = SERIAL_PORT_UUID;
                        stats.instrumentEvent('blebee_version', 'v2.0.1');
                        self.trigger('data', { blebee_version: 'v2.0.1'});
                        break;
                    } else if (stat.services[i].uuid.toLowerCase() == v200_service_uuid) {
                        s_uuid = v200_service_uuid;
                        c_uuid = v200_serial_port_uuid;
                        stats.instrumentEvent('blebee_version', 'v2.0.0');
                        self.trigger('data', { blebee_version: 'v2.0.0'});
                        break;
                    }
                }

                port.subscribe({
                    service_uuid: s_uuid,
                    characteristic_uuid: c_uuid
                });

            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    port.off('status', stat);
                    port_close_requested = false;
                }
            }
        };


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
         * For some mysterious reason, the bGeigie outputs an NMEA-like
         * sentence, which is very 90's like, but mostly a pain.
         *
         * The Safecast API wants this NMEA data, so we will keep it intact
         * in our own database for easy log export, but add a JSON copy for
         * ease of use for a couple of fields.
         */
        this.onDataReady = function (data) {
            // Remove any carriage return
            data = data.replace('\r\n', '');
            var fields = data.split(',');
            if (fields[0] != '$BNRDD') {
                console.log('Unknown bGeigie sentence');
                return;
            }

            // Since we have a checksum, check it
            var chk = 0;
            for (var i = 1; i < data.indexOf('*'); i++) {
                chk = chk ^ data.charCodeAt(i);
            }
            var sum = parseInt(data.substr(data.indexOf('*')+1), 16);
            if ( chk != sum)
                return;


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

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});