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
 * Back-end driver for the LP100A.
 *
 * This back-end driver is used when running as a Chrome or Cordova app,
 * as well as in server mode (NodeJS)
 *
 *  @author Edouard Lafargue, ed@lafargue.name
 */

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
        tcpConnection = require('connections/tcp'),
        abu = require('app/lib/abutils');

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

        var inputBuffer = new Uint8Array(256);
        var ibIdx = 0;
        // Various protocol states:
        // IDLE = 0
        // SYNC = 1
        // POLL_STRING = 2
        var P_IDLE = 0,
            P_SYNC = 1,
            P_PARSE = 2;
        var protoState = P_SYNC;

        // Those values don't update every time, cache them
        // and only output them even 10 seconds or so, so that we can
        // save as much power/bandwidth as possible
        var callsign = '';
        var swr_alrm = 0;
        var pwr_range = 0;
        var pk_hold_mode = 0;
        var ro = 0;

        var portSettings = function () {
            return {
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: false,
                // parser: Serialport.parsers.raw
            }
        };

        // Format can act on incoming data from the radio, and then
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

            // The LP100A does not have line terminations, but the poll line
            // starts with a ";" and continues with 42 characters (?)
            if (data) {
                // Safeguard - required on Android in particular
                if (isNaN(ibIdx))
                    ibIdx = 0;
                // we sometimes get called without data, to further process the
                // existing buffer
                // First of all, append the incoming data to our input buffer:
                // console.log("Received new serial data, appended at index ", ibIdx);
                if (ibIdx+data.byteLength > 0xff || ibIdx < 0)
                    ibIdx = 0;
                inputBuffer.set(new Uint8Array(data), ibIdx);
                ibIdx += data.byteLength;
            }

            if (protoState == P_SYNC) {
                // Look for the starting ";" and reset the buffer to that index
                var i = inputBuffer.indexOf(0x3b);
                if (i>-1) {
                    // Realign the buffer now that we're sync'ed
                    inputBuffer.set(inputBuffer.subarray(i));
                    ibIdx -= i;
                    protoState = P_PARSE;
                } else {
                    return;
                }
            }

            if (protoState == P_PARSE) {
                // In order to save on processing time, we won't attempt to
                // decode before we reach 40 characters
                if (ibIdx < 40)
                    return;
                let st = abu.ab2str(inputBuffer.subarray(1,ibIdx));
                let fields = st.split(',');
                if (fields.length < 9) {
                    console.info('Not enough fields yet', fields.length);
                    return;
                }
                if (fields.length > 9) {
                    console.warn('Too many data fields! Slow machine?', fields.length);
                    protoState = P_SYNC;
                    return; // We missed it. Machine too slow?
                }
                // Realign the buffer
                inputBuffer.set(inputBuffer.subarray(ibIdx));
                ibIdx = 0;
                protoState = P_SYNC;
                // We have enough fields, now decode them:
                let r = {
                    pwr: parseFloat(fields[0]),
                    z: parseFloat(fields[1]),
                    ph: parseFloat(fields[2]),
                    dbm: parseFloat(fields[7]),
                    swr: parseFloat(fields[8])
                }
                // Caching:
                if (fields[3] != swr_alrm) {
                    r.swr_alrm = fields[3];
                    swr_alrm = fields[3];
                }
                if (fields[4] != callsign) {
                    r.callsign = fields[4];
                    callsign = fields[4];
                }
                if (fields[5] != pwr_range) {
                    r.pwr_range = fields[5];
                    pwr_range = fields[5];
                }
                if (fields[6] != pk_hold_mode) {
                    r.pk_hold_mode = fields[6];
                    pk_hold_mode = fields[6];
                }
                if (! (ro++ % 50) ) {
                    r.swr_alrm = parseInt(fields[3]);
                    r.callsign = fields[4];
                    r.pwr_range = parseInt(fields[5]);
                    r.pk_hold_mode = parseInt(fields[6]);
                }

                self.trigger('data', r);
                return;
            }
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
                    if (port.off)
                        port.off('status', status);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                }
            }
        };

        /**
         * When the protocol parser gets data, this callback gets called
         */
        var onProtoData = function(data) {
            self.trigger('data', data);
        }

        function queryRadio() {

            // This is queried every second

            port.write('P'); // Ask for frequency

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

        // period in seconds (not used)
        this.startLiveStream = function (period) {
            var self = this;
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
            if (!streaming) {
                console.log("[LP100A] Starting live data stream");
                // Fast polling (every 100 ms)
                livePoller = setInterval(queryRadio.bind(this), 100);
                streaming = true;
            }
        };

        this.stopLiveStream = function (args) {
            if (proto) {
                streaming = false;
                port.write("@N3TL1NK,stop_stream;");
                return;
            }
            if (streaming) {
                console.log("[LP100A] Stopping live data stream");
                // Stop live streaming from the radio:
                clearInterval(livePoller);
                streaming = false;
            }
        };

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            if (data.indexOf("@N3TL1NK,start_stream;") > -1) {
                this.startLiveStream(500);
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