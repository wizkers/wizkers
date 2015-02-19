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
        Serialport = require('serialport'),
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
         * Send data to the serial port.
         * cmd has to be either a String or an ArrayBuffer
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
            if (devices.length != 1)
                return;
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