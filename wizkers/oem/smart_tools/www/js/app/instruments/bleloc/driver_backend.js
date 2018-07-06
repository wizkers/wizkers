/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT) with extension
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * 1. The above copyright notice and this permission notice shall be included in
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
 *  Gather data from Bluetooth probes and display what probe sees what signal best
 *
 */

// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    DataView = require('buffer-dataview'), // Important for compatibility
    events = require('events'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var abutils = require('app/lib/abutils'),
        utils = require('app/utils'),
        tcpServerConnection = require('connections/tcp-server');

    var parser = function (socket) {

        var self = this,
            socket = socket,
            instrumentid = null,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            live_poller = null,
            isopen = false;

        // Command processing
        var commandQueue = [],
            queue_busy = false;

        // Known beacons
        var beacons = [];

        /////////////
        // Private methods
        /////////////

        // Info required at port creation.
        var portSettings = function () {
            return {
            }
        };

        // Format acts on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            console.log(data);
            // ToDO:
            // 1. Keep list of known devices
            // 2. Reformat RSSI per station
            // 3. Output to front-end
            var mac = data.address.replace(/:/g,'')
            if (!beacons[mac]) {
                // First we hear about this new beacon:
                beacons[mac] = {address: data.address};
                beacons[mac].rssi = {};
            }
            beacons[mac].rssi[data.station] = data.rssi;
            self.trigger('data', beacons[mac]); // Forward to frontend
        };


        // Status returns an object that is concatenated with the
        // global server status
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
                // We need to unsubscribe from data/status messages now
                // since the port never opened.
                if (port.off) { // If we're running on NodeJS, then we've gotta use removeListener
                    port.off('status', status);
                    port.off('data', format);
                }  else {
                    port.removeListener('status', status);
                    port.removeListener('data', format);
                }
                return;
            }
            if (stat.reconnecting != undefined) {
                // Forward the message to front-end
                self.trigger('data', {reconnecting:stat.reconnecting});
                return;
            }
            isopen = stat.portopen;
            if (isopen ) {
                // TODO: do something here if necessary
            }

            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                if (port.off)
                    port.off('status', status);
                else
                    port.removeListener('status', status);
                port_close_requested = false;
            }
        };

        var openPort_app = function (insid, insport) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            if (port == null)
                port = new tcpServerConnection(insport ? insport : ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);
        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                if (port == null) {
                    port = new tcpServerConnection(item.port, portSettings());
                } else {
                    console.log("Already have a driver, reusing it.");
                }
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid, insport) {
            instrumentid = insid;
            port_open_requested = true;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid, insport);
            }
        };

        this.closePort = function (data) {
            if (port == null) {
                return;
            }
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            if (port && port.off)
                port.off('data', format);
            else
                port.removeListener('data', format);
            port_close_requested = true;
            port.close();
        }

        this.isOpen = function () {
            return isopen;
        }

        this.isOpenPending = function () {
            return port_open_requested;
        }

        this.getInstrumentId = function (arg) {
            return instrumentid;
        };

        this.isStreaming = function () {
            return streaming;
        };

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // TODO: Returns the instrument GUID.
        this.sendUniqueID = function () {};

        // period in seconds
        this.startLiveStream = function (period) {
            if (port) {
            }
        };


        this.stopLiveStream = function (args) {
            if (live_poller)
                clearInterval(live_poller);
        };

        // This is where we receive commands from the front-end
        // So far we are not sending anything, since we are subscribing
        // to the Kestrel readings upon link establishment.
        //
        // We are getting simple commands here, not raw packets
        this.output = function (data) {
            // Nothing so far
        };

    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    if (vizapp.type != 'server') {
        // Add event management to our parser, from the Backbone.Events class:
        _.extend(parser.prototype, Backbone.Events);
    } else {
        parser.prototype.__proto__ = events.EventEmitter.prototype;
        parser.prototype.trigger = parser.prototype.emit;
    }
    return parser;
});
