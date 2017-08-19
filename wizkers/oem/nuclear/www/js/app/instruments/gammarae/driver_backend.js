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
 * Device driver for the RAE Systems GammaRAE personal monitor
 *
 * This is a dual browser/server driver, working in both modes.
 *
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
            isopen = false;

        var inputBuffer = new Uint8Array(0xff);
        var ibIdx = 0;
        var bytes_expected = 0;
        var watchDog = null;

        var P_IDLE = 0,
            P_SYNC = 1,
            P_LEN = 2,
            P_RECV = 3;

        var protoState = P_SYNC;


        // We need to manage a command queue, because we
        // cannot tell what the data in means if we don't know
        // the command that was sent. The joys of async programming.
        var commandQueue = [],
            queue_busy = false;


        /////////////
        // Private methods
        /////////////

        // TODO: Implement autodetect
        var portSettings = function () {
            return {
                baudRate: 19600,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: false,
                parser: Serialport.parsers.raw
            }
        };

        // Format can act on incoming data from the radio, and then
        // forwards the data to the app through a 'data' event.
        //
        // data is an ArrayBuffer
        var format = function (data) {

            if (proto) {
                // We are using the Wizkers Netlink protocol, so incoming data has to be forwarded
                // to our protocol handler and we stop processing there, the actual data will come in
                // throuth the onProtoData callback (see below)
                proto.read(data);
                return;
            }

            if (commandQueue.length == 0) {
                console.warn('Received data but we didn\'t expect anything', new Uint8Array(data));
                queue_busy = false;
                return;
            }

            inputBuffer.set(new Uint8Array(data), ibIdx);
            ibIdx += data.byteLength;

            // Unescape 0x7d character: if we have two 0x7d in a row,
            // remove the second one.
            var i = inputBuffer.indexOf(0x7d);
            if (i >0 && i < inputBuffer.length-1 && i < bytes_expected-2 && inputBuffer[i+1] == 0x7d) {
                console.info("Uh oh, excaped 0x7d, unescaping");
                inputBuffer.copyWithin(i+1, i+2);
            }

            if (protoState == P_SYNC) {
                // Look for the starting "{" and reset the buffer to that index
                var i = inputBuffer.indexOf(0x7b);
                if (i>-1) {
                    // Realign the buffer now that we're sync'ed
                    inputBuffer.set(inputBuffer.subarray(i));
                    ibIdx -= i;
                    protoState = P_LEN; // Now looking for the length byte
                } else {
                    return;
                }
            }

            if (protoState == P_LEN) {
                if (ibIdx < 2)
                    return; // Not enough bytes yet

                bytes_expected = inputBuffer[2] + 3; // We already received 2 bytes + length
                protoState = P_RECV; // Move to receive rest of packet
            }

            if (protoState == P_RECV && ibIdx < bytes_expected )
                return; // Not enough bytes yet

            protoState = P_SYNC; // We now have a complete packet
            console.info(abu.hexdump(inputBuffer.subarray(0,bytes_expected)));

            // Check that the last byte in the packet is a '}'
            if (inputBuffer[bytes_expected-1] != 0x7d) {
                console.error('Packet not consistent, last byte is not }');
                ibIdx = 0;
                commandQueue.shift();
                queue_busy = false;
                return;
            }

            // Verify the checksum
            if (verifyChecksum(bytes_expected) == false) {
                console.error('Packet checksum is wrong! Discarding');
                ibIdx = 0;
                commandQueue.shift();
                queue_busy = false;
                return;
            }

            // We're all happy now, we have a proper, complete data packet
            clearTimeout(watchDog);

            if (!queue_busy) {
                console.info('We received a complete data packet but we don\'t have the queue_busy flag set');
                self.trigger('data', { raw:data });
                return;
            }

            // At this stage, we know we're expecting a value
            var cmd = commandQueue.shift();
            queue_busy = false;
            ibIdx = 0;
            var resp = {};
            // Reformat input buffer as a string

            switch (cmd.command) {
                case 'init':
                    // For an init command, we expect an empty data packet
                    if (bytes_expected == 7) {
                        resp.init = 'OK';
                    } else
                        resp.init = 'FAIL';
                    break;
                case 'get_uid':
                    resp.uid = parseUid(bytes_expected);
                    break;
                case 'get_model_name':
                    resp.model_name = parseString(bytes_expected);
                    break;
                case 'get_model_number':
                    resp.model_number = parseString(bytes_expected);
                    break;
                case 'get_fw_rev':
                    resp.fw_rev = parseString(bytes_expected);
                    break;
                case 'get_battery':
                    resp.battery = inputBuffer[7] / 10;
                    break;
                case 'get_temperature':
                    resp.temp = inputBuffer[7] - 100;
                    break;
                case 'get_clock':
                    resp.clock = parseDate(bytes_expected);
                    break;
                case 'get_sens_calib':
                    resp.sens_calib_date = parseDate(bytes_expected);
                    break;
                case 'get_dose':
                    resp.dose = parseDose(bytes_expected);
                    break;
                case 'raw':
                    resp = {raw: abu.hexdump(data)};
                    break;
            }
            if (Object.keys(resp) && (Object.keys(resp).length > 0)) {
                console.info(resp);
                self.trigger('data', resp);
            }
            processQueue();
        };

        /**
         * Parse the serial number response from the device
         */
        var parseUid = function(len) {
            if (len != 14) {
                console.error('Wrong packet length');
                return 'error';
            }
            var sn = bcdByte(inputBuffer[7]) + bcdByte(inputBuffer[8]);
            sn += '-' + bcdByte(inputBuffer[9]) + bcdByte(inputBuffer[10]) + bcdByte(inputBuffer[11]);
            return sn;
        }

        /**
         * Parse the model name response from the device
         */
        var parseString = function(len) {
            // Start is byte number 7, end at len - 3
            var t = inputBuffer.subarray(7, len-2);
            return abu.ab2str(t);
        }

        /**
         * Parse a date, returns a string
         */
        var parseDate = function(len) {
            var r = '20' + inputBuffer[7] + '.' + inputBuffer[8] + '.' + inputBuffer[9] + ' ';
            r += inputBuffer[10] + ':' + inputBuffer[11];
            if (len == 14)
                return r;
            r += ':' + inputBuffer[12];
            return r;
        }

        /**
         * Pase dose, returns a float
         */
        var parseDose = function(len) {
            // We assume the data is correct since we checked
            // the checksum.
            var dose = inputBuffer[10] + (inputBuffer[9] << 8) + (inputBuffer[8] << 16) + (inputBuffer[7] << 24);
            return dose / 100;
        }

        var bcdByte = function(b) {
            return ('00' + b.toString(16)).slice(-2);
        }



        /**
         * When the protocol parser gets data, this callback gets called
         */
        var onProtoData = function(data) {
            self.trigger('data', data);
        }

        /**
         * Callback for status updates on the port state
         */
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

                // The device expects a special string to open its protocol
                self.output({command: 'init'});

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


        function queryDevice() {
        };

        // Process the latest command in the queue
        var processQueue = function() {
            if (queue_busy || (commandQueue.length == 0))
                return;
            queue_busy = true;
            var cmd = commandQueue[0]; // Get the oldest command
            var cmd_buf;
            switch(cmd.command) {
                case 'init':
                    cmd_buf = abu.str2ab('*!*@*#*!*@*#*!*@*#{' + String.fromCharCode(0x80) + '}');
                    break;
                case 'get_fw_rev':
                    cmd_buf = readRegister('2023');
                    break;
                case 'get_model_name':
                    cmd_buf = readRegister('2024');
                    break;
                case 'get_model_number':
                    cmd_buf = readRegister('2022');
                    break;
                case 'get_uid':
                    cmd_buf = readRegister('2020');
                    break;
                case 'get_battery':
                    cmd_buf = readRegister('2040');
                    break;
                case 'get_temperature':
                    cmd_buf = readRegister('2041');
                    break;
                case 'get_dose':
                    cmd_buf = readRegister('6092');
                    break;
                case 'get_clock':
                    cmd_buf = readRegister('2052');
                    break;
                case 'get_sens_calib':
                    cmd_buf = readRegister('2033');
                    break;
                case 'raw':
                    cmd_buf = readRegister(cmd.arg);
                    break;
            }

            watchDog = setTimeout( function() {
                commandQueue.shift();
                queue_busy = false;
            }, 500);
            port.write(cmd_buf);
        }


        /**
         * Make a read data packet for the GammaRAE.
         * address is a hex string ("2020" for instance)
         */
        var readRegister = function(address) {
            if (address.length != 4)
                return '';
            // A simple read command is 10 bytes long
            var packet = "7b13060501" + address; // Packet template
            packet += addChecksum(packet);
            packet += '7d';
            console.log(packet);
            return abu.hextoab(packet);
        };

        /**
         * Adds the checksum to the packet
         */
        var addChecksum = function(buf) {
            var ck = 0;
            for (var i = 0; i < buf.length; i += 2) {
                ck += parseInt(buf.substr(i,2), 16);
            }
            return ('00' + (0xff - ((ck & 0xff) -1)).toString(16)).slice(-2);

        }

        /**
         * Verify the checksum on a received packet in inputBuffer
         */
        var verifyChecksum = function(len) {
            var ck = 0;
            for (var i = 0; i < len-2; i++) {
                ck += inputBuffer[i];
            }
            var res = 0xff - ((ck & 0xff) -1);
            if (res != inputBuffer[len-2]) {
                console.error('Wrong checkump, got', inputBuffer[len-2], 'expected', res);
                return false;
            }
            return true;
        };

        var queryDeviceProps = function() {
            commandQueue.push({command: 'get_uid'});
            commandQueue.push({command: 'get_model_number'});
            commandQueue.push({command: 'get_model_name'});
            commandQueue.push({command: 'get_fw_rev'});
            commandQueue.push({command: 'get_battery'});
            commandQueue.push({command: 'get_temperature'});
            commandQueue.push({command: 'get_clock'});
            commandQueue.push({command: 'get_sens_calib'});
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
                console.log("[GammaRAE] Starting live data stream");
                // livePoller = setInterval(queryRadio.bind(this), 500);
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
                console.log("[GammaRAE] Stopping live data stream");
                // Stop live streaming from the radio:
                // port.write('');
                // clearInterval(livePoller);
                streaming = false;
            }
        };

        // Outputs receives the commands from the upper level driver
        // Data should be a JSON object:
        // { command: String, args: any};
        // Command can be:
        //  raw             : send a raw string to V71. arg is the actual string
        //  get_uid         : get the serial number
        //  get_fw_rev      : get firmware revision
        //  get_model_number: the part number for this device
        //  get_model_name  : the 'friendly name' for this device
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
                console.error('[GammnRAE output] Missing command key in output command');
                return;
            }
            if (data.command == 'main_params') {
                queryDeviceProps();
            } else {
                commandQueue.push(data);
            }
            processQueue();
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