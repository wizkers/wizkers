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

define(function (require) {
    "use strict";

    var Backbone = require('backbone'),
        abutils = require('app/lib/abutils'),
        btleConnection = require('connections_btle');


    var parser = function (socket) {

        var self = this,
            socket = socket,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        var HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
        var HEART_RATE_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

        /////////////
        // Private methods
        /////////////

        var portSettings = function () {
            return {
                service_uuid: HEART_RATE_SERVICE_UUID,
                characteristic_uuid: HEART_RATE_MEASUREMENT_UUID
            }
        };

        // Format can act on incoming data from the counter, and then
        // forwards the data to the app through a 'data' event.

        // Using https://github.com/GoogleChrome/chrome-app-samples/blob/master/samples/bluetooth-samples/heart-rate-sensor/main.js
        // as the source for BTLE Heartrate measurement
        //        (Apache License)
        var format = function (data) {
            var response = '';

            // The Blue Onyx simulates a Heart Rate monitor, hence the references
            // to Heart Rate below.

            // TODO: move this into its own library/class so that we can use the code
            //       for various other uses (actual Heart Rate monitors, etc)

            // The Heart Rate Measurement Characteristic does not allow 'read'
            // operations and its value can only be obtained via notifications, so the
            // |value| field might be undefined here.
            if (!data.value) {
                console.log('No Heart Rate Measurement value received yet');
                return;
            }

            var valueBytes = new Uint8Array(data.value);
            if (valueBytes.length < 2) {
                console.log('Invalid Heart Rate Measurement value');
                return;
            }

            // The first byte is the flags field.
            var flags = valueBytes[0];

            // The least significant bit is the Heart Rate Value format. If 0, the heart
            // rate measurement is expressed in the next byte of the value. If 1, it is
            // a 16 bit value expressed in the next two bytes of the value.
            var hrFormat = flags & 0x01;

            // The next two bits is the Sensor Contact Status.
            var sensorContactStatus = (flags >> 1) & 0x03;

            // The next bit is the Energy Expanded Status. If 1, the Energy Expanded
            // field is present in the characteristic value.
            var eeStatus = (flags >> 3) & 0x01;

            // The next bit is the RR-Interval bit. If 1, RR-Interval values are
            // present.
            var rrBit = (flags >> 4) & 0x01;

            var heartRateMeasurement;
            var energyExpanded;
            var rrInterval;
            var minLength = hrFormat == 1 ? 3 : 2;
            if (valueBytes.length < minLength) {
                console.log('Invalid Heart Rate Measurement value');
                return;
            }

            if (hrFormat == 0) {
                console.log('8-bit Heart Rate format');
                heartRateMeasurement = valueBytes[1];
            } else {
                console.log('16-bit Heart Rate format');
                heartRateMeasurement = valueBytes[1] | (valueBytes[2] << 8);
            }

            var nextByte = minLength;
            if (eeStatus == 1) {
                if (valueBytes.length < nextByte + 2) {
                    console.log('Invalid value for "Energy Expanded"');
                    return;
                }

                console.log('Energy Expanded field present');
                energyExpanded = valueBytes[nextByte] | (valueBytes[nextByte + 1] << 8);
                nextByte += 2;
            }

            if (rrBit == 1) {
                if (valueBytes.length < nextByte + 2) {
                    console.log('Invalid value for "RR-Interval"');
                    return;
                }

                console.log('RR-Interval field present');

                // Note: According to the specification, there can be several RR-Interval
                // values in a characteristic value, however we're just picking the first
                // one here for demo purposes.
                rrInterval = valueBytes[nextByte] | (valueBytes[nextByte + 1] << 8);
            }

            if (heartRateMeasurement) {
                // Now forward this heart rate measurement as a CPM value
                var response = {
                    cpm: {
                        value: heartRateMeasurement,
                        valid: true
                    }
                };
                self.trigger('data', response);
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
    }

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});