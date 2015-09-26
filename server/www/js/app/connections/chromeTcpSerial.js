/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 *  Simple TCP socket connection using the Chrome socket API
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

    var chromeTcpSerial = function (hostSettings, parser) {

        /////////
        // Initialization
        /////////

        var portOpen = false,
            tcp_host = hostSettings.host,
            tcp_port = hostSettings.port,
            mySettings = settings,
            socketId = null,
            self = this;

        ///////////
        // Public methods
        ///////////

        /**
         * Send data to the socket.
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
            if (!portOpen ||  cmd == '')
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
            console.log('[tcpSerial] closeInstrument');
            if (!portOpen)
                return;

            // Important: remove the listener that gets incoming data, otherwise
            // at the next open we'll add a new listener and it will mess everything
            // up.
            //
            chrome.sockets.tcp.onReceive.removeListener(onRead);
            chrome.sockets.tcp.onReceiveError.removeListener(onError);
            chrome.sockets.tcp.disconnect(socketId);
            chrome.sockets.tcp.close(socketId);
            socketId = null;
            portOpen = false;

            self.trigger('status', {
                portopen: portOpen
            });
            console.log('[tcpSerial] closePort success ');
        };

        this.getPorts = function () {}

        // Has to be called by the backend_driver to actually open the port.
        this.open = function () {
            // The real action happens once the socket is created
            chrome.sockets.tcp.create({}, onSocketCreated);
        }

        // Flushes the connection
        this.flush = function (cb) {
            if (!self.portOpen)
                return;
            chrome.serial.flush(self.connectionId, cb);
        }

        ///////////
        // Private methods and variables
        ///////////


        // Because Windows is fucked up, we need to keep
        // a command queue
        var cmd_queue = [],
            queue_busy = false;

        var socketId = -1;

        function processCmdQueue() {
            if (queue_busy)
                return;
            queue_busy = true;
            var cmd = cmd_queue[0].command; // Get the oldest command

            // Some drivers format their data as Uint8Arrays because they are binary.
            // others format the data as strings: str2ab makes sure this is turned into
            // an arraybuffer in each case.
            chrome.sockets.tcp.send(socketId, cmd,
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

        function onSocketCreated(createInfo) {
            if (chrome.runtime.lastError) {
                self.trigger('status', {
                    openerror: true,
                    reason: 'Socket error',
                    description: 'Could not open connection to remote device (could not create socket).'
                });
            }

            socketId = createInfo.socketId;
            portOpen = true;
            chrome.sockets.tcp.connect(socketId, tcp_host, tcp_port, onConnectComplete);
        };

        function onConnectComplete(resultCode) {
            if (resultCode < 0) {
                // Unable to connect
                self.trigger('status', {
                    openerror: true,
                    reason: 'Connection error',
                    description: 'Could not open connection to remote device.'
                });
                portOpen = false;
                return;
            }

            // Now start listening:
            chrome.sockets.tcp.onReceive.addListener(onRead);
            chrome.sockets.tcp.onReceiveError.addListener(onError);

            self.trigger('status', {
                portopen: portOpen
            });
        }


        /**
         * Callback whenever something arrives on the socket port. It is
         * received by the instrument driver's parser.
         * @param {Object} readInfo The data that was just received on the serial port
         */
        function onRead(readInfo) {
            if (readInfo.socketId == socketId && readInfo.data) {
                // Pass this over to the parser.
                // the parser will trigger a "data" even when it is ready
                //console.log("R: " + ab2str(readInfo.data));
                parser(self, readInfo.data);
            }
        };

        // Called by the parser whenever data is ready to be formatted
        // by our instrument driver
        this.onDataReady = function (data) {
            // 'format' triggers a serialEvent when ready
            self.trigger('data', data);
        }

        function onError(info) {
            if (info.socketId != socketId)
                return;
            console.log("[chromeTcpSerial] We got an error from the driver: " + info.resultCode);
            // Create meaningful error codes.
            // The result codes are hardcoded in
            // https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h&sq=package:chromium&l=111
            var friendlyCode = info.resultCode;
            switch (info.resultCode) {
            case -7: // timeout
                friendlyCode = '-7: Socket timeout - lost connection';
                break;
            case -102: // Connectionion refused
                friendlyCode = '-102: connection refused';
                break;
            case -101: // Connection reset
                friendlyCode = '-101: connection reset';
                break;
            case -109: // Address unreachable
                friendlyCode = '-109: address unreachable';
                break;
            }
            self.trigger('status', {
                openerror: true,
                reason: 'Port error - driver triggered an error.',
                description: 'Result code: ' + friendlyCode
            });
        };

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(chromeTcpSerial.prototype, Backbone.Events);
    return chromeTcpSerial;
});