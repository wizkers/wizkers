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
 *  An firmware upgrader interface for the Onyx
 *
 * This is actually a generic STM32 Serial bootloader protocol implementation
 *  as per AN3155 (see st.com)
 *
 *
 * This Browser-side parser is used when running as a Chrome or Cordova app.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var Backbone = require('backbone'),
        Serialport = require('serialport'),
        serialConnection = require('connections_serial'),
        abu = require('app/lib/abutils');

    var parser = function (socket) {

        /////////////
        // Private variables
        /////////////

        var socket = socket;
        var portOpenCallback = null;
        var portPath = "";

        var self = this,
            port = null,
            port_close_requested = false,
            isopen = false;


        var inputBuffer = new Uint8Array(1024); // Receive buffer
        var ibIdx = 0;
        var watchdog = null;

        // Since serial read/write is async, we keep track of our state globally.
        //
        var States = {
            IDLE: 0,
            WAIT_ACK: 1, // Wait for an Ack and return
            WAIT_ACK_AND_SIZE: 2, // Wait for an Ack then a length byte 
            WAIT_SIZE: 3, // Wait for a length byte
            RECEIVING: 4, // Waiting for more data
            WAIT_FINAL_ACK: 5, // Waiting for the final ACK
            BOOTLOADER_INIT: 6,
            BOOTLADER_READY: 7

        }
        var current_state = States.IDLE;
        var bootloader_state = States.BOOTLOADER_INIT;

        // Defines for the STM32 Bootloader protocol
        var STM32 = {
            GET_VERSION: 0x00,
            GET_VERSION_READ_PROTECTION: 0x01,
            GET_ID: 0x02,
            READ_MEMORY: 0x11,
            GO: 0x21,
            WRITE_MEMORY: 0x31,
            ERASE: 0x43,
            EXTENDED_ERASE: 0x44,
            WRITE_PROTECT: 0x63,
            WRITE_UNPROTECT: 0x73,
            READ_PROTECT: 0x82,
            READ_UNPROTECT: 0x92,

            INIT_BL: 0x7f,
            ACK: 0x79,
            NACK: 0x1f,
            ERROR: 0xff
        }

        var retries = 0;
        var readCb = null; // the function that expects data from the last write
        var bytesExpected = 0;

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            var ins = instrumentManager.getInstrument();
            // portOpenCallback = callback;
            portPath = ins.get('port');
            // Send a command to reboot in bootloader mode and continue
            port = new serialConnection(portPath, portSettings());
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
                // We got an IntelHex file to upload to the board
                //var bindata = intelhex.parse(data.upload_hex).data;
                //flashBoard(0, abu.pad(bindata, 128));
            }
            return '';
        };

        /////////
        // Callbacks
        /////////


        ///////////////////////////////////
        //  Private methods
        ///////////////////////////////////

        var portSettings = function () {
            return {
                baudRate: 115200,
                dataBits: 8,
                parity: 'even', // EVEN PARITY for this protocol!
                stopBits: 1,
                dtr: false,
                flowControl: false,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: Serialport.parsers.raw,
            }
        };

        /**
         * Acts on data coming in from the device. Depending on our state, we
         * either call the predefined callback if we got an ACK, or return
         * an error.
         * @param {Object} data A BufferedArray with the incoming data
         */
        var format = function (data) {
            var d = new Uint8Array(data);

            if (current_state != States.IDLE) {
                inputBuffer.set(new Uint8Array(data), ibIdx);
                ibIdx += data.byteLength;

                console.log('state', current_state);
                console.log('read', inputBuffer);
            } else {
                console.log('read (discard)', data.buffer);
                return;
            }
            switch (current_state) {
            case States.WAIT_ACK:
                clearTimeout(watchdog);
                current_state = States.IDLE;
                if (readCb) {
                    var res = {};
                    if (inputBuffer[0] != STM32.ACK && inputBuffer[0] != STM32.NACK) {
                        res.status = 'error';
                    } else {
                        res.status = 'ok';
                    }
                    res.data = inputBuffer[0];
                    current_state = States.IDLE;
                    readCb(res);
                }
                break;
            case States.WAIT_ACK_AND_SIZE:
                var b = inputBuffer[0];
                current_state = States.WAIT_SIZE;
                if (b != STM32.ACK) {
                    clearTimeout(watchdog);
                    if (readCb)
                        readCb({
                            status: 'error',
                            data: inputBuffer[0]
                        });
                    return;
                }
                // break;  // Don't break, the byte may already be waiting for us
            case States.WAIT_SIZE:
                if (ibIdx < 2)
                    break;
                var s = inputBuffer[1];
                bytesExpected = s + 2; // +2 because of ACK and Length bytes
                current_state = States.RECEIVING;
                // break;  // Don't break, the byte may already be waiting for us

            case States.RECEIVING:
                if (ibIdx >= bytesExpected - 1) {
                    current_state = States.WAIT_FINAL_ACK;
                }

            case States.WAIT_FINAL_ACK:
                current_state = States.IDLE;
                clearTimeout(watchdog);
                if (ibIdx < bytesExpected) {
                    if (readCb)
                        readCb({
                            status: 'error'
                        });
                    break;
                }
                bytesExpected = -1;
                if (readCb) {
                    // We return the complete buffer (including acks etc)
                    readCb({
                        status: 'OK',
                        data: inputBuffer.subarray(0, ibIdx)
                    });
                }
                break;
            default:
                break;
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
         * Send a command to the Onyx to get into Bootloader mode
         */
        var resetToBootloader = function () {
            port.write('{"set":{"reset":"bootloader"}}\n');

            // Wait 500ms then get into Bootloader mode and detect
            // the protocol
            var nxt = function () {
                initBootloader(function (res) {});
            }
            setTimeout(nxt, 500);
        }

        /**
         * Start the protocol
         */
        var onOpen = function (success) {
            console.log("We have the board in uploader mode now");
            resetToBootloader();
        };

        // Not used
        var onClose = function (success) {
            console.log("STM32 upgrader: got a port close signal");
        };

        /**
         * Write data, with a timeout and a callback
         * data : the data to write (Arraybuffer)
         * op   : the type of operation: either WAIT_ACK or WAIT_ACK_AND_SIZE or other
         * delay: a timeout before calling the callback with an error message
         * callback: function that expects the response
         */
        var write = function (data, op, delay, callback) {
            readCb = callback;
            ibIdx = 0;
            current_state = op;

            // Define a timeout callback in case something
            // goes wrong:
            function to() {
                readCb({
                    status: 'timeout',
                    data: ''
                });
            }
            watchdog = setTimeout(to, delay);
            console.log('write', data);
            port.write(data);
        }

        /**
         * Create a command packet w/ checksum
         * @param {Number}   command  The command (see the STM32 object above)
         */
        var makeCommand = function (command) {
            var data = new Uint8Array(2);
            data[0] = command;
            data[1] = ~command;
            return data;
        }

        /**
         * Initialize the STM32 Bootloader protocol.
         *  @param {Function} cb Callback once in bootloader mode
         */
        var initBootloader = function () {
            var d = new Uint8Array(1);
            d[0] = STM32.INIT_BL;
            write(d, States.WAIT_ACK, 500, function (res) {
                if (res.data != STM32.ACK)
                    return;
                getBLVersion();
            });
        }

        /**
         * Get the Bootloader version.
         * @param {Function} cb callback
         */
        var getBLVersion = function () {
            var minor = 0x0;
            var major = 0x0;
            var d = makeCommand(STM32.GET_VERSION)
            write(d, States.WAIT_ACK_AND_SIZE, 500, function (res) {
                if (res.status != 'OK') {
                    self.trigger('data', {
                    'status': 'Error: could not initialize bootloader'
                });
                }
                // Byte 3 is BT version
                var version = res.data[3]
            });
        }

        var getChipID = function () {}

        /**
         * Flash the Onyx. Steps are as follows:
         *    1. Init Bootloader
         *    2. Get/Check Version
         *    3. Get/Check ChipID
         *    4. Write Unprotect
         *    5. Read Unprotect
         *    6. Erase Flash
         *    7. Program Flash
         *    8. Issue GO command to start FW (?)
         * @param {[[Type]]} address [[Description]]
         * @param {[[Type]]} data    [[Description]]
         */
        var flashBoard = function (address, data) {

        };

    }

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});