/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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

        var CUSTOM_SERVICE_UUID = 'ef080d8c-c3be-41ff-bd3f-05a5f4795d7f';
        var SERIAL_PORT_UUID = 'A1E8F5B1-696B-4E4C-87C6-69DFE0B0093B';

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
            isopen = stat.portopen;
            if (isopen) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
                port.subscribe({
                    service_uuid: CUSTOM_SERVICE_UUID,
                    characteristic_uuid: SERIAL_PORT_UUID
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
            data = data.replace('\n', '');
            var fields = data.split(',');
            if (fields[0] != '$BNRDD') {
                console.log('Unknown bGeigie sentence');
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

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});