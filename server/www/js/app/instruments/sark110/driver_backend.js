/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
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
/*
 * Browser-side driver for the Sark110 antenna analyser.
 *
 * This Browser-side parser is used when running as a Chrome or Cordova app.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var Backbone = require('backbone'),
        Serialport = require('serialport'),
        abutils = require('app/lib/abutils'),
        hidConnection = require('connections_hid');

    var parser = function (socket) {

        /////////////
        // Private methods
        /////////////

        var SARK_FRAME_LEN = 18;
        var PAR_SARK_CAL = 1; /* OSL calibrated val */
        var PAR_SARK_UNCAL = 2; /* Raw val */
        var CMD_SARK_VERSION = 1; /* Returns version of the protocol */
        var CMD_SARK_MEAS_RX = 2; /* Measures R and X */
        var CMD_SARK_MEAS_VECTOR = 3; /* Measures raw vector data */
        var ANS_SARK_OK = 0x4f;
        var ANS_SARK_ERR = 0x45;

        var socket = socket;

        var self = this,
            port = null,
            port_close_requested = false,
            isopen = false,
            commandQueue = [];

        var portSettings = function () {};

        // Format receives incoming data from the device, and then
        // forwards the formated data to the app through a 'data' event.
        var format = function (data) {
            var reply = {};
            var pendingCommand = commandQueue.shift();
            var ui = new Uint8Array(data);
            if (ui[0] != ANS_SARK_OK) {
                self.trigger('data', {
                    error: 'Command error'
                });
                return;
            }
            switch (pendingCommand.cmd) {
            case "version":
                var version = ('0' + ui[1].toString(16)).slice(-2);
                version += ('0' + ui[2].toString(16)).slice(-2);
                reply = {
                    version: version
                };
                break;
            case "RX":
                var temp = new Uint8Array(4);
                for (var i = 0; i < 4; i++)
                    temp[i] = ui[i + 1];
                var res = Bytes2Float32(temp);
                for (var i = 0; i < 4; i++)
                    temp[i] = ui[i + 5];
                var react = Bytes2Float32(temp);
                reply = {
                    R: res,
                    X: react,
                    F: pendingCommand.frequency
                };
                break;
            }
            self.trigger('data', reply);
            if (commandQueue.length > 0) {
                processNextCommand();
            }
        };


        // Status returns an object that is concatenated with the
        // global server status
        var status = function (stat) {
            console.log('Port status change', stat);
            isopen = stat.portopen;

            if (isopen) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    port.off('status', stat);
                    port_close_requested = false;
                }
            }
        };

        var processNextCommand = function () {
            var data = commandQueue[0];
            var bytes = new Uint8Array(SARK_FRAME_LEN);
            if (data.cmd == 'version') {
                //Send CMD_SARK_VERSION
                bytes[0] = CMD_SARK_VERSION;
            } else if (data.cmd == 'RX') {
                bytes[0] = CMD_SARK_MEAS_RX;
                var freq = data.frequency;
                bytes[4] = ((freq & 0xff000000) >> 24);
                bytes[3] = ((freq & 0x00ff0000) >> 16);
                bytes[2] = ((freq & 0x0000ff00) >> 8);
                bytes[1] = ((freq & 0x000000ff) >> 0);
                bytes[5] = PAR_SARK_CAL;
            }
            port.write(0, bytes.buffer, function () {
                port.read()
            });
        };

        function Bytes2Float32(bytes) {
            return decodeFloat(bytes, 1, 8, 23, -126, 127, true);
        }

        function decodeFloat(bytes, signBits, exponentBits, fractionBits, eMin, eMax, littleEndian) {
            var totalBits = (signBits + exponentBits + fractionBits);

            var binary = "";
            for (var i = 0, l = bytes.length; i < l; i++) {
                var bits = bytes[i].toString(2);
                while (bits.length < 8)
                    bits = "0" + bits;

                if (littleEndian)
                    binary = bits + binary;
                else
                    binary += bits;
            }

            var sign = (binary.charAt(0) == '1') ? -1 : 1;
            var exponent = parseInt(binary.substr(signBits, exponentBits), 2) - eMax;
            var significandBase = binary.substr(signBits + exponentBits, fractionBits);
            var significandBin = '1' + significandBase;
            var i = 0;
            var val = 1;
            var significand = 0;

            if (exponent == -eMax) {
                if (significandBase.indexOf('1') == -1)
                    return 0;
                else {
                    exponent = eMin;
                    significandBin = '0' + significandBase;
                }
            }

            while (i < significandBin.length) {
                significand += val * parseInt(significandBin.charAt(i));
                val = val / 2;
                i++;
            }

            return sign * significand * Math.pow(2, exponent);
        }

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            var ins = instrumentManager.getInstrument();
            port = new hidConnection({
                "vendorId": 1155,
                "productId": 22352
            });
            port.on('data', format);
            port.on('status', status);
        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            port.off('data', format);
            port_close_requested = true;
            port.close();
        }

        this.isOpen = function () {
            return isopen;
        }

        this.getInstrumentId = function (arg) {};

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Geiger counter GUID.
        this.sendUniqueID = function () {
            self.trigger('data', {
                uniqueID: '00000000 (n.a.)'
            });
        };

        this.isStreaming = function () {
            return true;
        };

        // period in seconds
        this.startLiveStream = function (period) {};

        this.stopLiveStream = function (args) {};

        /**
         * Forwards data to the port driver (USB HID in our case)
         * @param {Uint8Array} data The data to sent
         */
        this.output = function (data) {
            // Save the command, because the Sark110 does not
            // echo it in its response, so we need to track this
            // on our side
            commandQueue.push(data);
            if (commandQueue.length == 1)
                processNextCommand();
        };

    }

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});