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
            port_open_requested = false,
            first_open_done = false, // Windows generates a system error when we get
            // into bootloader mode, so we need to detect it.
            isopen = false;


        var inputBuffer = new Uint8Array(1024); // Receive buffer
        var ibIdx = 0;
        var watchdog = null;
        var blConnectionRetries = 0;

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
            BOOTLADER_READY: 7,
            WAIT_DOUBLE_ACK: 8, // Wait for two ACKs in a row (read/write unprotect operations)
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

            BUF_SIZE: 256,

            INIT_BL: 0x7f,
            ACK: 0x79,
            NACK: 0x1f,
            ERROR: 0xff,

            FLASH_START: 0x08000000,
        }

        var retries = 0;
        var readCb = null; // the function that expects data from the last write
        var bytesExpected = 0;

        var firmware_binary = null;

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            // portOpenCallback = callback;
            portPath = ins.get('port');
            // Send a command to reboot in bootloader mode and continue
            port = new serialConnection(portPath, portSettings());
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
                // We got an IntelHex file to upload to the board
                //var bindata = intelhex.parse(data.upload_hex).data;
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
            } else {
                console.log('read (discard)', data.buffer);
                return;
            }
            var ack_idx = 0; // used when checking two subsequent ACKs

            // Note: depending on OS, speed, etc, we might receive all the response data
            // at once or in multiple 'format' calls: the switch statement below supports
            // both situations, which is why we do not break after each case statement.
            switch (current_state) {
            case States.WAIT_DOUBLE_ACK:
                //console.log('WAIT_DOUBLE_ACK', inputBuffer[0]);
                if (inputBuffer[0] != STM32.ACK && inputBuffer[0] != STM32.NACK) {
                    var res = {
                        status: 'error'
                    };
                    if (readCb)
                        readCb(res);
                    return;
                } else {
                    current_state = States.WAIT_ACK;
                    if (ibIdx > 1) {
                        ack_idx = 1;
                    } else {
                        break; // no extra data waiting
                    }
                }
            case States.WAIT_ACK:
                clearTimeout(watchdog);
                current_state = States.IDLE;
                //console.log('WAIT_ACK', inputBuffer[0]);
                if (readCb) {
                    var res = {};
                    if (inputBuffer[ack_idx] != STM32.ACK && inputBuffer[ack_idx] != STM32.NACK) {
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
                //console.log('WAIT_ACK_AND_SIZE', inputBuffer[0]);
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
                bytesExpected = s + 4; // +4 because of ACK + final ACK + Length byte
                // and length byte is 'number of payload bytes - 1'
                current_state = States.RECEIVING;
                //console.log('WAIT_SIZE', bytesExpected);
                // break;  // Don't break, the byte may already be waiting for us

            case States.RECEIVING:
                //console.log('RECEIVING');
                if (ibIdx >= bytesExpected - 1) {
                    current_state = States.WAIT_FINAL_ACK;
                } else {
                    // We are still waiting for more data
                    break;
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
                    var resp = inputBuffer.subarray(0, ibIdx);
                    //console.log('WAIT_FINAL_ACK', resp);
                    readCb({
                        status: 'ok',
                        data: resp
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
            port_open_requested = false;
            console.log('Port status change', stat);
            if (stat.openerror) {
                // We issue with the port: warn through
                // a 'data' messages
                var resp = {
                    status: 'ok'
                };
                if (stat.description == "system_error")
                    resp.msg = "Windows specific - waiting for port recovery";
                self.trigger('data', resp);
                return;
            }
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
            console.log('resetToBootloader');
            port.write('{"set":{"reset":"bootloader"}}\n');
            console.log('bootloader reset done');
            self.trigger('data', {
                status: 'ok',
                msg: 'Waiting 3 seconds for device reboot to bootloader'
            });

            // Wait 3s then get into Bootloader mode and detect
            // the protocol
            var nxt = function () {
                    blConnectionRetries = 0;
                    initBootloader(getBLVersion);
                }
                // Wait 3 seconds, because on Windows, the command above triggers
                // a driver error, so we need time to close/reopen the port.
            setTimeout(nxt, 5000);
        }

        /**
         * Start the protocol
         */
        var onOpen = function (success) {
            console.log("We have the board in uploader mode now");
            if (first_open_done)
                return; // We end up here on Windows, where the FTDI driver generates an error
            // after the Onyx reboots into bootloader, and requires closing/opending the
            // driver again. Pretty dumb, but hey, that's Windows for you.
            first_open_done = true;
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
            // console.log('write', data);
            port.write(data);
        }

        /**
         * Create a command packet w/ checksum
         * @param {Number}   command  The command (see the STM32 object above)
         */
        var makeCommand = function (command) {
            return new Uint8Array([command, ~command]);
        }

        /**
         * Create an address structure (4 bytes + checksum)
         * @param {Number} address Address
         */
        var makeAddress = function (address) {
            var data = new Uint8Array(5);
            data[0] = address >> 24;
            data[1] = (address >> 16) & 0xff;
            data[2] = (address >> 8) & 0xff;
            data[3] = address & 0xff;
            data[4] = data[0] ^ data[1] ^ data[2] ^ data[3];
            return data;
        }

        /**
         * Initialize the STM32 Bootloader protocol.
         *  @param {Function} cb Callback once in bootloader mode
         */
        var initBootloader = function (cb) {
            console.log('initBootloader');
            var d = new Uint8Array([STM32.INIT_BL]);
            write(d, States.WAIT_ACK, 500, function (res) {
                if (res.data != STM32.ACK) {
                    self.trigger('data', {
                        status: 'error',
                        msg: 'Retrying bootloader connection'
                    });
                    if (blConnectionRetries++ < 5)
                        port.flush( function() {
                            initBootloader(cb);
                        });
                    return;
                }
                // move on to the next step:
                self.trigger('data', {
                    status: 'ok',
                    msg: 'established communication with the bootloader'
                });
                cb();
            });
        }

        /**
         * Get the Bootloader version.
         * @param {Function} cb callback
         */
        var getBLVersion = function () {
            console.log('getBLVersion');
            var minor = 0x0;
            var major = 0x0;
            var d = makeCommand(STM32.GET_VERSION)
            write(d, States.WAIT_ACK_AND_SIZE, 500, function (res) {
                if (res.status != 'ok') {
                    self.trigger('data', {
                        status: 'error',
                        msg: 'could not get Bootloader version'
                    });
                    return;
                }
                var l = res.data[1]; // Length of response (not used yet)
                // Byte 3 is BT version
                var version = res.data[2];
                // The rest of the data is the command list, we don't use it for now
                self.trigger('data', {
                    status: 'ok',
                    version: version
                });
                getChipID();
            });
        }

        /**
         *  Get the Chip ID
         */
        var getChipID = function () {
            console.log('getChipID');
            var d = makeCommand(STM32.GET_ID);
            write(d, States.WAIT_ACK_AND_SIZE, 500, function (res) {
                if (res.status != 'ok') {
                    self.trigger('data', {
                        status: 'error',
                        msg: 'could not get Chip ID'
                    });
                    return;
                }
                var l = res.data[1]; // PID length
                if ((l + 4) > res.data.byteLength) {
                    self.trigger('data', {
                        status: 'error',
                        msg: 'chipID response corrupted',
                        data: res.data
                    });
                    return;
                }
                var chipID = res.data.subarray(2, 2 + l + 1);
                if (l == 1) {
                    // Convert to BCD-style response.
                    var chipID = chipID[0] * 100 + chipID[1];
                }
                self.trigger('data', {
                    status: 'ok',
                    chipID: chipID
                });
                // At this stage, we stop: the front-end will check the ChipID and decide to
                // send the firmware or not.a
            });
        }

        /**
         * Remove flash write protection
         * @param {Function} cb Callback called once the MCU is reset and re-initialized
         */
        var writeUnprotect = function (cb) {
            console.log('writeUnprotect ');
            var d = makeCommand(STM32.WRITE_UNPROTECT);
            write(d, States.WAIT_DOUBLE_ACK, 500, function (res) {
                if (res.status != 'ok') {
                    self.trigger('data', {
                        status: 'error',
                        msg: 'could not write unprotect the flash'
                    });
                    return;
                }
                // After write unprotect, the chip resets: we need to reinit
                // the bootloader and move on to the next step:
                self.trigger('data', {
                    status: 'ok',
                    msg: 'flash write protection disabled, device is resetting'
                });
                initBootloader(cb);
            });
        };

        /**
         * Erase the device flash. note that this is the 'standard erase',
         * which is the command supported by the Medcom Onyx. There is an
         * extended erase comand for Bootloader version > 2 which is not
         * implemented here.
         */
        var eraseFlash = function (cb) {
            console.log('eraseFlash'); // the bootloader and move on to the next step:
            self.trigger('data', {
                status: 'ok',
                msg: 'erasing flash...'
            });

            var d = makeCommand(STM32.ERASE);
            write(d, States.WAIT_ACK, 500, function (res) {
                if (res.status != 'ok') {
                    self.trigger('data', {
                        status: 'error',
                        msg: 'could not initiate flash erase'
                    });
                    return;
                }
                // Ask for a global Chip erase:
                d = new Uint8Array([0xff, 0x00]);
                write(d, States.WAIT_ACK, 500, function (res) {
                    if (res.status != 'ok') {
                        self.trigger('data', {
                            status: 'error',
                            msg: 'could not global erase the flash'
                        });
                        return;
                    }
                    // We are good now, let's start with page writing at page zero
                    // the bootloader and move on to the next step:
                    self.trigger('data', {
                        status: 'ok',
                        msg: '...flash erased',
                    });
                    cb();
                });
            });
        };

        /**
         * Write a flash page
         * @param {Number} offset offset within the firmware file (a Uint8Array)
         */
        var writeFlash = function (offset) {
            var last_write = false;

            // 1. Prepare the data buffer:
            // Our buffer is as follows:
            // [0] : length - 1
            // [1-256] : data
            // [257] : checksum
            var buf = new Uint8Array(STM32.BUF_SIZE + 2);
            // We can write max 256 bytes of data on each packet (STM32.BUF_SIZE)
            // and the size of the data has to be a multiple of four
            if (firmware_binary.byteLength > (offset + STM32.BUF_SIZE)) {
                buf.set(firmware_binary.subarray(offset, offset + STM32.BUF_SIZE), 1);
                buf[0] = 0xff; // STM32.BUF_SIZE -1
            } else {
                // We are reaching the end of the binary (less than 256 bytes left)
                // resize the buffer and fill it with the remaining data
                buf = new Uint8Array(firmware_binary.byteLength - offset + 2);
                buf.set(firmware_binary.subarray(offset, firmware_binary.byteLength - 1), 1);
                buf[0] = firmware_binary.byteLength - offset - 1;
                last_write = true;
            }

            // Add the checksum
            var ck = buf[0];
            for (var i = 1; i < buf.byteLength; i++) {
                ck ^= buf[i];
            }
            buf[buf.byteLength - 1] = ck;

            // 2. Start a 'write memory' operation
            write(makeCommand(STM32.WRITE_MEMORY), States.WAIT_ACK, 500, function (res) {
                if (res.status != 'ok') {
                    // We are in deep trouble here, flashing is not going well
                    self.trigger('data', {
                        status: 'error',
                        msg: 'flashing error: write memory command NACK at  address ' + (STM32.FLASH_START + offset)
                    });
                    return; // Abort
                }

                // 3. Send address to write
                var flash_addr = makeAddress(STM32.FLASH_START + offset);
                //console.log('Address', flash_addr);
                write(flash_addr, States.WAIT_ACK, 500, function (res) {
                    if (res.status != 'ok') {
                        // We are in deep trouble here, flashing is not going well
                        self.trigger('data', {
                            status: 'error',
                            msg: 'flashing error: memory address NACK at address ' + (STM32.FLASH_START + offset)
                        });
                        return; // Abort
                    }

                    // Now send the data packet
                    write(buf, States.WAIT_ACK, 500, function (res) {
                        if (res.status != 'ok') {
                            // We are in deep trouble here, flashing is not going well
                            self.trigger('data', {
                                status: 'error',
                                msg: 'flashing error: data packet NACK at address ' + (STM32.FLASH_START + offset)
                            });
                            return; // Abort
                        }
                        self.trigger('data', {
                            'writing': Math.ceil(offset / firmware_binary.byteLength * 100)
                        });
                        if (last_write) {
                            self.trigger('data', {
                                status: 'ok',
                                msg: 'firmware flashed'
                            });
                            goCommand();
                        } else {
                            writeFlash(offset + STM32.BUF_SIZE);
                        }
                    });
                });
            });
        }

        /**
         * Issue a "go" command to start the firmware
         */
        var goCommand = function () {
            write(makeCommand(STM32.GO), States.WAIT_ACK, 500, function (res) {
                if (res.status != 'ok') {
                    // We are in deep trouble here, flashing is not going well
                    self.trigger('data', {
                        status: 'error',
                        msg: 'go: could not issue "go" command'
                    });
                    return; // Abort
                }
                write(makeAddress(STM32.FLASH_START), States.WAIT_ACK, 500, function (res) {
                    if (res.status != 'ok') {
                        // We are in deep trouble here, flashing is not going well
                        self.trigger('data', {
                            status: 'error',
                            msg: 'go: could not issue "go" command'
                        });
                        return; // Abort
                    }
                    self.trigger('data', {
                        status: 'ok',
                        msg: 'Firmware flashed and device restarting'
                    });
                });
            });
        }


        /**
         * Flash the device. Steps are as follows:
         *    1. Init Bootloader
         *    2. Get/Check Version
         *    3. Get/Check ChipID
         *    -> Those are done right after Bootloader init.
         *    4. Write Unprotect
         *    6. Erase Flash
         *    7. Program Flash
         *    8. Issue GO command to start FW (?)
         */
        var flashBoard = function () {
            console.log('***************** Start Flashing ********************');
            // Launch flashing by first unprotecting, then erasing,
            // then flashing. Sometimes Async programming is just ugly
            writeUnprotect(function () {
                eraseFlash(function () {
                    self.trigger('data', {
                        status: 'ok',
                        msg: 'Writing firmware',
                    });
                    writeFlash(0);
                });
            });
        };
    };

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});