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
            activeCharacteristics = null,
            foundPeripheral = false;

        var subscribedCharacteristics = [];

        ///////////
        // Public methods
        ///////////

        /**
         * Send data
         * @param {TypedArray} data The command, already formatted for sending.
         * @param {Object} info contains the service_uuid and characterictic_uuid to write to
         */
        this.write = function (data, info, callback) {
            if (!portOpen || info == undefined || callback == undefined)
                return;
            var s = findService(info.service_uuid);
            s.discoverCharacteristics([ info.characteristic_uuid.replace(/-/gi,'') ], function(err, c) {
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

                //  Now we can write
                var dab = Buffer.from(data);
                var noresp = c[0].properties.indexOf('writeWithoutResponse') != -1;
                c[0].write(dab, noresp, function(err) {debug('writing result', err)});
            });
        };

        /**
         * Read data from the open BTLE device
         */
        this.read = function (service, characteristic) {
            if (!portOpen)
                return;

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

            debug('Subscribing to', subscribeInfo);

            // With the way the Noble API works, we now need to discover
            // characteristics for the service we're looking for before
            // going further
            var s = findService(subscribeInfo.service_uuid);
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
                s.removeAllListeners('characteristicsDiscover'); // Workaround on a noble bug (?)
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
                    // every event in double
                    debug('Subscribing to characteristic', c[i].uuid, c[i].properties);
                    cleanDataListeners(c[i]);
                    var makeOnData = function(c, s) {
                        var uuid = c.uuid;
                        var suuid = s;
                        // We enable notifications from here, so that we use a static reference to the
                        // characteristic - otherwise, 'i' has changed once the 'notify' event occurs and we
                        // can't retrieve the correct uuid.
                        c.notify(true, function(error) {
                            debug('Notifications enabled for characteristic', uuid);
                            self.emit('subscribed', uuid);
                        });
                        return function(data, isNotification) {
                            debug('Received data from BLE device', data, isNotification, 'for uuid', uuid);
                            self.emit('data', { value: data, characteristic: uuid,
                                service: suuid
                             });
                        }
                    }
                    c[i].on('data', makeOnData(c[i], subscribeInfo.service_uuid));
                    subscribedCharacteristics.push(c[i]);
                }
                debug('We now have those subscribed characteristics');
                for (var i in subscribedCharacteristics) {
                    debug('Service        :', subscribedCharacteristics[i]._serviceUuid);
                    debug('Characteristic :', subscribedCharacteristics[i].uuid);
                };
                debug('----');


            });

            return;
        }

        /**
         * Unsubscribe to a service/characteristic.
         * You can unsubscribe to multiple characteristics within a service,
         * but not across services
         * @param {[[Type]]} subscribeInfo [[Description]]
         */
        this.unsubscribe = function (subscribeInfo) {
            if (!portOpen)
                return;
            // Once we are connected, we want to select the service
            // the driver asked for and subscribe to the characteristics
            // the driver wants.

            // It seems that Noble uses uuids without dashed
            subscribeInfo.service_uuid = subscribeInfo.service_uuid.replace(/-/gi,'');
            debug('Attempting to unsubscribe from', subscribeInfo);

            // Make sure we accept either a string or an array of strings:
            if (typeof subscribeInfo.characteristic_uuid == 'object') { // Arrays are objects in Node
                var cuid = [];
                for (var i in subscribeInfo.characteristic_uuid ) {
                    cuid.push(subscribeInfo.characteristic_uuid[i].replace(/-/gi,''));
                }
            } else {
                var cuid = [ subscribeInfo.characteristic_uuid.replace(/-/gi,'') ]
            }

            for ( var i in cuid) {
                for (var j in subscribedCharacteristics ) {
                    debug('Do we need to unsubscribe from', subscribedCharacteristics[j].uuid);
                    if (subscribedCharacteristics[j].uuid == cuid[i]) {
                        debug('Unsubscribing from', cuid[i]);
                        cleanDataListeners(subscribedCharacteristics[j]);
                        break;
                    }
                }
            }
        }

        this.close = function () {
            debug("[nodeBTLE] Close BTLE connection");
            if (activePeripheral == null) {
                debug('Error: no active peripheral and asked to close?');
                return;
            }
            // First we unsubscribe from all characteristics we're listening to:
            for (var i in subscribedCharacteristics) {
                try {
                    subscribedCharacteristics[i].unsubscribe();
                } catch (err) {
                    debug('Noble bug - failure to unsubscribe inside Noble code ?', err);
                }
                subscribedCharacteristics[i].removeAllListeners('data');
            }
            subscribedCharacteristics = [];
            activePeripheral.removeAllListeners('connect'); // Just in case
            activePeripheral.disconnect(function (result) {
                debug('Peripheral closed');
                portOpen = false;
                self.emit('status', {
                    portopen: portOpen
                });
            });
        };

        // Has to be called by the backend_driver to actually open the port.
        // This just connects to the device
        this.open = function () {
            if (typeof noble.wizkersScanningCount == 'undefined')
                noble.wizkersScanningCount = 0;
            // noble, the NodeJS we use, seems to require a scan to find
            // the device, then do the actual connect
            foundPeripheral = false;
            noble.wizkersScanningCount++;
            noble.startScanning([], true);

            // Setup a callback in case we time out
            // The 45s duration is necessary for some super low power devices
            // that advertise rarely ( <1s ) and cause some computers to struggle
            // to find + connect
            timeoutCheckTimer = setTimeout(checkConnectDelay, 45000);

            noble.on('discover', doConnect);

        }

        /////////////
        // Private methods
        /////////////

        // Utilities to simplify service/characteristics read/write

        // Return a service object for a given UUID
        function findService(uuid) {
            // It seems that Noble uses uuids without dashed
            uuid = uuid.replace(/-/gi,'');
            for (var i in activeServices) {
                if (activeServices[i].uuid == uuid) {
                    return activeServices[i];
                }
            }
            self.close();
            return null;
        }

        // Callback once we have found a BLE peripheral
        function doConnect(peripheral) {
            if (peripheral.id != devAddress) {
                debug('Peripheral found (' + peripheral.id + ') but not the one we want');
                return;
            }
            if (foundPeripheral)
                return; // In case scan is still going on
            foundPeripheral = true;
            // We might have several peripherals trying to connect at once,
            // so we must not stop scanning before they have all either connected
            // or given up
            noble.wizkersScanningCount--;
            debug('Number of scans going on now:', noble.wizkersScanningCount);
            if (noble.wizkersScanningCount <= 0) {
                debug('Stop scanning');
                noble.removeAllListeners('discover');
                noble.stopScanning();
            }
            debug('Found our peripheral, now connecting (' + peripheral.id + ')');
            activePeripheral = peripheral;
            // debug('Here is what our active peripheral looks like', activePeripheral);
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
                    subscribedCharacteristics[i].unsubscribe();
                    subscribedCharacteristics[i].removeAllListeners('data');
                    self.emit('unsubscribed',c.uuid);
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
            // services & characteristics.
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
                    suuids.push({ uuid: services[service].uuid} );
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

        function trackCharacteristicError(err) {
            debug('Characteristic subscribe result:', err);
        }

        function trackError(err) {
            // Noble is very bad at cleaning pending listeners in case an error occurs.
            // If we don't do it here, we will get spontaneous callbacks on those events
            // from previous sessions after we reconnect.
            activePeripheral.removeAllListeners('disconnect');
            activePeripheral.removeAllListeners('servicesDiscover');
            // This is called whenever we lose the connection
            if (!portOpen) {
                debug('Connection error while port not fully open yet.');
                // if the port was not open and we got an error callback, this means
                // we were not able to connect in the first place...
                self.emit('status', {
                    openerror: true,
                    reason: 'Device connection error',
                    description: 'Device got disconnected'
                });
                // Also make sure the timeout timer is cleared
                if (timeoutCheckTimer) {
                    clearTimeout(timeoutCheckTimer);
                    timeoutCheckTimer = 0;
                }
                // Do a disconnect to make sure we end up in a sane state:
                self.close();
            } else {
                // Just keep reconnecting forever...
                debug('Error while connected: either device out of range, or user closed device.');
            }
            return;
        }

        // Make sure that if after X seconds we have no connection, we cancel
        // the attempt
        function checkConnectDelay() {
            debug('Check connect delay timeout');
            // We might have several peripherals trying to connect at once,
            // so we must not stop scanning before they have all either connected
            // or given up
            noble.wizkersScanningCount--;
            if (noble.wizkersScanningCount == 0) {
                noble.removeAllListeners('discover');
                noble.stopScanning();
            }
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
