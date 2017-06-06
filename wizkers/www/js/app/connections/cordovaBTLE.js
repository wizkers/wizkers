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
            timeoutCheckTimer = 0;

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

            var encodedString = bluetoothle.bytesToEncodedString((data instanceof Uint8Array) ? data : new Uint8Array(data));
            var params = {
                value: encodedString,
                address: devAddress,
                service: info.service_uuid,
                characteristic: info.characteristic_uuid,
            };
            if (info.type) {
                params.type = info.type;
            }
            bluetoothle.write(callback,
                              function(e) { console.error('BLE Write error', e)},
                              params);
        };

        /**
         * Read data from the open BTLE device
         */
        this.read = function (service, characteristic) {
            if (!portOpen)
                return;

            var readError = function(e) {
                console.log('[cordovaBTLE] Read error: ' + e);
            };

            var readSuccess = function(s) {
                // Our drivers don't want this base64 stuff, sorry
                s.value = bluetoothle.encodedStringToBytes(s.value)
                    // Pass it on to the driver
                self.trigger('data', s);
            };

            bluetoothle.read(readSuccess,readError,{
                'address': devAddress,
                'service': service,
                'characteristic': characteristic
            });

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
                service: subscribeInfo.service_uuid,
                characteristic: subscribeInfo.characteristic_uuid,
                isNotification: true
            };
            bluetoothle.subscribe(subscribeSuccess, function (err) {
                // We get a callback here both when subscribe fails and when the
                // device disconnects - only take action when we have a subscribe
                // fail, that's it.
                if (err.error == 'isDisconnected')
                    return; // don't take action, the disconnected message
                // We didn't find the service we were looking for, this means
                // this is probably not the right device. Tell the user!
                stats.fullEvent('Cordova BLE', 'subscribe_error', err.message);
                self.trigger('status', {
                    openerror: true,
                    reason: 'Could not connect to the BLE service',
                    description: err.message
                });
                // Do a disconnect to make sure we end up in a sane state:
                self.close();
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

            // Setup a callback in case we time out
            timeoutCheckTimer = setTimeout(checkConnectDelay, 15000);

            // Callback once we know Bluetooth is enabled
            function doConnect(status) {
                if (status.status == 'disabled') {
                    // The user didn't enable BT...
                    self.trigger('status', {
                        openerror: true,
                        reason: 'Bluetooth was disabled',
                        description: 'Bluetooth is now enabled, wait 15 seconds then try to connect again.'
                    });
                    bluetoothle.enable();
                    return;
                }
                if (status.status != 'enabled')
                    return;

                // Special case: if devAddress is a device filter,
                // then do an Autoconnect
                if (devAddress.length > 99)
                    autoConnect(devAddress.split(','));
                else
                    bluetoothle.connect(trackConnect, trackError, {
                        address: devAddress
                    });

            }

            // The Cordova BTLE plugin requires calling initialize at least once.
            // Note that it can be called multiple times, this is not an issue.
            bluetoothle.initialize(doConnect, {
                request: true,
                statusReceiver: true
            });
        }

        /////////////
        // Private methods
        /////////////

        /**
         * This implements BLE Autoconnect using a device filter.
         * Connection will be attempted with the first returned device that
         * is discovered and matches the filter.
         */
        var autoConnect = function (filter) {

            var device_names = {};
            var timeoutTimer;

            // OK, we have Bluetooth, let's do the discovery now
            function startScanSuccess(status) {
                // Stop discovery after 15 seconds.
                if (status.status == 'scanStarted') {
                    timeoutTimer = setTimeout(function () {
                        bluetoothle.stopScan(function () {
                            console.log('Stopped scan');
                            self.trigger('status', {
                                                openerror: true,
                                                reason: 'No device found',
                                                description: 'Could not find a BLE device matching what we are looking for.'
                                            });
                        }, function () {});
                    }, 15000);
                }
                if (status.address) {
                        console.log('New BT Device', status);
                        clearTimeout(timeoutTimer);
                        bluetoothle.stopScan(function() {
                            // We will now connect using this device
                            devAddress = status.address;
                            self.open();
                        }, function() {});
                }
            }

            function startScanError(status) {
                console.log(status);
            }

            function startScan() {
                bluetoothle.startScan(startScanSuccess, startScanError, {
                    "services": filter,
                    allowDuplicates: true
                });
            };

            function success(status) {
                if (status.status == 'enabled') {
                    // Before anything else, make sure we have the right permissions (Android 6 and above, not
                    // tested on iOS, probably not compatible
                    bluetoothle.hasPermission(function (status) {
                        if (!status.hasPermission) {
                            bluetoothle.requestPermission(function (status) {
                                if (status.requestPermission) {
                                    self.trigger('status', {scanning: true});
                                    startScan();
                                }
                            });
                        } else {
                            startScan();
                        }
                    });
                } else if (status.status == 'disabled') {
                    // The user didn't enable BT...
                    self.trigger('status', {
                        openerror: true,
                        reason: 'Bluetooth is disabled',
                        description: 'Automatically enabled bluetooth. Please wait 15 seconds and try connecting again.'
                    });
                    bluetoothle.enable();
                }
            };

            bluetoothle.initialize(success, {
                request: true,
                statusReceiver: false
            });
        }

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
                    if (timeoutCheckTimer) {
                        clearTimeout(timeoutCheckTimer);
                        timeoutCheckTimer = 0;
                    }
                    self.trigger('status', {
                        portopen: portOpen,
                        services: r.services
                    });
                    stats.fullEvent('Cordova BLE', 'open_success', '');
                    // Need to send this to tell the front-end we're done reconnecting
                    // and back to normal
                    self.trigger('status', {
                        reconnecting: false
                    });

                }, function (err) {
                    console.log(err);
                    stats.fullEvent('Cordova BLE', 'open_error', err.message);
                }, {
                    address: devAddress
                });
                return;
            }
            if (result.status == 'disconnected') {
                console.log(result);
                // OK, the device disappeared: we will try to
                // reconnect as long as the user does not explicitely
                // ask to close
                portOpen = false;
                // Just keep reconnecting forever...
                //timeoutCheckTimer = setTimeout(checkConnectDelay, 60000);
                // We lost the connection, try to get it back
                bluetoothle.reconnect(trackConnect, trackError, {
                    address: devAddress
                });
                self.trigger('status', {
                    reconnecting: true
                });
            }
        }

        function trackError(err) {
            // This is called whenever we lose the connection
            console.log(err);
            if (!portOpen) {
                // if the port was not open and we got an error callback, this means
                // we were not able to connect in the first place...
                self.trigger('status', {
                    openerror: true,
                    reason: 'Device connection error',
                    description: 'Android error: ' + err.message
                });
                // Do a disconnect to make sure we end up in a sane state:
                self.close();
            } else {
                portOpen = false;
                // Just keep reconnecting forever...
                //timeoutCheckTimer = setTimeout(checkConnectDelay, 60000);
                // We lost the connection, try to get it back
                bluetoothle.reconnect(trackConnect, trackError, {
                    address: devAddress
                });
                self.trigger('status', {
                    reconnecting: true
                });
            }
            return;
        }

        // This is where we get notifications
        function subscribeSuccess(chrc) {
            if (chrc.status == 'subscribedResult') {
                // Our drivers don't want this base64 stuff, sorry
                chrc.value = bluetoothle.encodedStringToBytes(chrc.value)
                    // Pass it on to the driver
                self.trigger('data', chrc);
            }
        }

        // Make sure that if after X seconds we have no connection, we cancel
        // the attempt
        function checkConnectDelay() {
            console.log('Check connect delay timeout');
            if (!portOpen) {
                self.close();
                self.trigger('status', {
                    openerror: true,
                    reason: 'Device connection error',
                    description: 'Could not connect to device. In you just enabled bluetooth, you might have to wait up to 15 seconds before you can connect.'
                });
            }
        }

        console.log("[cordovaBTLE] Cordova BTLE Library loaded");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(cordovaBTLE.prototype, Backbone.Events);
    return cordovaBTLE;
});