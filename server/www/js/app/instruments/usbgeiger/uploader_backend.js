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
 *  An firmware upgrader interface for the Geiger Link.
 *
 * This is actually a generic Arduino Leo-compatible AVR109-like
 * protocol implementation, and can be used with other devices too.
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
        abu = require('app/lib/abutils'),
        intelhex = require('app/lib/intelhex');

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

        var AVR109 = {
            SET_ADDRESS: "A",
            WRITE_PAGE: "B",
            EXIT_BOOTLOADER: "E",
            LEAVE_PROGRAMMING_MODE: "L",
            ENTER_PROGRAMMING_MODE: "P",
            SOFTWARE_ID: "S",
            SOFTWARE_VERSION: "V",
            READ_PAGE: "g",
        };

        var inputBuffer = new Uint8Array(1024); // Receive buffer
        var ibIdx = 0;
        var watchdog = null;

        var retries = 0;
        var readCb = null; // the function that expects data from the last write
        var bytesExpected = 0; // The AVR109 protocol tells us how many bytes we can expect each time we write

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            var ins = instrumentManager.getInstrument();
            // portOpenCallback = callback;
            portPath = ins.get('port');
            chrome.serial.connect(portPath, {
                    bitrate: 1200,
                },
                onOpenPort
            );
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
            if (data.upload_hex) {
                // We got an IntelHex file to upload to the board
                var bindata = intelhex.parse(data.upload_hex).data;
                flashBoard(0, abu.pad(bindata, 128));
            }
            return '';
        };

        /////////
        // Callbacks
        /////////

        /**
         * Gets called once we open the port at 1200 Baud
         */
        var onOpenPort = function (openInfo) {
            if (!openInfo) {
                console.log("[AVR109 uploader] Open Failed");
                return;
            }
            var cid = openInfo.connectionId;
            // Wait 500ms and close the port
            console.log("[avr109] Opened port at 1200");
            setTimeout(function () {
                chrome.serial.disconnect(cid, function (success) {
                    // And reopen right away, at 115200 baud:
                    console.log("[avr109] Closed port at 1200, reopening " + portPath + " at 57600");
                    // 800ms is an empirical delay that gives the Arduino time to start the bootloader
                    // The right way would be to detect the port properly
                    setTimeout(function () {
                        port = new serialConnection(portPath, portSettings());
                        port.on('data', format);
                        port.on('status', status);
                    }, 800);
                });
            }, 500);
        };

        ///////////////////////////////////
        //  Private methods
        ///////////////////////////////////

        var portSettings = function () {
            return {
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
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

        // Format acts on incoming data from the device
        var format = function (data) {
            var d = new Uint8Array(data);
            //console.log(d);
            inputBuffer.set(new Uint8Array(data), ibIdx);
            ibIdx += data.byteLength;

            if (ibIdx == bytesExpected) {
                clearTimeout(watchdog);
                if (readCb) {
                    retries = 0;
                    readCb({
                        status: 'OK',
                        data: inputBuffer.subarray(0, ibIdx)
                    });
                } else {
                    console.log("[Warning] No callback was set for the data that just arrived");
                }
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
         * Start the protocol
         */
        var onOpen = function (success) {
            console.log("We have the board in uploader mode now");
            write(AVR109.SOFTWARE_ID, 7, 300, getSWVersion);
        };

        // Not used
        var onClose = function (success) {
            console.log("ARV109 upgrader: got a port close signal");
        };

        /**
         * Write data, with the number of bytes expected in return,
         * a timeout and a callback
         * data : the data to write (string)
         * btr: bytes to read, the number of bytes we expect in response
         * delay: a timeout before calling the callback with an error message
         * callback: function that expects the response
         */
        var write = function (data, btr, delay, callback) {
            readCb = callback;
            bytesExpected = btr;
            ibIdx = 0;
            retries = 0;

            function to() {
                if (retries < 2) {
                    retries++;
                    watchdog = setTimeout(to, delay);
                    console.log("Timeout, trying again");
                    port.write(data);
                } else {
                    readCb({
                        status: 'timeout',
                        data: ''
                    });
                }
            }
            // console.log("Writing data");
            // console.log(data);
            watchdog = setTimeout(to, delay);
            port.write(data);
        }


        var getSWVersion = function (data) {
            if (data.status == 'OK') {
                console.log("We got our software version: ");
                self.trigger('data', {
                    'sw_version': abu.ab2str(data.data)
                });
            } else {
                console.log("Timeout!");
            }
        };

        var flashBoard = function (address, data) {
            var pageSize = 128;
            if (data.byteLength % pageSize != 0) {
                self.trigger('data', {
                    'status': 'Error: firmware length not aligned to page size'
                });
                return;
            }

            // Now enter program mode on the board:
            write(AVR109.ENTER_PROGRAMMING_MODE, 1, 100, function (resp) {
                if (resp.status != 'OK' || resp.data[0] != 0x0d) {
                    self.trigger('data', {
                        'status': 'Error: board did not enter programming mode'
                    });
                    return;
                }
                // We are good now, start programming:
                setAddress(address, data);
            });
        };

        /**
         * The Catarina bootloader auto increments the current address after
         * writing a page, so we don't need to call setAddress after each page
         * write
         **/
        var setAddress = function (address, data) {
            // Build a "Set address" command ("A" + address)
            var cmd = new Uint8Array([65, 0, 0]);
            // Check the leonardo catarina bootloader source for explanation
            // of the shifts:
            cmd[1] = (address >> 9) & 0xff;
            cmd[2] = (address >> 1) & 0xff;
            write(cmd.buffer, 1, 100, function (resp) {
                if (resp.status != 'OK' || resp.data[0] != 0x0d) {
                    self.trigger('data', {
                        'status': 'Error: unable to set address to ' + address
                    });
                    return;
                }
                // We are good now, write our pages:
                self.trigger('data', {
                    'status': 'Flashing firmware.'
                });
                writePage(0, data, address);
            });
        };

        /**
         * writePage is a recursive function that writes all the data, page by page.
         * Again, the Leonardo bootloader auto increments the current page
         */
        var writePage = function (pageNumber, data, startAddress) {
            var pages = data.byteLength / 128;
            if (Math.ceil(pageNumber / pages * 100) % 5 == 0) {
                self.trigger('data', {
                    'writing': Math.ceil(pageNumber / pages * 100)
                });
            }

            var packet = new Uint8Array(132);
            packet[0] = 66; // 0x41, 'B'
            packet[1] = 0;
            packet[2] = 128; // We are writing with a 128 byte page size
            packet[3] = 70; // 'F' (flash memory)
            // Copy the page to write into the buffer:
            packet.set(data.subarray(pageNumber * 128, (pageNumber + 1) * 128), 4);
            //console.log(abu.hexdump(packet));
            write(packet.buffer, 1, 200, function (resp) {
                if (resp.status != 'OK' || resp.data[0] != 0x0d) {
                    self.trigger('data', {
                        'status': 'Error: error while writing flash at page ' + pageNumber
                    });
                    return;
                }
                if (pageNumber < pages - 1) {
                    writePage(pageNumber + 1, data, startAddress);
                } else {
                    verifyProgramming(startAddress, data);
                }
            });
        }

        var verifyProgramming = function (address, data) {
            // Build a "Set address" command ("A" + address)
            var cmd = new Uint8Array([65, 0, 0]);
            // Check the leonardo catarina bootloader source for explanation
            // of the shifts:
            cmd[1] = (address >> 9) & 0xff;
            cmd[2] = (address >> 1) & 0xff;
            write(cmd.buffer, 1, 200, function (resp) {
                if (resp.status != 'OK' || resp.data[0] != 0x0d) {
                    self.trigger('data', {
                        'status': 'Error: unable to set address to ' + address
                    });
                    return;
                }
                // We are good now, write our pages:
                self.trigger('data', {
                    'status': 'Verifying firmware.'
                });
                verifyPage(0, data);
            });

        }

        // Very similar to writePage, except that we read instead of writing
        var verifyPage = function (pageNumber, data) {
            var pages = data.byteLength / 128;
            if (Math.ceil(pageNumber / pages * 100) % 5 == 0) {
                self.trigger('data', {
                    'verifying': Math.ceil(pageNumber / pages * 100)
                });
            }
            var packet = new Uint8Array(4);
            packet[0] = 103; // 0x67, 'g'
            packet[1] = 0;
            packet[2] = 128; // We are writing with a 128 byte page size
            packet[3] = 70; // 'F' (flash memory)
            write(packet.buffer, 128, 500, function (resp) {
                if (resp.status != 'OK') {
                    self.trigger('data', {
                        'status': 'Error: error while reading flash at page ' + pageNumber
                    });
                    return;
                }
                // Now check the contents:
                for (var i = 0; i < 128; i++) {
                    if (resp.data[i] != data[pageNumber * 128 + i]) {
                        self.trigger('data', {
                            'status': 'Error: data verification error at page ' + pageNumber
                        });
                        return;
                    }
                }
                //console.log("Page " + pageNumber + " verified OK");
                if (pageNumber < pages - 1) {
                    verifyPage(pageNumber + 1, data);
                } else {
                    self.trigger('data', {
                        'status': 'Success: flash verified successfully.'
                    });
                    exitProgramming();;
                }
            });


        }

        var exitProgramming = function () {
            // Leave programming mode
            write(AVR109.LEAVE_PROGRAMMING_MODE, 1, 100, function (resp) {
                if (resp.status != 'OK' || resp.data[0] != 0x0d) {
                    self.trigger('data', {
                        'status': 'Error: board did not leave programming mode'
                    });
                    return;
                }
                self.trigger('data', {
                    'status': 'Success: board left programming mode'
                });
                // Exit Bootloader
                write(AVR109.EXIT_BOOTLOADER, 1, 100, function (resp) {
                    if (resp.status != 'OK' || resp.data[0] != 0x0d) {
                        self.trigger('data', {
                            'status': 'Error: board did not exit bootloader'
                        });
                        return;
                    }
                    self.trigger('data', {
                        status: 'Success: Firmware upgrade successful',
                        run_mode: 'firmware'
                    });
                });
            });
        };
    }

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});