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
 *  USB HID connection
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
            connectionId = -1;

        // Right now, we are just going to open the first available device that matches
        // the VID/PID.
        chrome.hid.getDevices(path, onDevicesEnumerated);

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
            chrome.hid.send(connectionId, reportId, data, (callback) ? callback : function () {});
        };

        /**
         * Receive data from the HID device
         */
        this.read = function () {
            chrome.hid.receive(connectionId, function (reportId, data) {
                self.trigger('data', data);
            });
        }

        this.close = function (port) {
            console.log("[chromeHID] Close USB Peripheral");
            if (!portOpen)
                return;
            chrome.hid.disconnect(connectionId, function () {
                portOpen = false;
                self.trigger('status', {
                    portopen: portOpen
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
            chrome.hid.connect(currentDevice.deviceId, function (connectInfo) {
                if (!connectInfo) {
                    console.warn("Unable to connect to device.");
                }
                connectionId = connectInfo.connectionId;
                portOpen = true;
                self.trigger('status', {
                    portopen: portOpen
                });
            });
        }

        console.log("[chromeHID] Chrome HID Library loaded");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(chromeHID.prototype, Backbone.Events);
    return chromeHID;
});