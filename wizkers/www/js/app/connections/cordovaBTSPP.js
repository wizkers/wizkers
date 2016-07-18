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
 *  Serial port connection over a Bluetooth SPP profile, on Android/iOS
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
     * path is { address: 'mac address' }
     */
    var cordovaBTSPP = function (path, settings) {

        /////////
        // Initialization
        /////////

        var portOpen = false,
            parser = settings,
            self = this;

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

            // The Cordova Bluetooth SPP lib is open when it comes
            // to data format: string, ArrayBuffer or Uint8Array
            cmd_queue.push({ command: cmd, hex: false });
            processCmdQueue();
        };


        this.close = function (port) {
            console.log("[cordovaBTSPP] closeInstrument");
            if (!portOpen)
                return;

            bluetoothSerial.unsubscribeRawData( function() {
                bluetoothSerial.disconnect(function (success) {
                    portOpen = false;
                    self.trigger('status', {
                        portopen: false
                    });
                    console.log("cordovaBTSPP: closePort success");
                }, function (error) {
                    console.log("cordovaBTSPP: closePort error - " + error);
                });
            });
        };

        this.open = function () {
            console.log("cordovaBTSPP: openPort");
            bluetoothSerial.connect(
                path.address,
                onOpen,
                function (error) {
                    // TODO: this will be called when/if the connection
                    // is broken at a later stage too
                    self.trigger('status', {
                        openerror: true,
                        reason: 'Device not found or other error',
                        description: 'Not able to connect to this Bluetooth peripheral.'
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
            console.log("cordovaBTSPP - error, retrying command");
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
            bluetoothSerial.write(cmd, writeSuccessCallback, writeErrorCallback);

        };


        /////////////
        //   Callbacks (private)
        /////////////

        /**
         * Callback whenever something is ready on the serial port. It is
         * received by the instrument driver's 'format' method.
         *
         * @param data is an ArrayBuffer
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
            console.log('[cordovaBTSPP] Error registering serial read callback');
        };

        // Called by the parser whenever data is ready to be formatted
        // by our instrument driver (see parser call just above)
        this.onDataReady = function (data) {
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

            bluetoothSerial.subscribeRawData(onRead, onError);
        };

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(cordovaBTSPP.prototype, Backbone.Events);
    return cordovaBTSPP;
});