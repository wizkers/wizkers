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
 * Bluetooth Low Energy connection, implemented using the Web Bluetooth API
 * API ()
 *
 */
define(function (require) {

    "use strict";

    var Backbone = require('backbone'),
        abu = require('app/lib/abutils');


    // TODO: accept a list of service UUIDs and a list of Characteristic UUIDs
    //       rather than a single value (work in progress, to be tested)

    /**
     * Instanciates a BTLE connection
     * @param {Object} path  Contains the address of the BTLE device we want to connect to.
     * @param {Object} settings not used.
     */
    var webBTLE = function (path, settings) {


        // noble = node_req('noble');

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

        // Web Bluetooth specific:
        var BTdevice = null;
        var BTserver = null;

        var subscribedChars = [];

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

            console.error('Web Bluetooth: write not implemented');

        };

        /**
         * Read data from the open BTLE device
         */
        this.read = function (service, characteristic) {
            if (!portOpen)
                return;

            console.error('Web Bluetooth: read not implemented');

        }

        /**
         * Subscribe to a service/characteristic
         * @param {[[Type]]} subscribeInfo [[Description]]
         */
        this.subscribe = function (subscribeInfo) {
            if (!portOpen)
                return;

            if (typeof subscribeInfo.characteristic_uuid == 'object') {
                var cuid = [];
                for (var i in subscribeInfo.characteristic_uuid ) {
                    cuid.push(subscribeInfo.characteristic_uuid[i]);
                }
            } else {
                var cuid = [ subscribeInfo.characteristic_uuid ]
            }

            var makeOnNotification = function() {
                return function(event) {
                    // value is a DataView. Super cool but our drivers
                    // expect a Buffer
                    let value = event.target.value;
                    self.trigger('data', { value: value.buffer,
                        characteristic: event.target.uuid });
                    }
                }

            subscribedChars = []; // Keep track of all subscribed characteristics

            // Web Bluetooth is super difficult in terms of the services
            // we are allowed to see - if they were not in the initial
            // 'settings' variable when initializing this object, we will never
            // be allowed to connect to them
            BTserver.getPrimaryService(subscribeInfo.service_uuid)
            .then( service => {
                // Now subscribe to all the characteristics we're looking for
                for (var i in cuid) {
                    service.getCharacteristic(cuid[i])
                        .then( characteristic => {
                            var c = characteristic;
                            subscribedChars.push(c);
                            c.startNotifications().then( _ => {
                                c.addEventListener('characteristicvaluechanged',
                                    makeOnNotification());
                                });
                        });
                        
                    }
            }).catch(error => {
                console.error('Argh! ' + error);
            });
        }

        this.close = function () {
            console.log("[WebBTLE] Close BTLE connection");
            if (BTdevice) {
                BTdevice.gatt.disconnect();
                portOpen = false;
                self.trigger('status', {
                    portopen: portOpen
                });
            } else {
                console.error('Error, no open connection');
                self.trigger('status', {
                    openerror: true,
                    reason: 'The Bluetooth peripheral is not open',
                    description: ''
                });
            }
        };

        // Has to be called by the backend_driver to actually open the port.
        // This just connects to the device
        this.open = function () {

            // Setup a callback in case we time out
            // timeoutCheckTimer = setTimeout(checkConnectDelay, 15000);

            if (BTdevice == null) {
                // Damn web bluetooth interface requires those user gestures
                // which do not really make sense in the context of a NWJS app.
                // This will be possible to avoid once the permissions model is implemented
                // for Bluetooth on the Chromium runtime.
                $('#BTModal').modal('show');
                $('#btscan').on('click', function() {
                    navigator.bluetooth.requestDevice({
                        filters: [ {
                            name: devAddress, // devAddress in our case is the device name
                            services: [ settings.service_uuid ] // Required otherwise we will never be able to subscribe to this service
                        }]
                    })
                    .then(device => {
                        BTdevice = device;
                        // Set up event listener for when device gets disconnected.
                        device.addEventListener('gattserverdisconnected', trackError);
                        return device.gatt.connect();
                    })
                    .then(server => {
                        BTserver = server;
                        trackConnect();
                    }).catch(error => {
                        console.log(error);
                    })
                });
            } else {
                // We already have a reference, great...
                BTdevice.gatt.connect()
                .then(server => {
                        BTserver = server;
                        trackConnect();
                });
            }
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
            console.error('Not supported on this platform');
        }

        /////////////
        //   Callbacks
        /////////////

        // Track connection status
        function trackConnect() {
            portOpen = true;
            if (timeoutCheckTimer) {
                clearTimeout(timeoutCheckTimer);
                timeoutCheckTimer = 0;
            }

            // For security reasons (?) we need to already know
            // the services in order to scan for them. Go figure. 
            // See https://webbluetoothcg.github.io/web-bluetooth/#dom-requestdeviceoptions-optionalservices
            // We want to get all the service available on the server
            BTserver.getPrimaryServices().
                then( services => {
                    console.info('Found those services', services);
                    self.trigger('status', {
                        portopen: portOpen,
                        services: services
                    });
                    stats.fullEvent('WebBluetooth', 'open_success', '');
                    // Need to send this to tell the front-end we're done reconnecting
                    // and back to normal
                    self.trigger('status', {
                        reconnecting: false
                    });
                });
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
                    description: 'Bluetooth error: ' + err.message
                });
                // Do a disconnect to make sure we end up in a sane state:
                self.close();
            } else {
                portOpen = false;
                // Just keep reconnecting forever...
                // TODO; not implemented for WebBluetooth
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

        console.log("[WebBTLE] Cordova BTLE Library loaded");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(webBTLE.prototype, Backbone.Events);
    return webBTLE;
});