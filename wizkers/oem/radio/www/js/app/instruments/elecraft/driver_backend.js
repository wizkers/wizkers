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
 * Browser-side Parser for Elecraft radios.
 *
 * This parser implements elecraft serial commands for:
 *    - KXPA100
 *    - KX3
 *    - KX2
 *    - K3 / K3S
 *
 * New (Nov 2016): the same file now work in both server and app mode, and
 * is called by the nodeJS server when necesasary. For this reason, there are
 * a couple of tricks there to make the same file work in both environments:
 *  - No jQuery dependency is allowed
 *  - Detection code for NodeJS mode at very beginning
 *  - The Open method is different on app and node modes
 *  - Even hookup is different
 *  - the serial port API on node does not support an 'off' method
 *  - rename the Node 'emit' method to 'trigger' when initializing events so
 *    that we use the Backbone convention everywhere
 *
 *    ... but this is not even a dozen lines, and all the rest of the
 *  code is identical!
 * *
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
        abutils = require('app/lib/abutils'),
        serialConnection = require('connections/serial'),
        tcpConnection = require('connections/tcp'),
        btConnection = require('connections/btspp'),
        Bitmap = require('app/lib/bitmap');

        // Server mode does not support remote protocol (not really needed)
        if (vizapp.type != 'server')
           var Protocol = require('app/lib/jsonbin');


    var parser = function (socket) {

        var socket = socket,
            self = this;
        var serialport = null;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = false,
            pollCounter = 0,
            port = null,
            proto = 0,
            port_close_requested = false,
            port_open_requested = true,
            isopen = false;

        /**
         *   We are redefining the parser here because we need it to work
         * in both client mode and server mode (browser + cordova + node)
         * @param {*} delimiter
         * @param {*} encoding
         */
        var readline = function (delimiter, encoding) {
            if (typeof delimiter === "undefined" || delimiter === null) { delimiter = "\r"; }
            if (typeof encoding  === "undefined" || encoding  === null) { encoding  = "utf8"; }
            // Delimiter buffer saved in closure
            var data = "";
            return function (emitter, buffer) {
              // Collect data
              data += abutils.ab2str(buffer);
              // Split collected data by delimiter
              var parts = data.split(delimiter);
              data = parts.pop();
              parts.forEach(function (part, i, array) {
                emitter.onDataReady(part);
              });
            };
        }

        // Because Elecraft radios are not 100% consistent with their protocols,
        // we need to use a pure raw parser for data input, and most of the time,
        // forward that data to a readline parser. But sometimes, we will need the
        // raw input, for instance for Bitmap requests
        var second_parser = readline(';');

        // Flag to indicate we are receiving a bitmap
        var waiting_for_bmp = false;
        var bitmap;
        var bitmap_index = 0;
        var oldpercent = 0;

        // Various radio-related variables
        var radio_modes = ["LSB", "USB", "CW", "FM", "AM", "DATA", "CW-REV", 0, "DATA-REV"];


        /////////////
        // Private methods
        /////////////

        // Send the bitmap back to the front-end
        function sendBitmap() {
            var bm = new Bitmap(bitmap);
            bm.init();
            var data = bm.getData();
            self.trigger('data', {
                screenshot: data,
                width: bm.getWidth(),
                height: bm.getHeight()
            });
        };

        var portSettings = function () {
            return {
                baudRate: 38400,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: false,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                // parser: Serialport.parsers.raw,
            }
        };


        // Format can act on incoming data from the radio, and then
        // forwards the data to the app through a 'data' event.
        //
        // data is an ArrayBuffer
        // We are trying to pre-format as much data as we can here into
        // json objects, so that we don't do parsing everywhere later on.
        var format = function (data) {

            if (proto) {
                // We are using the Wizkers Netlink protocol, so incoming data has to be forwarded
                // to our protocol handler and we stop processing there, the actual data will come in
                // throuth the onProtoData callback (see below)
                proto.read(data);
                return;
            }

            if (!waiting_for_bmp) {
                second_parser(self, data); // Careful not to use 'this' since 'this' in this context
                // is chromeSerial !!
                return;
            }

            // We are receiving a Bitmap: we know it is 131638 bytes plus a checksum
            // Copy the data we received into our bitmap array buffer:
            var tmpArray = new Uint8Array(data);
            bitmap.set(tmpArray, bitmap_index);
            bitmap_index += data.byteLength;
            var percent = Math.floor(bitmap_index / 1000 / 132 * 100);
            if (percent != oldpercent) {
                self.trigger('data', {
                    downloading: percent
                });
                oldpercent = percent;
            }
            if (bitmap_index > 131638) {
                waiting_for_bmp = false;
                console.log('[elecraft driver] Got the bitmap!');
                sendBitmap();
            }
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
            // TODO: follow radio state over here, so that we only query power
            // when the radio transmits, makes much more sense

            if (pollCounter++ % 2 == 0) {
            // Query displays and band (does not update by itself)
            port.write('DB;DS;BN;'); // Query VFO B and VFOA Display

            // Then ask the radio for current figures:
            port.write('PO;TQ;'); // Query actual power output

            // And if we have an amp, then we can get a lot more data:
            port.write('^PI;^PF;^PV;^TM;');
            port.write('^PC;^SV;'); // Query voltage & current

            }

            port.write('BG;'); // Bargraph display

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
            // The Node version of serialport does not have 'off' events
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
            this.uidrequested = true;
            try {
                port.write("MN026;ds;MN255;");
            } catch (err) {
                console.log("Error on serial port while requesting Elecraft UID : " + err);
            }
        };

        // period in seconds
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
                console.log("[Elecraft] Starting live data stream");
                // The radio can do live streaming to an extent, so we definitely will
                // take advantage:
                // K31 enables extended values such as proper BPF reporting
                // AI2 does not send an initial report, so we ask for the initial data
                // before...
                port.write('K31;IF;FA;FB;RG;FW;MG;IS;BN;MD;AI2;');
                livePoller = setInterval(queryRadio.bind(this), 500);
                streaming = true;
            } else {
                // We are already streaming, but it looks like someone wants a refresh,
                // just send the initial queries again:
                console.info("Refreshing live stream (already polling)");
                port.write('IF;FA;FB;RG;FW;MG;IS;BN;MD;');
            }
        };

        this.stopLiveStream = function (args) {
            if (proto) {
                streaming = false;
                port.write("@N3TL1NK,stop_stream;");
                return;
            }
            if (streaming) {
                console.log("[Elecraft] Stopping live data stream");
                // Stop live streaming from the radio:
                port.write('AI0;');
                clearInterval(livePoller);
                streaming = false;
            }
        };

        // This is the callback from the parser when in server mode. Not used
        // when in app mode.
        this.emit = function (t, data) {
            self.onDataReady(data);
        }

        // Called by the serial parser, cannot be private
        this.onDataReady = function (data) {

            if (this.uidrequested && data.substr(0, 5) == "DS@@@") {
                // We have a Unique ID
                console.log("Sending uniqueID message");
                self.trigger('data', {
                    uniqueID: '' + data.substr(5, 5)
                });
                this.uidrequested = false;
                return;
            }

            var cmd2 = data.substr(0,2);
            // We reply with an object containing at least the raw data response,
            // as well as pre-parsed data to avoid multiple parsing later on.
            var resp = { raw: data};
            switch (cmd2) {
                case 'FA':
                    var f = parseInt(data.substr(2));
                    resp.vfoa = f;
                    break;
                case 'FB':
                    var f = parseInt(data.substr(2));
                    resp.vfob = f;
                    break;
                case 'IF':
                    var f = parseInt(data.substr(2,11));
                    resp.vfoa = f;
                    var md = radio_modes[parseInt(data.substr(29,1))-1];
                    resp.mode = md;
                    break;
                case 'MD':
                    resp.mode = radio_modes[parseInt(data.substr(2)) -1];
                    break;
                case 'SM':
                    resp.smeter = parseInt(data.substr(2));
                    break;
                case 'TQ':
                    resp.ptt = data.substr(2) == '1';
            }

            self.trigger('data', resp);
        }

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

            // We want to catch the '#BMP' command to the P3/PX3, because
            // the data returned if not semicolon-terminated at all..
            if (data.indexOf('#BMP') != -1) {
                waiting_for_bmp = true;
                bitmap = new Uint8Array(131768); // No need to use 131k before we need it.
                bitmap_index = 0;
                console.log('Got a bitmap request, need to switch parsers for a while!');
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