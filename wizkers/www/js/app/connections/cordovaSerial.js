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
 *  Serial port connection
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

    var cordovaSerial = function (path, settings) {

        /////////
        // Initialization
        /////////

        var portOpen = false,
            mySettings = settings,
            self = this;

        var parser = mySettings.parser;

        ///////////
        // Public methods
        ///////////

        /**
         * Send data to the serial port.
         * cmd has to be either a String or a UInt8Array
         *
         */
        this.write = function (cmd) {
            if (!portOpen ||  cmd == '')
                return;

            // We try to be a bit accomodating: detect strings, and
            // ArrayBuffer-assimilated objects
            switch (typeof cmd) {
                case 'object': // Probably UInt8Array or similar
                    cmd_queue.push({ command: abu.ui8tohex(cmd), hex: true});
                    break;
                case 'string':
                    cmd_queue.push({ command: cmd, hex: false });
                    break;
            }
            processCmdQueue();
        };


        this.close = function (port) {
            console.log("[cordovaSerial] closeInstrument");
            if (!portOpen)
                return;

            serial.close(function (success) {
                portOpen = false;
                self.trigger('status', {
                    portopen: false
                });
                console.log("cordovaSerialLib: closePort success");
            }, function (error) {
                console.log("cordovaSerialLib: closePort error - " + error);
            });
        };

        // We support only one default port, the serial adapter
        // connected to the OTG cable.
        this.getPorts = function () {
            self.trigger('ports', ["OTG Serial"]);
        }

        this.open = function () {
            console.log("cordovaSerial: openPort");
            serial.requestPermission(
                function (success) {
                    serial.open({
                            "sleepOnPause": false,
                            "baudRate": "" + mySettings.baudRate,
                            "dataBits": "" + mySettings.dataBits,
                            "dtr": mySettings.dtr
                        }, // pay attention to capital R and lowercase b ...
                        onOpen,
                        function (error) {
                            // Tell our front-end the port does not exist
                            self.trigger('status', {
                                openerror: true,
                                reason: 'Port not found',
                                description: 'Not able to find an OTG port on this phone/tablet.'
                            });
                            portOpen = false;
                            self.trigger('status', {
                                portopen: false
                            });
                        }
                    );
                },
                function (error) {
                    self.trigger('status', {
                        openerror: true,
                        reason: 'Port not found or permission error',
                        description: 'Not able to find an OTG port on this device - or you didn\'t accept to connect.'
                    });
                    portOpen = false;
                    self.trigger('status', {
                        portopen: false
                    });
                }
            );
        }


        ///////////
        // Private methods and variables
        ///////////

        // We are implementing the same sort of command queue as on the
        // Chrome implementation, just in case:
        var cmd_queue = [],
            queue_busy = false;

        this.connectionId = -1;

        var writeSuccessCallback = function () {
            // Success callback
            cmd_queue.shift(); // remove oldest command
            queue_busy = false;
            if (cmd_queue.length)
                processCmdQueue();
        };

        var writeErrorCallback = function () {
            console.log("cordovaSerial - error, retrying command");
            queue_busy = false;
            if (!portOpen) {
                // If the port got closed, just flush the command queue and
                // abort.
                cmd_queue = [];
                return;
            }
            processCmdQueue();
        };

        function processCmdQueue() {
            if (queue_busy)
                return;
            queue_busy = true;
            var cmd = cmd_queue[0].command; // Get the oldest command
            if (cmd_queue[0].hex) {
                serial.writeHex(cmd, writeSuccessCallback, writeErrorCallback);
            } else {
                serial.write(cmd, writeSuccessCallback, writeErrorCallback);
            }
        };


        /////////////
        //   Callbacks (private)
        /////////////

        /**
         * Callback whenever something is ready on the serial port. It is
         * received by the instrument driver's 'format' method.
         *
         * @param {Object} readInfo The data that was just received on the serial port
         */
        function onRead(data) {
            // data is an ArrayBuffer
            if (data.byteLength == 0)
                return;

            // Pass this over to the parser.
            // the parser will trigger a "data" even when it is ready
            parser(self, data);

        };

        function onError() {
            console.log('[cordovaSerial] Error registering serial read callback');
        };

        // Called by the parser whenever data is ready to be formatted
        // by our instrument driver (see parser call just above)
        this.onDataReady = function (data) {
            // 'format' triggers a serialEvent when ready
            self.trigger('data', data);
        }

        function onOpen(openInfo) {
            // Flush our command queue and busy status:
            cmd_queue = [];
            queue_busy = false;
            portOpen = true;
            self.trigger('status', {
                portopen: portOpen
            });
            serial.registerReadCallback(onRead, onError);
        };

        // Now hook up our own event listeners:
        // this.on('data', onDataReady);

        console.log("[chromeSerialLib] ***********************  Chrome Serial Library loaded **********************");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(cordovaSerial.prototype, Backbone.Events);
    return cordovaSerial;
});