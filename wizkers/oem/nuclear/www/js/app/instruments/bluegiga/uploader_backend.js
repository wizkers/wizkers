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
        btleConnection = require('connections/btle'),
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
        var packets = [];
        var total_packets;

        var test_fw = null;

        var OTA_SERVICE_UUID = '1d14d6ee-fd63-4fa1-bfa4-8f47b42119f0';
        var OTA_CONTROL_UUID = 'f7bf3564-fb6d-4e53-88a4-5e37e0326063';
        var OTA_DATA_UUID    = '984227f3-34fc-4045-a5d0-2c581f81a153';

        // This is how it works:
        // - Read the OTA file
        // - Send it on the DATA_UUID by packets of 16 bytes
        // - After sending the last packet, write 0x03 to the CONTROL_UUID to reset
        //   the BLE113 to DFU mode. And cross fingers.

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
                var found_ota_service = false;
                for (var i in stat.services) {
                    if (stat.services[i].uuid == OTA_SERVICE_UUID)
                        found_ota_service = true;
                }
                if (found_ota_service) {
                    onOpen();
                } else {
                    var resp = {
                        openerror: true,
                        reason: 'OTA service not found',
                        description: 'This device does not provide the BlueGiga standard OTA service'
                    }
                    self.trigger('data', resp);
                    self.closePort();
                }
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
            // Tell our front-end that we're ready to get the firmware
            self.trigger('data', {ota_ready: true});
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
            console.info('Fimware byte size', firmware_binary.byteLength);

            if (firmware_binary.byteLength % 256 != 0) {
                self.trigger('data', {msg: 'Detected corrupt firmware file, not flashing!'});
                return;
            }

            var siz = firmware_binary.byteLength;
            packets = [];
            // Phase 1: reformat our firmware into a series of packets that we will then send
            // asynchronously over BLE
            for (var block = 0; block < siz/256; block++) {
                // Write 12 packets of 20 bytes:
                for (var ofs = 0; ofs < 12; ofs++) {
                    var packet = firmware_binary.subarray(block*256 + ofs*20, block*256 + (ofs+1)*20);
                    packets.push(packet);
                    //console.log('Start', block*256 + ofs*20, 'End', block*256 + (ofs+1)*20)
                    //console.info('packet', packet, '(length:', packet.byteLength, ')');
                }
                //console.log('16 byte remainder');
                var packet = firmware_binary.subarray(block*256 + 240, block*256+256);
                packets.push(packet);
                //console.log('Start', block*256 + 240, 'End', block*256 + 256);
                //console.log(packet, packet.byteLength);
            }

            total_packets = packets.length;
            if (testIdentical())
                writePacket();

        };

        var testIdentical = function() {
            var idx = 0;
            for (var i in packets) {
                var packet = packets[i];
                for (var j in packet) {
                    if (packet[j] != firmware_binary[idx++]) {
                        console.error('Error, packets not identical to original binary');
                        return false;
                    }
                }
            }
            return true;
        }

        var writeSuccess = function() {
            if (packets.length) {
                writePacket();
            } else {
                // We are done writing:
                port.write([0x03], {service_uuid: OTA_SERVICE_UUID, characteristic_uuid: OTA_CONTROL_UUID }, function(e){console.log(e);});
                stats.fullEvent('Firmware', 'fw_upgrade_success', 'BLEBee');
                self.trigger('data', { status:'ok', msg:'Firmware uploaded, flashing now. DO NOT TURN OFF your bGeigie nano before the blue LED turns off.'});
            }
        };

        var writePacket = function() {
            self.trigger('data', { writing: ((total_packets-packets.length)/total_packets)*100});
            var packet = packets.shift();
            port.write(packet,
                       {service_uuid: OTA_SERVICE_UUID, characteristic_uuid: OTA_DATA_UUID, type: 'noResponse' },
                       writeSuccess
                       );
        }
    };

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});