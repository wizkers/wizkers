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

    var Backbone = require('backbone');
    var Serialport = require('serialport');

    var chromeSerial = function (path, settings) {

        /////////
        // Initialization
        /////////

        var portOpen = false,
            self = this;

        chrome.serial.connect(path, {
                bitrate: settings.baudRate,
            },
            onOpen
        );

        ///////////
        // Public methods
        ///////////

        // cmd is the data to send. 'raw' indicates the return value should be
        // an ArrayBuffer, not a String. TODO To be changed, we need to use
        // ArrayBuffers everytime.
        this.write = function (cmd, raw) {
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

            cmd_queue.push({
                'command': cmd,
                'raw': raw
            }); // Add cmd at the end of the queue
            processCmdQueue();
        };


        this.close = function closeInstrument(port) {
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

        // Utility function (chrome serial wants array buffers for sending)
        // Convert string to ArrayBuffer.
        function str2ab(str) {
            //  some drivers already give us an Uint8Buffer, because they
            // handle binary data. in that case
            // this makes our job easier:
            if (str.buffer)
                return str.buffer;
            var buf = new ArrayBuffer(str.length);
            var bufView = new Uint8Array(buf);
            for (var i = 0, j = str.length; i < j; i++) {
                bufView[i] = str.charCodeAt(i);
            }
            return buf;
        };

        function ab2str(buf) {
            return String.fromCharCode.apply(null, new Uint8Array(buf));
        };

        function processCmdQueue() {
            if (queue_busy)
                return;
            queue_busy = true;
            var cmd = cmd_queue[0].command; // Get the oldest command
            var send_raw = cmd_queue[0].raw;
            // Some drivers format their data as Uint8Arrays because they are binary.
            // others format the data as strings: str2ab makes sure this is turned into
            // an arraybuffer in each case.
            chrome.serial.send(self.connectionId, (send_raw) ? str2ab(cmd) : str2ab(self.driver.output(cmd)),
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

        // This gets called whenever something is ready on the serial port
        function onRead(readInfo) {
            if (readInfo.connectionId == self.connectionId && readInfo.data) {
                // Pass this over to the parser.
                // the parser will trigger a "data" even when it is ready
                //console.log("R: " + ab2str(readInfo.data));
                self.trigger('data', ab2str(readInfo.data));
            }
        };

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
                closeInstrument();
                setTimeout(openInstrument, 500);
                break;
            case "device_lost":
                closeInstrument();
                break;
            }
        };

        // Called by the parser whenever data is ready to be formatted
        // by our instrument driver
        /**
function onDataReady(data) {
            // 'format' triggers a serialEvent when ready
            self.trigger('data', data);
        }
        */

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