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
 *  USB HID connection for Cordova. This requires the Chrome USB
 * plugin to be installed in Cordova, and implements the basic HID layer
 * using only the raw USB API.
 *  Should work on Chrome too, but there is a higher level API for HID on that platform,
 * which is required for OS'es like MacOS who automatically claims HID devices which means
 * that we can't access them at this low level.
 *
 * Opens at create, sends 'data' events,
 * and 'status' events.
 *
 * Supports a "write" method.
 */

define(function (require) {

    "use strict";

    var Backbone = require('backbone'),
        abu = require('app/lib/abutils');

    /**
     * Instanciates a USB HID connection
     * @param {Object} path     Object containing vendorId/deviceId for the USB connection
     * @param {Object} settings TbD
     */
    var chromeHID = function (path, settings) {

        /////////
        // Initialization
        /////////
        var portOpen = false,
            currentDevice = null,
            self = this,
            connectionId = -1,
            interfaceId = -1,
            dataInEndpoint = -1,
            dataInPacketSize = -1,
            dataOutEndpoint = -1,
            dataOutPacketSize = -1;

        // Right now, we are just going to open the first available device that matches
        // the VID/PID.
        chrome.usb.getDevices({ filters: [ path ] }, onDevicesEnumerated);

        ///////////
        // Public methods
        ///////////

        /**
         * Send data to the device.
         *
         * @param {integer} reportId the reportId to use, or 0 if none
         * @param {ArrayBuffer} data The command, already formatted for sending.
         */
        this.write = function (reportId, data, callback) {
            if (!portOpen)
                return;
            if (data.length > dataOutPacketSize)
                return;
            var transferInfo = {
                direction: 'out',
                endpoint: dataOutEndpoint,
                length: data.byteLength,
                data: data,
                timeout: 200
            };
            chrome.usb.interruptTransfer(connectionId, transferInfo, function(info) {
                if (info.resultCode != 0) {
                    console.error("HID Transfer error!")
                }
                if (callback) {
                    callback(info.data);
                }
            })
        };

        /**
         * Receive data from the HID device
         */
        this.read = function () {
            var transferInfo = {
                direction: 'in',
                endpoint: dataInEndpoint,
                length: dataInPacketSize,
                timeout: 0
            }
            chrome.usb.interruptTransfer(connectionId, transferInfo, function (info) {
                if (info.resultCode != 0) {
                    console.error("HID Transfer error!")
                }
                self.trigger('data', info.data);
            });
        }

        this.close = function (port) {
            console.log("[Cordova USB HID] Close USB Peripheral");
            if (!portOpen)
                return;
            chrome.usb.releaseInterface(connectionId, interfaceId, function () {
                chrome.usb.closeDevice(connectionId, function() {
                    portOpen = false;
                    self.trigger('status', {
                        portopen: portOpen
                    });
                });
            });
        };

        /////////////
        //   Callbacks
        /////////////

        function onDevicesEnumerated(devices) {
            if (devices.length != 1) {
                // Tell our front-end what's happening
                    self.trigger('status', {
                        openerror: true,
                        reason: 'Device not found',
                        description: 'Please check that your device is connected to the USB port. This driver only supports one device at a time, so make sure you are not connecting several identical devices at the same time.'
                    });
                return;
            }
            currentDevice = devices[0];
            // Now look for a HID interface on the device:
            chrome.usb.openDevice(currentDevice, function(handle) {
                connectionId = handle;
                chrome.usb.listInterfaces(connectionId, function(interfaces) {
                    // Look for an interface that is a USB HID interface:
                    // Note: we take the first one, not sure there are devices without
                    // multiple HID interfaces ?
                    var myInterface;
                    for (var i in interfaces) {
                        if (interfaces[i].interfaceClass == 3) {
                            interfaceId = interfaces[i].interfaceNumber;
                            myInterface = interfaces[i]; // Need for looking for endpoints
                            break;
                        }
                    }
                    if (interfaceId == -1) {
                        self.trigger('status', {
                            openerror: true,
                            reason: 'Device error',
                            description: 'Could not find a HID interface on this USB device.'
                        });
                    }
                    // We also need to keep track of the HID endpoints:
                    // We always have an "in" endpoint:
                    for (var i in myInterface.endpoints) {
                        if (myInterface.endpoints[i].direction == 'in') {
                            dataInEndpoint = myInterface.endpoints[i].address;
                            dataInPacketSize = myInterface.endpoints[i].maximumPacketSize;
                        }
                        if (myInterface.endpoints[i].direction == 'out') {
                            dataOutEndpoint = myInterface.endpoints[i].address;
                            dataOutPacketSize = myInterface.endpoints[i].maximumPacketSize;
                        }
                    }

                    // We can now claim our interface:
                    chrome.usb.claimInterface( connectionId, interfaceId, function() {
                        portOpen = true;
                        self.trigger('status', {
                            portopen: portOpen
                        });
                    });
                });
            });
        }

        console.log("[chromeHID] Chrome Raw USB HID Library loaded");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(chromeHID.prototype, Backbone.Events);
    return chromeHID;
});