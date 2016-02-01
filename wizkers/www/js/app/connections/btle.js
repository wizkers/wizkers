/** (c) 2015 Edouard Lafargue, ed@lafargue.name
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
     * @param {Object} settings contains two values: service_uuid and characteristic_uuid
     *                          Todo: also add a flag to return all services for discovery by
     *                          front-end.
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
            service_uuid = settings.service_uuid.toLowerCase(),
            characteristic_uuid = settings.characteristic_uuid.toLowerCase(),
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
                getServices();

        }

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
                portOpen = true;
                self.trigger('status', {
                    portopen: portOpen
                });

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

                var foundService = undefined;
                services.forEach(function (service) {
                    if (service.uuid == service_uuid) {
                        foundService = service;
                    }
                });

                selectService(foundService);
            });
        }

        // Inspired by Google Bluetooth samples on Github
        var selectService = function (service) {

            //if (currentService && (!service || currentService.deviceAddress !== service.deviceAddress)) {
            //    chrome.bluetoothLowEnergy.disconnect(currentService.deviceAddress);
            //}

            currentService = service;
            currentCharacteristics = null;

            if (!service) {
                console.log('No service selected.');
                return;
            }

            console.log('GATT service selected: ' + service.instanceId);

            // Get the characteristics of the selected service.
            chrome.bluetoothLowEnergy.getCharacteristics(service.instanceId,
                function (chrcs) {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError.message);
                        return;
                    }

                    // Make sure that the same service is still selected.
                    if (service.instanceId != currentService.instanceId) {
                        return;
                    }

                    if (chrcs.length == 0) {
                        console.log('Service has no characteristics: ' + service.instanceId);
                        return;
                    }

                    chrcs.forEach(function (chrc) {
                        if (chrc.uuid == characteristic_uuid) {
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
            if (service.uuid != service_uuid) {
                return;
            }

            // If this came from the currently selected device and no service is
            // currently selected, select this service.
            if (service.deviceAddress == devAddress && !currentService) {
                selectService(service);
            }
        }

        // This is where we get notifications
        function onCharacteristicValueChanged(chrc) {
            // Pass it on to the driver
            self.trigger('data', chrc);
        }

        console.log("[chromeBTLE] Chrome BTLE Library loaded");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(chromeBTLE.prototype, Backbone.Events);
    return chromeBTLE;
});