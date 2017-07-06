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
    debug = require('debug')('wizkers:connections:ble');
    dbs = require('pouch-config');
}


/**
 * Bluetooth Low Energy connection, implemented using the Node NOBLE
 * API ()
 *
 */
define(function (require) {

    "use strict";

    var EventEmitter = require('events').EventEmitter,
        noble = require('noble'),
        util = require('util'),
        abu = require('app/lib/abutils');


    // TODO: accept a list of service UUIDs and a list of Characteristic UUIDs
    //       rather than a single value.

    /**
     * Instanciates a BTLE connection
     * @param {Object} path  Contains the address of the BTLE device we want to connect to.
     * @param {Object} settings not used.
     */
    var nodeBTLE = function (path, settings) {


        EventEmitter.call(this);

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

        // We want to keep a reference to the peripheral, services and characteristics
        var activePeripheral = null,
            activeServices = null,       // All found services
            activeCharacteristics = null;

        var subscribedCharacteristics = [];

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
                self.emit('data', s);
            };

            bluetoothle.read(readSuccess,readError,{
                'address': devAddress,
                'service': service,
                'characteristic': characteristic
            });

        }

        /**
         * Subscribe to a service/characteristic.
         * You can subscribe to multiple characteristings within a service,
         * but not across services
         * @param {[[Type]]} subscribeInfo [[Description]]
         */
        this.subscribe = function (subscribeInfo) {
            if (!portOpen)
                return;
            // Once we are connected, we want to select the service
            // the driver asked for and subscribe to the characteristics
            // the driver wants.

            // It seems that Noble uses uuids without dashed
            subscribeInfo.service_uuid = subscribeInfo.service_uuid.replace(/-/gi,'');
            debug(subscribeInfo);

            // With the way the Noble API works, we now need to discover
            // characteristics for the service we're looking for before
            // going further
            var s = null;
            for (var i in activeServices) {
                if (activeServices[i].uuid == subscribeInfo.service_uuid) {
                    s = activeServices[i];
                    break;
                }
            }
            if (s == null) {
                this.close();
                return;
            }
            debug('Found my service');
            if (typeof subscribeInfo.characteristic_uuid == 'object') { // Arrays are objects in Node
                var cuid = [];
                for (var i in subscribeInfo.characteristic_uuid ) {
                    cuid.push(subscribeInfo.characteristic_uuid[i].replace(/-/gi,''));
                }
            } else {
                var cuid = [ subscribeInfo.characteristic_uuid.replace(/-/gi,'') ]
            }
            s.discoverCharacteristics(cuid , function(err, c) {
                debug('Found characteristics', c);
                if (typeof c == 'undefined' ) {
                    debug('Error: could not find a matching characteristic');
                    self.emit('status', {
                        openerror: true,
                        reason: 'Could not connect to the BLE service',
                        description: 'Did not find characteristic.'
                    });
                    self.close();
                    return;
                }

                for (var i in c ) {
                    // If we were already subscribed to this characteristic in the past,
                    // we need to remove the previous listener first, otherwise we'll get
                    // every even in double
                    cleanDataListeners(c[i]);
                    c[i].subscribe(trackError);
                    var makeOnData = function(uuid) {
                        return function(data, isNotification) {
                            debug('Received data from BLE device', data, isNotification);
                            self.emit('data', { value: data, uuid: uuid });
                        }
                    }
                    c[i].on('data', makeOnData(c[i].uuid));
                    subscribedCharacteristics.push(c[i]);
                }
            });

            return;
        }

        this.close = function () {
            debug("[nodeBTLE] Close BTLE connection");
            if (activePeripheral == null) {
                debug('Error: no active peripheral and asked to close?');
                return;
            }
            activePeripheral.disconnect(function (result) {
                // We also need to clean up the listeners
                for (var i in subscribedCharacteristics) {
                    subscribedCharacteristics[i].removeAllListeners('data');
                }
                subscribedCharacteristics = [];
                console.log(result);
                portOpen = false;
                self.emit('status', {
                    portopen: portOpen
                });
            });
        };

        // Has to be called by the backend_driver to actually open the port.
        // This just connects to the device
        this.open = function () {

            // noble, the NodeJS we use, seems to require a scan to find
            // the device, then do the actual connect
            noble.startScanning();

            // Setup a callback in case we time out
            timeoutCheckTimer = setTimeout(checkConnectDelay, 30000);

            noble.on('discover', doConnect);

        }

        /////////////
        // Private methods
        /////////////


        // Callback once we have found a BLE peripheral
        function doConnect(peripheral) {
            if (peripheral.id != devAddress) {
                debug('Peripheral found (' + peripheral.id + ') but not the one we want');
                return;
            }
            noble.removeAllListeners('discover');
            noble.stopScanning();
            debug('Found our peripheral, now connecting (' + peripheral.id + ')');
            activePeripheral = peripheral;
            peripheral.connect(trackConnect);
            peripheral.on('disconnect', trackError); // Track disconnects
        }



        /**
         * This implements BLE Autoconnect using a device filter.
         * Connection will be attempted with the first returned device that
         * is discovered and matches the filter.
         */
        var autoConnect = function (filter) {
            debug('Autoconnect not implemented');
        }

        /**
         * Delete any existing listener for data messages from
         * a given characteristic
         * @param {*} c Characteristic to look for
         */
        var cleanDataListeners = function(c) {
            for (var i in subscribedCharacteristics) {
                if (c.uuid == subscribedCharacteristics[i].uuid) {
                    subscribedCharacteristics[i].removeAllListeners('data');
                    subscribedCharacteristics.splice(i,1); // Remove old characteristic
                }
            }
        }
        /////////////
        //   Callbacks
        /////////////

        // Track connection status
        function trackConnect(error) {

            debug('We are now connected, discovering services/characteristics');

            // Right after we connect, we do a service
            // discovery, so that we can then connect to the various
            // services & characteristics. This is the Android call, the
            // iPhone call will be different:
            activePeripheral.discoverServices( [], function (err, services) {
                portOpen = true;
                if (timeoutCheckTimer) {
                    clearTimeout(timeoutCheckTimer);
                    timeoutCheckTimer = 0;
                }

                activeServices = services;

                // Create a list of service UUIDs
                var suuids = [];
                for (var service in services) {
                    // Todo: reformat UUID to include dashes ?
                    suuids.push(services[service].uuid);
                }

                self.emit('status', {
                    portopen: portOpen,
                    services: suuids
                });

                // Need to send this to tell the front-end we're done reconnecting
                // and back to normal
                self.emit('status', {
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
                self.emit('status', {
                    openerror: true,
                    reason: 'Device connection error',
                    description: 'Device got disconnected'
                });
                // Do a disconnect to make sure we end up in a sane state:
                self.close();
            } else {
                // portOpen = false;
                // Just keep reconnecting forever...
                debug('Error while we were connected ???');
                //self.emit('status', {
                //    reconnecting: true
                //});
            }
            return;
        }

        // This is where we get notifications
        function onData(data, isNotification) {
            debug('Received data from BLE device', data, isNotification);
            self.emit('data', { value: data });
        }

        // Make sure that if after X seconds we have no connection, we cancel
        // the attempt
        function checkConnectDelay() {
            debug('Check connect delay timeout');
            noble.stopScanning();
            noble.removeAllListeners('discover');
            if (!portOpen) {
                self.close();
                self.emit('status', {
                    openerror: true,
                    reason: 'Device connection error',
                    description: 'Could not connect to device. In you just enabled bluetooth, you might have to wait up to 15 seconds before you can connect.'
                });
            }
        }

        debug("[nodeBTLE] Node BTLE Library loaded");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    util.inherits(nodeBTLE, EventEmitter);

    return nodeBTLE;
});