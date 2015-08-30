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
 * Browser-side Parser for Elecraft radios.
 *
 * This parser implements elecraft serial commands for:
 *    - KXPA100
 *    - KX3
 *
 * The Browser-side parser is used when running as a Chrome or Cordova app.
 *
 * Differences with server-side parser:
 *
 *   - 'socket' uses "trigger" to emit events, not "emit"
 *
 *  @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var webrtcConnection = require('connections_webrtc'),
        Bitmap = require('app/lib/bitmap');


    var parser = function (socket) {

        var socket = socket,
            self = this;
        var serialport = null;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = false,
            port = null,
            port_close_requested = false,
            port_open_requested = true,
            isopen = false;

        /////////////
        // Private methods
        /////////////

        // Send the bitmap back to the front-end
        function sendBitmap() {
            var bm = new Bitmap(bitmap);
            bm.init();
            var data = bm.getData();
            socket.trigger('serialEvent', {
                screenshot: data,
                width: bm.getWidth(),
                height: bm.getHeight()
            });
        };


        /**
         * We have an easy life here: we are getting pre-parsed data
         * from the remote driver through the WebRTC channel, so we can simply
         * forward it to the front-end
         * @param {[[Type]]} data [[Description]]
         */
        var format = function (data) {
            if (self.uidrequested && data.substr(0, 5) == "DS@@@") {
                // We have a Unique ID
                console.log("Sending uniqueID message");
                self.trigger('data', {
                    uniqueID: '' + data.substr(5, 5)
                });
                self.uidrequested = false;
                return;
            }
            self.trigger('data', data);
        };

        var status = function (stat) {
            port_open_requested = false;
            console.log('Port status change', stat);
            if (stat.openerror) {
                // We could not open the port: warn through
                // a 'data' messages
                var resp = {
                    openerror: true
                };
                if (stat.reason != undefined)
                    resp.reason = stat.reason;
                if (stat.description != undefined)
                    resp.description = stat.description;
                self.trigger('data', resp);
                return;
            }

            isopen = stat.portopen;

            if (isopen) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    port.off('status', stat);
                    port_close_requested = false;
                }
            }
        };

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            var settings = ins.get('webrtc');
            port = new webrtcConnection('webrtc-wizkers', {
                host: settings.host,
                port: settings.port
            });
            port.on('data', format);
            port.on('status', status);
            port.open();

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

        this.isStreaming = function () {
            return true;
        }

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Radio serial number.
        this.sendUniqueID = function () {
            this.uidrequested = true;
            try {
                port.write("MN026;ds;MN255;");
            } catch (err) {
                console.log("Error on serial port while requesting Elecraft UID : " + err);
            }
        };

        // period in seconds
        this.startLiveStream = function (period) {
            // The remote driver does the streaming, not us
            streaming = true;
            return;
        };

        this.stopLiveStream = function (args) {

        };

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            port.write(data);
        };
    }

    // Add event management to our parser, from the Backbone.Events class:
    _.extend(parser.prototype, Backbone.Events);

    return parser;
});