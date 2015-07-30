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
        Serialport = require('serialport'),
        abu = require('app/lib/abutils');

    var cordovaSerial = function (path, settings) {

        /////////
        // Initialization
        /////////

        var portOpen = false,
            mySettings = settings,
            self = this;

        var parser = mySettings.parser;

        openPort();

        ///////////
        // Public methods
        ///////////

        /**
         * Send data to the serial port.
         * cmd has to be either a String or an ArrayBuffer
         * @param {ArrayBuffer} cmd The command, already formatted for sending.
         */
        this.write = function (cmd) {
            // On Unices (Linux, MacOS, ChromeOS etc), everything works fine,
            // but Windows is much slower and will regularly trigger "pending" errors
            // if we send too many commands one after another.
            //
            // This forces us to keep a stack of pending commands and retry them if
            // we get a "pending" error. cmd_queue is a FIFO (we send the oldest command
            // and push new ones to the top. We have a "busy" flag that prevents us from sending
            // a command while we are waiting for another.
            if (!self.portOpen ||  cmd == '')
                return;

            // We try to be a bit accomodating: detect strings, and
            // ArrayBuffer-assimilated objects
            switch (typeof cmd) {
            case 'object': // Probably UInt8Array or similar
                if (cmd.buffer)
                    cmd = cmd.buffer;
                break;
            }

            cmd_queue.push({
                'command': cmd,
                'raw': true
            }); // Add cmd at the end of the queue
            processCmdQueue();
        };


        this.close = function (port) {
            console.log("[cordovaSerial] closeInstrument");
            if (!self.portOpen)
                return;

            serial.close(function (success) {
                self.portOpen = false;
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

        ///////////
        // Private methods and variables
        ///////////

        // We are implementing the same sort of command queue as on the
        // Chrome implementation, just in case:
        var cmd_queue = [],
            queue_busy = false;

        this.connectionId = -1;


        function openPort() {
            console.log("cordovaSerial: openPort");
            serial.requestPermission(
                function (success) {
                    serial.open({
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
                                description: 'Please check your instrument settings, we were not able to find the serial port you specified there.'
                            });
                        }
                    );
                },
                function (error) {
                    alert("cordovaSerialLib: requestPermission error: " + error);
                }
            );
        }

        function processCmdQueue() {
            if (queue_busy)
                return;
            queue_busy = true;
            var cmd = cmd_queue[0].command; // Get the oldest command

            serial.write(cmd, function () {
                // Success callback
                cmd_queue.shift(); // remove oldest command
                queue_busy = false;
                if (cmd_queue.length)
                    processCmdQueue();
            }, function () {
                console.log("cordovaSerial - error, retrying command");
                queue_busy = false;
                processCmdQueue();
            });
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
            self.portOpen = true;
            self.trigger('status', {
                portopen: true
            });
            serial.registerReadCallback( onRead, onError);
        };

        // Now hook up our own event listeners:
        // this.on('data', onDataReady);

        console.log("[chromeSerialLib] ***********************  Chrome Serial Library loaded **********************");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(cordovaSerial.prototype, Backbone.Events);
    return cordovaSerial;
});