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
 * Browser-side Parser for FDM-DUO radios
 *
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
        tcpConnection = require('connections/tcp'),
        btConnection = require('connections/btspp'),
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
            isopen = false,
            queue_process_scheduled = false;

        var bytes_expected = 0;
        var watchDog = null;
        var radio_on = true;
        var radio_mode = '';

        var temp_mem = '';

        // We want to keep track of radio operating values and only send them to the
        // front-end if they change
        var vfoa_sql = -1;
        var vfob_sql = -1;
        var vfoa_freq = '';
        var vfob_freq = '';

        // We need the model ID to accomodate for the various radio model
        /// variants. The ID is requested upon driver open.
        var model_id = 'Unknown';

        // We need to manage a command queue, because we
        // cannot tell what the data in means if we don't know
        // the command that was sent. The joys of async programming.
        var commandQueue = [],
            queue_busy = false;

        // Keep track of TX/RX state so that we can adjust the
        // status command
        var tx_status = false;
        var qc = 0; // Query counter

        /////////////
        // Private methods
        /////////////

        // TODO: Implement autodetect
        var portSettings = function () {
            return {
                baudRate: 38400,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: true,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: Serialport.parsers.readline(';', 'binary')
            }
        };

        // Format can act on incoming data from the radio, and then
        // forwards the data to the app through a 'data' event.
        //
        // data is a string
        var format = function (data) {

            if (proto) {
                // We are using the Wizkers Netlink protocol, so incoming data has to be forwarded
                // to our protocol handler and we stop processing there, the actual data will come in
                // throuth the onProtoData callback (see below)
                proto.read(data);
                return;
            }

            // if (commandQueue.length == 0) {
            //     console.warn('Received data but we didn\'t expect anything', data);
            // }

            clearTimeout(watchDog);

            // if (!queue_busy) {
            //     console.info('We received a complete data packet but we don\'t have the queue_busy flag set');
            // }

            // At this stage, we know we're expecting a value
            var cmd = '';
            //if (commandQueue.length)
            //    cmd = commandQueue.shift();
            queue_busy = false;

            //console.log(data);
            var resp = {};
            var cmd = data.substr(0,2);

            switch (cmd) {
                case 'FA':
                case 'FB':
                    resp = parseFreq(data);
                    break;
                case 'RI': // RSSI
                    resp.rssi = parseInt(data.substr(3)); // Note: we remove the negative sign
                    break;
                case 'get_menu':

                    break;
                case 'get_power':

                    break;
                case 'get_uid':
                    resp = { uid: ibstr };
                    break;
                case 'get_control':

                    break;
                case 'get_memory':

                    break;
                case 'get_memory_name':

                    break;
                case 'set_memory':

                    break;
                case 'set_memory_name':

                    break;
                case 'get_mem_channel':

                    break;
                case 'id':

                    break;
                case 'raw':
                    break;
            }
            resp.raw = data;
            if (Object.keys(resp) && (Object.keys(resp).length > 0)) {
                self.trigger('data', resp);
            }

            scheduleProcessQueue();


        };

        var parseFreq = function(str) {
            var vfo = str[1].toLowerCase();
            if ((vfo == 'a' && str == vfoa_freq) || (vfo == 'b' && str == vfob_freq))
                return {};
            var f = parseInt(str.substr(2));
            if (vfo =='a') {
                vfoa_freq = str;
                return { vfoa: f};
            } else {
                vfob_freq = str;
                return { vfob: f};
            }
        }


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
                // This driver auto-detects the radio model to adapt to the small
                // differences from one model to the next, so we need to send the "ID"
                // command after open.
                vfoa_freq = '';
                vfob_freq = '';
                self.output({command: 'id'});
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

            // In my experience the FDM-DUO cannot get CAT commands very fast, which is
            // weird... but we can ask for many commands on one line`
            this.output({command: 'raw', arg: 'FA;FB;FR;FT;MA;MB;MD;SM0;RI;RP;'});

        };

        // We need to call processQueue indirectly, because the ELAD does not
        // accept fast poll rates
        var scheduleProcessQueue = function() {
            if (queue_process_scheduled)
                return;
            queue_process_scheduled = true;
            setTimeout(processQueue,350);
        }

        // Process the latest command in the queue
        var processQueue = function() {

            queue_process_scheduled = false;
            if (queue_busy || (commandQueue.length == 0))
                return;
            queue_busy = true;
            var cmd = commandQueue.shift(); // Get the oldest command

            var cmd_string = "";
            switch(cmd.command) {
                case 'set_frequency':
                    var freq = 0;
                    if (typeof cmd.arg.freq == 'string') {
                        freq = f;
                    } else {
                        freq = ("00000000000" + (parseInt(cmd.arg.freq*1e6 ).toString())).slice(-11); // Nifty, eh ?
                    }
                    if (freq.indexOf("N") > -1) { // detect "NaN" in the string
                        console.warn("Invalid VFO spec");
                        commandQueue.shift();
                        queue_busy = false;
                        this.output({command: 'get_frequency', arg: cmd.arg.vfo});
                        return;
                    } else {
                        var prefix = (cmd.arg.vfo == 'a') ? 'FA' : 'FB';
                        cmd_string = prefix + freq + ';' + prefix;
                    }
                    break;
                case 'set_vfo_mode':
                    break;
                case 'get_frequency':
                    if (cmd.arg == 'a')
                        vfoa_freq = '';
                    else
                        vfob_freq = '';
                case 'poll_frequency':
                    cmd_string = 'F' + ((cmd.arg == 'a') ? 'A' : 'B');
                    break;
                case 'get_sql':
                    break;
                case 'get_uid':
                    break;
                case 'get_menu':
                    break;
                case 'get_power':
                    break;
                case 'get_control':
                    break;
                case 'get_memory':
                    break;
                case 'get_memory_name':
                    break;
                case 'set_memory':
                    break;
                case 'set_memory_name':
                    break;
                case 'set_mem_channel':
                    break;
                case 'get_mem_channel':
                    break;
                case 'id':
                    break;
                case 'raw':
                    cmd_string = cmd.arg;
                    break;
            }

            if (!cmd_string.length) {
                commandQueue.shift();
                queue_busy = false;
                return;
            }

            watchDog = setTimeout( function() {
                console.log("Command Timeout");
                commandQueue.shift();
                queue_busy = false;
            }, 500);
            console.log('Writing:',cmd_string);
            port.write(cmd_string + ';\r');

        }

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
            this.uidrequested = true;
            this.output({command:'get_uid'});
        };

        // period in seconds
        this.startLiveStream = function (period) {
            var self = this;
            vfoa_sql = -1;
            vfob_sql = -1;
            vfoa_freq = '';
            vfob_freq = '';

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
                console.log("[FDM-DUO] Starting live data stream");
                livePoller = setInterval(queryRadio.bind(this), 1000);
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
                console.log("[FDM-DUO] Stopping live data stream");
                // Stop live streaming from the radio:
                port.write('');
                clearInterval(livePoller);
                streaming = false;
            }
        };

        // Outputs receives the commands from the upper level driver
        // Data should be a JSON object:
        // { command: String, args: any};
        //
        // The FDM Duo does not accept commands faster than every 300ms
        // so we have to manage the queue in a special way, with a timer
        this.output = function (data) {

            if (typeof data != 'object') {
                if (data.indexOf("@N3TL1NK,start_stream;") > -1) {
                    this.startLiveStream();
                    return;
                } else if (data.indexOf("@N3TL1NK,stop_stream;") > -1) {
                    this.stopLiveStream();
                    return;
                }
                return;
            }
            if (data.command == undefined) {
                console.error('[FDM-DUO output] Missing command key in output command');
                return;
            }

            commandQueue.push(data);

            scheduleProcessQueue();
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