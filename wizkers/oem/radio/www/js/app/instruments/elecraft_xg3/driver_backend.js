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

/*
 * Browser-side Parser for Elecraft XG3 signal generators.
 *
 * The Browser-side parser is used when running as a Chrome or Cordova app.
 *
 * Differences with server-side parser:
 *
 *   - 'socket' uses "trigger" to emit events, not "emit"
 *
 *  @author Edouard Lafargue, ed@lafargue.name
 */

// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    events = require('events'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var Serialport = require('serialport'),
        serialConnection = require('connections/serial'),
        btConnection = require('connections/btspp'),
        tcpConnection = require('connections/tcp');

    // Server mode does not support remote protocol (not really needed)
    if (vizapp.type != 'server')
        var Protocol = require('app/lib/jsonbin');

    var parser = function (socket) {

        var socket = socket,
        self = this;
        var serialport = null;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = false,
        port = null,
        proto = 0,
        port_close_requested = false,
        port_open_requested = true,
        isopen = false;

        /////////////
        // Private methods
        /////////////

        var portSettings = function () {
            return {
                baudRate: 9600,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: false,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: Serialport.parsers.readline(';', 'binary')
            }
        };

        // Format can act on incoming data from the XG3, and then
        // forwards the data to the app through a 'data' event.
        //
        // data is an ArrayBuffer;
        var format = function (data) {
            if (proto) {
                // We are using the Wizkers Netlink protocol, so incoming data has to be forwarded
                // to our protocol handler and we stop processing there, the actual data will come in
                // throuth the onProtoData callback (see below)
                proto.read(data);
                return;
            }

            self.trigger('data', data);
        };

        /**
         * When the protocol parser gets data, this callback gets called
         */
        var onProtoData = function(data) {
            self.trigger('data', data);
        }

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
                    if (port.off)
                        port.off('status', status);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                }
            }
        };

        function queryRadio() {
            // This is queried every second
            port.write('I;'); // Ask for frequency

        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                port = new serialConnection(item.port, portSettings());
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };

        var openPort_app = function(insid) {
            var ins = instrumentManager.getInstrument();
            // We now support serial over TCP/IP sockets: if we detect
            // that the port is "TCP/IP", then create the right type of
            // tcp port:
            var p = ins.get('port');
            if (p == 'TCP/IP') {
                // Note: we just use the parser info from portSettings()
                port = new tcpConnection(ins.get('tcpip'), portSettings().parser);
            } else if (p == 'Wizkers Netlink') {
                port = new tcpConnection(ins.get('netlink'), portSettings().parser);
                proto = new Protocol();
                proto.on('data', onProtoData);
            } else if (p == 'Bluetooth') {
                port = new btConnection(ins.get('btspp'), portSettings().parser);
            } else {
                port = new serialConnection(ins.get('port'), portSettings());
            }
            port.on('data', format);
            port.on('status', status);
            port.open();
        }

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid);
            }
        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            if (port.off)
                port.off('data', format);
            else
                port.removeListener('data', format);

            if (proto)
                proto.off('data', onProtoData);

            // If we are streaming, stop it!
            // The Home view does this explicitely, but if we switch
            // instrument while it is open, then it's up to the driver to do it.
            if (streaming)
                this.stopLiveStream();

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
            return streaming;
        }

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Radio serial number.
        this.sendUniqueID = function () {
            self.trigger('data', {
                    uniqueID: 'n.a.'
                });
        };

        // period in seconds
        this.startLiveStream = function (period) {
            var self = this;
            if (!streaming) {
                console.log("[XG3] Starting live data stream");

            if (proto) {
                // We are connected to a remote Wizkers instance using Netlink,
                // and that remote instance is in charge of doing the Live Streaming
                streaming = true;
                // We push this as a data message so that our output plugins (Netlink in particular)
                // can forward this message to the remote side. In the case of Netlink (remote control),
                // this enables the remote end to start streaming since it's their job, not ours.
                port.write("@N3TL1NK,start_stream;");
                return;
            }

                // Ask for all memories
                port.write('WM;WP;');
                port.write('Q,1;');
                // The XG3 needs time to recover every once in a while, especially after sending
                // a beacon - unless we implement a full-blown flow control using ";" as our
                // echo characted, we just have to add a couple of timeouts:
                setTimeout( function() {
                    port.write('M,00;M,01;M,02;M,03;M,04;M,05;M,06;M,07;M,08;M,09;M,10;M,11;');
                    livePoller = setInterval(queryRadio.bind(this), (period) ? period * 1000 : 1000);
                    streaming = true;
                }, 300);
            }
        };

        this.stopLiveStream = function (args) {
            if (proto) {
                streaming = false;
                port.write("@N3TL1NK,stop_stream;");
                return;
            }
            if (streaming) {
                console.log("[XG3] Stopping live data stream");
                // Stop live streaming from the radio:
                clearInterval(livePoller);
                streaming = false;
            }
        };

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            // Netlink protocol commands come in through
            // this method:
            if (data.indexOf("@N3TL1NK,start_stream;") > -1) {
                this.startLiveStream();
                return;
            } else if (data.indexOf("@N3TL1NK,stop_stream;") > -1) {
                this.stopLiveStream();
                return;
            }
            port.write(data);
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