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
            isopen = false,
            lastUpdate = new Date().getTime();

        var HEART_RATE_SERVICE_UUID = '180d';
        var HEART_RATE_MEASUREMENT_UUID = '2a37';
        
        // Device information  uuids:
        var DEV_INFO='180a';
        var MFG_NAME = '2a24';
        var MODEL_NUMBER = '2a24';
        var SERIAL_NUMBER = '2a25';

        // We need to write a "0" (string) to this characteristic to get the BlueOnyx
        // to start sending measurements, because it boots in Bootloader mode and remains there
        // until we tell it otherwise.
        var BLEONYX_MEASURING_MODE = 'e7add780-b042-4876-aae1-112855353cc1';

        // If possible, we want to keep track of the location of the measurement.
        var current_loc = null,
            location_status = '',
            watchid = null;


        // Those variables are used to do our CPM calculations.
        // We use a one-window mechanism.
        var count_buffer = [];
        var time_interval = 5; // seconds
        var buffer_max = 90 / time_interval; // Number of samples in the buffer (seconds/time_interval)
        var buffer_idx = 0;

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
        var format = function (data) {
            if (!(data.value && data.service && data.characteristic))
                return;

            var response = '';
            var updt = new Date().getTime();

            // The Blue Onyx simulates a Heart Rate monitor, hence the references
            // to Heart Rate below.

            // The Heart Rate Measurement Characteristic does not allow 'read'
            // operations and its value can only be obtained via notifications, so the
            // |value| field might be undefined here.
            
            if (data.service == HEART_RATE_SERVICE_UUID && data.characteristic == HEART_RATE_MEASUREMENT_UUID) {
                var valueBytes = new Uint8Array(data.value);
                if (valueBytes.length < 2) {
                    console.log('Invalid Heart Rate Measurement value');
                    return;
                }

                // Keep track of the time since we last got a packet - if this is more than
                // 6 seconds, then we missed one (or more) and the CPM count cannot be trusted
                var valid = false;
                if ((updt - lastUpdate) < 6000)
                    valid = true;

                lastUpdate = updt;

                // The first byte is the counts in the last 5 seconds
                var count = valueBytes[0] + (valueBytes[1] << 8);
                var battery_ok = (valueBytes[2] == 0x01);

                var cpm = updateCPM(count);

                // This is the CPM to µSv/h conversion coefficient for the tube
                // in the Blue Onyx. A proper µSv/h output should also take a conversion
                // coefficient into account for calibration.
                var conversionCoefficient = 0.00294;

                var response = {
                    cpm: {
                        value: cpm.cpm,
                        usv: cpm.cpm * conversionCoefficient,
                        valid: valid && cpm.valid
                    },
                    cp5s: count,
                    batt_ok: battery_ok,
                    loc: current_loc,
                    loc_status: location_status
                };

                self.trigger('data', response);
            } else if (data.service == DEV_INFO && data.characteristic == SERIAL_NUMBER) {
                // The SN of the Blue Onyx is the MAC
                var res = '';
                for (var i in data.value) {
                    res += ('0' + data.value[i].toString(16)).slice(-2) + ':';
                }
                self.trigger('data', {
                    uniqueID: res.substr(0,res.length-1)
                });
            }
        };

        /**
         * Update the current CPM. This is a very simple CPM calculation
         * algorithm, which uses a fixed averaging window length, and tube
         * dead time error correction. It sets a "valid" flag that becomes true
         * once we have enough sample to do the averaging we want.
         * 
         * @param {Number} count Count in the last 5 seconds
         */
        var updateCPM = function (count) {

            count_buffer[buffer_idx] = count;
            buffer_idx = (buffer_idx + 1) % buffer_max;

            var count = 0;
            var i = 0;
            var buffer_filled = true;
            for (i = 0; i < buffer_max; i++) {
                if (isNaN(count_buffer[i])) {
                    buffer_filled = false;
                    break;
                }
                count += count_buffer[i];
            }

            //	 deadtime compensation
            var rcpm = count * 60 / ((i + 1) * time_interval);
            return {
                cpm: rcpm / (1 - rcpm * 1.8833e-6),
                valid: buffer_filled
            };
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
            if (isopen) {
                // Runs our "onOpen" initialization routine here
                console.log("Our port is now open");

                port.subscribe({
                    service_uuid: HEART_RATE_SERVICE_UUID,
                    characteristic_uuid: HEART_RATE_MEASUREMENT_UUID
                });

                lastUpdate = new Date().getTime();

                // If we don't receive data within 5 seconds, then take action
                // and attempt to put the Blue Onyx into streaming mode (it might
                // be in bootloader mode, and this requires writing "0" to the
                // relevant service/characteristic
                setTimeout(function () {
                    if ((new Date().getTime() - lastUpdate) > 6000) {
                        console.log("Do a Onyx bootloader mode cancel");
                        port.write(abutils.str2ab("0"), {
                            service_uuid: HEART_RATE_SERVICE_UUID,
                            characteristic_uuid: BLEONYX_MEASURING_MODE
                        }, function (info) {
                            console.log('callback from write', info);
                        });
                        setTimeout(function () {
                            // We have to close the port after writing "0", this
                            // is the case for both Android and MacOS. Otherwise we
                            // will eventually just get a connection error and port force
                            // close.
                            port.close();
                        }, 1000);
                    }
                }, 8000);

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
            if (port == null) {
                port = new btleConnection(ins.get('port'), portSettings());
                port.on('data', format);
                port.on('status', status);
            }
            port.open();
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
        this.sendUniqueID = function () {
            port.read(DEV_INFO, SERIAL_NUMBER);            
        };

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