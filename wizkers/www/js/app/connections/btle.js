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
 * Bluetooth Low Energy connection.
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
     * @param {Object} settings (not used).
     */
    var chromeBTLE = function (path, settings) {

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
            requested_service = null,
            requested_characteristic = null,
            discovered_services = null,
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
            // chrome.bluetoothLowEnergy.writeCharacteristicValue(info.characteristic_uuid, data, callback);
        };

        /**
         * Read data from the BTLE device
         */
        this.read = function () {
            // self.trigger('data', data);
        }

        /**
         * Subscribe to a service/characteristic
         * @param {[[Type]]} subscribeInfo [[Description]]
         */

        this.subscribe = function (subscribeInfo) {
            if (!portOpen)
                return;

            requested_service = subscribeInfo.service_uuid.toLowerCase();
            requested_characteristic = subscribeInfo.characteristic_uuid.toLowerCase();
            selectService();

        };

        this.close = function () {
            console.log("[chromeBTLE] Close BTLE connection");
            if (!portOpen)
                return;

            // Disconnect and remove the various callbacks so that they can be garbage
            // collected
            chrome.bluetoothLowEnergy.disconnect(devAddress);
            chrome.bluetoothLowEnergy.onServiceAdded.removeListener(onServiceAdded);
            chrome.bluetoothLowEnergy.onServiceRemoved.removeListener(onServiceRemoved);

            chrome.bluetoothLowEnergy.onCharacteristicValueChanged.removeListener(onCharacteristicValueChanged);

            chrome.bluetooth.onDeviceAdded.removeListener(onDeviceAdded);
            chrome.bluetooth.onDeviceRemoved.removeListener(onDeviceRemoved);


            // Disable notifications from the currently selected characteristics
            if (currentCharacteristics) {
                chrome.bluetoothLowEnergy.stopCharacteristicNotifications(
                    currentCharacteristics.instanceId);
            }

            portOpen = false;
            this.trigger('status', {
                portopen: portOpen
            });
        };

        // Has to be called by the backend_driver to actually open the port.
        // This just connects to the device
        this.open = function () {
            chrome.bluetoothLowEnergy.connect(devAddress, function () {
                console.log('BTLE', 'Bluetooth connect completed');
                if (chrome.runtime.lastError) {
                    self.trigger('status', {
                        openerror: true,
                        reason: 'Device connection error',
                        description: chrome.runtime.lastError.message
                    });
                    // Do a disconnect to make sure we end up in a sane state:
                    // chrome.bluetoothLowEnergy.disconnect(devAddress);
                    return;
                }

                // Track GATT characteristic value changes. This event will be triggered
                // after successful characteristic value reads and received notifications
                // and indications.
                chrome.bluetoothLowEnergy.onCharacteristicValueChanged.addListener(onCharacteristicValueChanged);

                // Track services as they are added - sometimes the initial GetServices call
                // does not immediately return the services, we we go on listening in the background
                chrome.bluetoothLowEnergy.onServiceAdded.addListener(onServiceAdded);

                // Track devices as they are removed and added
                chrome.bluetooth.onDeviceRemoved.addListener(onDeviceRemoved);
                chrome.bluetooth.onDeviceAdded.addListener(onDeviceAdded);

                // This can happen either if the device is turned off, or it gets out
                // of range.
                chrome.bluetoothLowEnergy.onServiceRemoved.addListener(onServiceRemoved);

                // Track GATT services as they change.
                chrome.bluetoothLowEnergy.onServiceChanged.addListener(function (service) {
                    console.log('[ChromeBTLE] Service changed', service);
                });

                // Last, do a service discovery
                getServices();

            });
        }

        /////////////
        // Private methods
        /////////////

        // Get all get services on the BTLE device and select the service
        // matching the service_uuid we want:
        var getServices = function () {
            chrome.bluetoothLowEnergy.getServices(devAddress, function (services) {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError.message);
                    selectService(undefined);
                    return;
                }

                portOpen = true;
                discovered_services = services;
                self.trigger('status', {
                    portopen: portOpen,
                    services: services
                });
            });
        }

        /**
         * Return the InstanceID for a service UUID
         */
        var selectServiceByUUID = function(uuid) {
            if (discovered_services == null)
                return;

            for (var s in discovered_services) {
                if (discovered_services[s].uuid == uuid ||
                    uuid == discovered_services[s].uuid.substr(4,4))
                    return discovered_services[s];
            }
            return null;
        }

        // Inspired by Google Bluetooth samples on Github
        var selectService = function () {

            //if (currentService && (!service || currentService.deviceAddress !== service.deviceAddress)) {
            //    chrome.bluetoothLowEnergy.disconnect(currentService.deviceAddress);
            //}

            currentService = selectServiceByUUID(requested_service);
            currentCharacteristics = null;

            if (!currentService) {
                console.log('No service selected.');
                return;
            }

            console.log('GATT service selected: ' + currentService.instanceId);

            // Get the characteristics of the selected service.
            chrome.bluetoothLowEnergy.getCharacteristics(currentService.instanceId,
                function (chrcs) {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError.message);
                        return;
                    }

                    if (chrcs.length == 0) {
                        console.log('Service has no characteristics: ' + currentService.instanceId);
                        return;
                    }

                    chrcs.forEach(function (chrc) {
                        if (chrc.uuid == requested_characteristic ||
                            requested_characteristic == chrc.uuid.substr(4,4)
                        ) {
                            console.log('Setting Characteristic: ' +
                                chrc.instanceId);
                            currentCharacteristics = chrc;
                            //self.updateHeartRateMeasurementValue();
                            // Enable notifications from the characteristic.
                            chrome.bluetoothLowEnergy.startCharacteristicNotifications(
                                chrc.instanceId,
                                function () {
                                    if (chrome.runtime.lastError) {
                                        console.log(
                                            'Failed to enable characteristics notifications: ' +
                                            chrome.runtime.lastError.message);
                                        return;
                                    }

                                    console.log('Characteristics notifications enabled!');
                                });
                            return;
                        }
                    });
                });
        }

        /////////////
        //   Callbacks
        /////////////

        // Auto close if the device disappears
        function onDeviceRemoved(device) {
            console.log('[ChromeBTLE] Bluetooth device removed: ' + device.address);
            if (currentService && currentService.deviceAddress == device.address) {
                deviceDisappeared = true;
                self.close();
                // Re-add the listener for device added, otherwise we'll miss it coming
                // back
                chrome.bluetooth.onDeviceAdded.addListener(onDeviceAdded);

            }
        }

        // Auto reopen if the device reappears
        function onDeviceAdded(device) {
            console.log('[ChromeBTLE] Bluetooth device added: ' + device.address);
            if (!currentService && devAddress == device.address) {
                deviceDisappeared = false;
                self.open();
            }
        }

        // Follow up when service removed - this can happen when the device actually
        // removes the service, or it gets out of range for a short while
        function onServiceRemoved(service) {
            console.log('[ChromeBTLE] Service removed', service);
            if (service.uuid != service_uuid) {
                return;
            }

            // If this came from the currently selected service, then disconnect it.
            if (service.deviceAddress == devAddress && currentService) {
                selectService(undefined);
            }
        }

        function onServiceAdded(service) {
            console.log('[ChromeBTLT] Service added', service);
            // Ignore, if the service is not the one we want

            if (!requested_service)
                return;
            if (service.uuid != requested_service) {
                return;
            }

            // If this came from the currently selected device and no service is
            // currently selected, select this service.
            if (service.deviceAddress == devAddress && !currentService) {
                selectService();
            }
        }

        // This is where we get notifications
        function onCharacteristicValueChanged(chrc) {
            // Modify the response to be consistent with what the Cordova API
            // returns, so that the higher level drivers understand both
            // Pass it on to the driver
            chrc.service = chrc.service.uuid;
            chrc.characteristic = chrc.uuid;
            self.trigger('data', chrc);
        }

        console.log("[chromeBTLE] Chrome BTLE Library loaded");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(chromeBTLE.prototype, Backbone.Events);
    return chromeBTLE;
});