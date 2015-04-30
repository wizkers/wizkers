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

    var chromeSerial = function (path, settings) {

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
            case 'string':
                cmd = abu.str2ab(cmd);
                break;
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
            console.log("[chromeSerial] chromeSerialLib: closeInstrument");
            if (!self.portOpen)
                return;

            // Important: remove the listener that gets incoming data, otherwise
            // at the next open we'll add a new listener and it will mess everything
            // up.
            //
            // Moreover: we have to remove the listener before closing the device, because
            // on the Mac (2014.06) this causes a hard reboot about 50% of the time, whenever
            // serial data arrives after disconnect - not 100% clean on origin.
            chrome.serial.onReceive.removeListener(onRead);
            chrome.serial.onReceiveError.removeListener(onError);
            chrome.serial.disconnect(self.connectionId, function (success) {
                self.portOpen = false;
                self.trigger('status', {
                    portopen: self.portOpen
                });
                console.log("[chromeSerialLib] chromeSerialLib: closePort success");
            });
        };

        // We support only one default port, the serial adapter
        // connected to the OTG cable.
        this.getPorts = function () {
            chrome.serial.getDevices(onGetDevices);
        }

        ///////////
        // Private methods and variables
        ///////////


        // Because Windows is fucked up, we need to keep
        // a command queue
        var cmd_queue = [],
            queue_busy = false;

        this.connectionId = -1;


        function openPort() {
            // We try to use the same API as the Node serialport API, so we need to
            // translate some of the arguments:
            var chromeSerialSettings = {
                bitrate: mySettings.baudRate,
                dataBits: 'eight'
            };

            if (mySettings.parity) {
                if (mySettings.parity == 'none')
                    mySettings.parity = 'no';
                chromeSerialSettings.parityBit = mySettings.parity;
            }

            // I have not found a way to catch open port errors
            // when ports don't exist, so we first need to ask for
            // the list of ports and check we are trying open something
            // that does not exist.
            chrome.serial.getDevices(function (ports) {
                var found = false;
                for (var i = 0; i < ports.length; i++) {
                    if (ports[i].path == path) {
                        found = true;
                    }
                }

                if (found) {
                    chrome.serial.connect(path, chromeSerialSettings,
                        onOpen
                    );
                } else {
                    // Tell our front-end the port does not exist
                    self.trigger('status', {
                        openerror: true
                    });
                }
            });
        }

        function processCmdQueue() {
            if (queue_busy)
                return;
            queue_busy = true;
            var cmd = cmd_queue[0].command; // Get the oldest command
            // Some drivers format their data as Uint8Arrays because they are binary.
            // others format the data as strings: str2ab makes sure this is turned into
            // an arraybuffer in each case.
            chrome.serial.send(self.connectionId, cmd,
                function (sendInfo) {
                    if (sendInfo.error && sendInfo.error == "pending") {
                        console.log("Retrying command");
                        queue_busy = false;
                        processCmdQueue();
                    } else {
                        cmd_queue.shift(); // remove oldest command
                        queue_busy = false;
                        if (cmd_queue.length)
                            processCmdQueue();
                    }
                });
        };


        /////////////
        //   Callbacks
        /////////////

        function onGetDevices(ports) {
            var portlist = [];
            for (var i = 0; i < ports.length; i++) {
                portlist.push(ports[i].path);
            }
            self.trigger('ports', portlist);
        }

        /**
         * Callback whenever something is ready on the serial port. It is
         * received by the instrument driver's 'format' method.
         * @param {Object} readInfo The data that was just received on the serial port
         */
        function onRead(readInfo) {
            if (readInfo.connectionId == self.connectionId && readInfo.data) {
                // Pass this over to the parser.
                // the parser will trigger a "data" even when it is ready
                //console.log("R: " + ab2str(readInfo.data));
                //self.trigger('data', readInfo.data);
                parser(self, readInfo.data);
            }
        };

        // Called by the parser whenever data is ready to be formatted
        // by our instrument driver
        this.onDataReady = function (data) {
            // 'format' triggers a serialEvent when ready
            self.trigger('data', data);
        }

        // onError is called on Windows in some situations, when the serial device
        // generates a "Break" signal. In that case, we wait for 200ms and we try
        // to reconnect.
        // Note: we do a clean close/open, so the close/open propagates all the
        // way to the front-end.
        function onError(info) {
            console.log("[chromeSerial] We got an error from the driver: " + info.error);
            switch (info.error) {
            case "system_error":
                if (!self.portOpen)
                    break;
                self.close();
                setTimeout(openPort, 500);
                break;
            case "device_lost":
                self.close();
                break;
            }
        };

        function onOpen(openInfo) {
            if (!openInfo) {
                console.log("[chromeSerialLib] Open Failed");
                console.log(openInfo);
                return;
            }
            self.portOpen = true;
            self.connectionId = openInfo.connectionId;
            // Flush our command queue and busy status:
            cmd_queue = [];
            queue_busy = false;
            self.trigger('status', {
                portopen: self.portOpen
            });

            chrome.serial.onReceive.addListener(onRead);
            chrome.serial.onReceiveError.addListener(onError);

        };

        // Now hook up our own event listeners:
        // this.on('data', onDataReady);

        console.log("[chromeSerialLib] ***********************  Chrome Serial Library loaded **********************");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(chromeSerial.prototype, Backbone.Events);
    return chromeSerial;
});