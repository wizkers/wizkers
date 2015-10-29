/** (c) 2015 Edouard Lafargue, ed@lafargue.name
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

/**
 * Bluetooth Low Energy connection, implemented using the Cordova BTLE
 * API (https://github.com/randdusing/bluetoothle)
 *
 * Note: only notifications are implemented for now.
 */
define(function (require) {

    "use strict";

    var Backbone = require('backbone'),
        abu = require('app/lib/abutils');


    // TODO: accept a list of service UUIDs and a list of Characteristic UUIDs
    //       rather than a single value.

    /**
     * Instanciates a BTLE connection
     * @param {Object} path  Contains the address of the BTLE device we want to connect to.
     * @param {Object} settings not used.
     */
    var cordovaBTLE = function (path, settings) {

        /////////
        // Initialization
        /////////
        var portOpen = false,
            deviceDisappeared = false, // becomes true if the device disappeared (we will try to
            // reconnect if it comes back
            currentService = null,
            currentCharacteristics = null,
            self = this,
            devAddress = path,
            connectionId = -1;


        ///////////
        // Public methods
        ///////////

        /**
         * Send data
         * @param {ArrayBuffer} data The command, already formatted for sending.
         * @param {Object} info contains the service_uuid and characterictic_uuid to write to
         */
        this.write = function (data, info, callback) {
            if (!portOpen || info == undefined || callback == undefined)
                return;

            var encodedString = bluetoothle.bytesToEncodedString(new Uint8Array(data));
            bluetoothle.write(callback, callback, {
                value: encodedString,
                address: devAddress,
                serviceUuid: info.service_uuid,
                characteristicUuid: info.characteristic_uuid,
            });
        };

        /**
         * Read data from the BTLE device (not implemented)
         */
        this.read = function () {
            if (!portOpen)
                return;
            // self.trigger('data', data);
        }

        /**
         * Subscribe to a service/characteristic
         * @param {[[Type]]} subscribeInfo [[Description]]
         */
        this.subscribe = function (subscribeInfo) {
            if (!portOpen)
                return;
            // Once we are connected, we want to select the service
            // the driver asked for and subscribe to the characteristics
            // the driver wants.

            var params = {
                address: devAddress,
                serviceUuid: subscribeInfo.service_uuid,
                characteristicUuid: subscribeInfo.characteristic_uuid,
                isNotification: true
            };
            bluetoothle.subscribe(subscribeSuccess, function (err) {
                console.log(err);
            }, params);
        }

        this.close = function () {
            console.log("[cordovaBTLE] Close BTLE connection");
            // We need to disconnect before closing, as per the doc
            bluetoothle.disconnect(function (result) {
                // OK, we can now close the device:
                bluetoothle.close(function (result) {
                    console.log(result);
                    portOpen = false;
                    self.trigger('status', {
                        portopen: portOpen
                    });
                }, function (error) {}, {
                    address: devAddress
                });
            }, function (error) {
                console.log('Disconnect error', error);
                if (error.error == 'isDisconnected') {
                    // Already disconnected, so we can close
                    bluetoothle.close(function (result) {
                        console.log(result);
                        portOpen = false;
                        self.trigger('status', {
                            portopen: portOpen
                        });
                    }, function (error) {}, {
                        address: devAddress
                    });
                }
            }, {
                address: devAddress
            });
        };

        // Has to be called by the backend_driver to actually open the port.
        // This just connects to the device
        this.open = function () {

            // Callback once we know Bluetooth is enabled
            function doConnect(status) {
                if (status.status != 'enabled')
                    return;
                bluetoothle.connect(trackConnect, function (err) {
                    console.log(err);
                    self.trigger('status', {
                        openerror: true,
                        reason: 'Device connection error',
                        description: 'Android error: ' + err.message
                    });
                    // Do a disconnect to make sure we end up in a sane state:
                    self.close();
                    return;
                }, {
                    address: devAddress
                });

            }

            // The Cordova BTLE plugin requires calling initialize at least once.
            // Note that it can be called multiple times, this is not an issue.
            bluetoothle.initialize(doConnect, function (err) {
                console.log(err);
            }, {
                request: true,
                statusReceiver: false
            });
        }

        /////////////
        // Private methods
        /////////////


        /////////////
        //   Callbacks
        /////////////

        // Track connection status
        function trackConnect(result) {
            if (result.status == 'connecting') {
                console.log(result);
                return;
            }
            if (result.status == 'connected') {
                // Right after we connect, we do a service
                // discovery, so that we can then connect to the various
                // services & characteristics. This is the Android call, the
                // iPhone call will be different:
                bluetoothle.discover(function (r) {
                    if (r.status != 'discovered')
                        return;
                    portOpen = true;
                    self.trigger('status', {
                        portopen: portOpen
                    });
                }, function (err) {
                    console.log(err);
                }, {
                    address: devAddress
                });
                return;
            }
            if (result.status == 'disconnected') {
                console.log(result);
                // OK, the device disappeared: we need to close
                // the connection. Note: we might want to auto-reconnect
                // in a future version, TbD.
                bluetoothle.close(function (result) {
                    console.log(result);
                    portOpen = false;
                    self.trigger('status', {
                        portopen: portOpen
                    });
                }, function (error) {}, {
                    address: devAddress
                });
            }
        }

        // This is where we get notifications
        function subscribeSuccess(chrc) {
            if (chrc.status == 'subscribedResult') {
                // Our driversdon't want this base64 stuff, sorry
                chrc.value = bluetoothle.encodedStringToBytes(chrc.value)
                    // Pass it on to the driver
                self.trigger('data', chrc);
            }
        }

        console.log("[cordovaBTLE] Cordova BTLE Library loaded");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(cordovaBTLE.prototype, Backbone.Events);
    return cordovaBTLE;
});