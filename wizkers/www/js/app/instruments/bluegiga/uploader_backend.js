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
 *  An firmware upgrader interface for BlueGiga BLE devices supporting
 *  the standard OTA protocol.
 *
 * This Browser-side parser is used when running as a Chrome or Cordova app.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var Backbone = require('backbone'),
        btleConnection = require('connections_btle'),
        abu = require('app/lib/abutils');

    var parser = function (socket) {

        /////////////
        // Private variables
        /////////////

        var portOpenCallback = null;
        var portPath = "";

        var self = this,
            port = null,
            socket = socket,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        var retries = 0;
        var readCb = null; // the function that expects data from the last write
        var bytesExpected = 0;

        var firmware_binary = null;
        
        var OTA_SERVICE_UUID = '1d14d6ee-fd63-4fa1-bfa4-8f47b42119f0';
        var OTA_CONTROL_UUID = 'f7bf3564-fb6d-4e53-88a4-5e37e0326063';
        var OTA_DATA_UUID = '984227f3-34fc-4045-a5d0-2c581f81a153';


        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            port = new btleConnection(ins.get('port'), null);
            port.open();
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

        this.isOpenPending = function () {
            return port_open_requested;
        }

        this.getInstrumentId = function (arg) {};

        this.sendUniqueID = function () {};

        this.isStreaming = function () {
            return false;
        };

        this.startLiveStream = function () {};

        this.stopLiveStream = function () {};

        // output does not change anything here, but we
        // use it as the entry point for higher level commands
        // coming from the front-end, such as firmware upload etc...
        this.output = function (data) {
            //console.log(data);
            if (data == "bootloader") {
                startBootloader();
            } else
            if (data.upload_bin) {
                firmware_binary = new Uint8Array(data.upload_bin);
                flashBoard();
            }
            return '';
        };

        /////////
        // Callbacks
        /////////


        ///////////////////////////////////
        //  Private methods
        ///////////////////////////////////

        /**
         * Acts on data coming in from the device. Depending on our state, we
         * either call the predefined callback if we got an ACK, or return
         * an error.
         * @param {Object} data A BufferedArray with the incoming data
         */
        var format = function (data) {
            var d = new Uint8Array(data);
        };

        // Status returns an object that is concatenated with the
        // global server status
        var status = function (stat) {
            port_open_requested = false;
            console.log('Port status change', stat);
            if (stat.openerror) {
                // We could not open the port: warn through
                // a 'data' messages
                var resp = {
                    openerror: true
                };
                if (stat.reason != undefined)
                    resp.reason = stat.reason;
                if (stat.description != undefined)
                    resp.description = stat.description;
                self.trigger('data', resp);
                return;
            }
            isopen = stat.portopen;

            if (isopen && stat.services) {
                // Will run any "onOpen" initialization routine here if
                // necessary.
                console.log('We found those services', stat.services);
                onOpen();
            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    port.off('status', stat);
                    port_close_requested = false;
                }
            }
        };

        /**
         * Start the protocol
         */
        var onOpen = function (success) {
            console.log("Need to start sending data to the OTA endpoint");
        };

        // Not used
        var onClose = function (success) {
            console.log("BlueGiga upgrader: got a port close signal");
        };

        /**
         * Write a flash page
         * @param {Number} offset offset within the firmware file (a Uint8Array)
         */
        var writeFlash = function (offset) {
        }

        /**
         * Flash the device. Steps are as follows:
         * 
         * see: http://community.silabs.com/t5/Wireless-Knowledge-Base/REFERENCE-Updating-BLE-module-firmware-using-OTA-DFU/ta-p/147801
         * 
         * Assuming your peripheral device has implemented the proper server-side support for receiving an OTA image as described above,
         * the client-side OTA procedure is as follows (assuming you have the .ota file already and have connected to the peripheral and
         * discovered the GATT structure):
         * 
         * Write command (0x04) to control point characteristic to power on flash (not needed for internal flash)
         * Write command(s) (0x00 and then 0x01) to control point characteristic to erase flash
         *          (not needed for internal flash, see ERASE NOTE above)
         * Write command (0x02) to control point characteristic to reset flash write address pointer (not needed for internal flash)
         * Repeatedly write blocks of data in 16-byte or 20-byte increments to data transfer
         *          characteristic until all pages have been written
         *          
         * PACKET SIZE NOTE: the maximum single BLE packet payload size is 20 bytes, but this not break evenly into a 2048-byte page of
         * flash. It is important to ensure that data is transferred breaks on page boundaries, since otherwise logic to handle this must
         * be added to the receiving end. However, using a packet size that is page-boundary-friendly (such as 16) for every transfer
         * results in wasted potential throughput. Therefore, the recommended solution is to keep track of the transfer position on the
         * client side, and write 20-byte packets exactly 12 times (240 bytes) followed by one 16-byte packet, for a total of 256 bytes.
         * This will divide evenly into nearly any commonly sized flash page whether you use internal or external flash.
         * 
         * Write command (0x03) to control point characteristic to trigger DFU mode reset
         */
        var flashBoard = function () {
            console.log('***************** Start Flashing ********************');
        };
    };

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});