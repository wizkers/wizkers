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
 *  WebRTC port connection
 *
 * Opens at create, sends 'data' events,
 * and 'status' events.
 *
 * Supports a "write" method.
 *
 * This transfers data with a remote host through a WebRTC data channel
 */

define(function (require) {

    "use strict";

    var Backbone = require('backbone'),
        Serialport = require('serialport'),
        abu = require('app/lib/abutils');

    require('peerjs'); // PeerJS does not play nice with RequireJS and defines window.Peer
    // instead of returning a constructor.

    /**
     * Opens a WebRTC connection to a remote peer
     * @param {String} path     The remote peer ID
     * @param {Object} settings contains the connection server
     *                          info (host and port)
     */
    var webRTCChannel = function (path, settings) {

        /////////
        // Initialization
        /////////

        var portOpen = false,
            mySettings = settings,
            self = this;

        var peer = null,
            connection = null;

        ///////////
        // Public methods
        ///////////

        /**
         * Send data over the data channel
         * cmd has to be either a String or an ArrayBuffer
         * @param {ArrayBuffer} cmd The command, already formatted for sending.
         */
        this.write = function (cmd) {

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

            // TODO: do the write

        };

        this.close = function (port) {
            console.log("[WebRTC Connection] close channel");
            if (!self.portOpen)
                return;

            if (peer) {
                peer.destroy();
                self.portOpen = false;
                self.trigger('status', {
                    portopen: self.portOpen
                });
            }
        };

        // Has to be called by the backend_driver to actually open the port.
        this.open = function () {
            peer = new Peer({
                host: mySettings.host,
                port: mySettings.port,
                debug: 3
            });

            var connection = peer.connect('webrtc-wizkers');
            connection.on('data', onRead);
            self.portOpen = true;
            self.trigger('status', {
                portopen: self.portOpen
            });

        }

        this.flush = function (cb) {
            if (!self.portOpen)
                return;
        }

        ///////////
        // Private methods and variables
        ///////////

        /////////////
        //   Callbacks
        /////////////

        /**
         * Callback whenever something arrives on the WebRTC connection. It is
         * received by the instrument driver's 'format' method, but as opposed to
         * a local connection, the data that comes in was already formatted by the
         * remote end: for this reason, we encapsulate it into an object with a
         * 'webrtc' key, to indicate to the driver that it should just forward it
         * with no further parsing.
         *
         * @param {Object} data The data that was just received over the channel
         */
        function onRead(data) {
            self.trigger('data', data);
        }

        // onError is called on Windows in some situations, when the serial device
        // generates a "Break" signal. In that case, we wait for 1 second and we try
        // to reconnect.
        // Note: we do a clean close/open, so the close/open propagates all the
        // way to the front-end.
        function onError(info) {};

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(webRTCChannel.prototype, Backbone.Events);
    return webRTCChannel;
});