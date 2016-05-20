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

    var Serialport = require('serialport'),
        serialConnection = require('connections_serial'),
        tcpConnection = require('connections_tcp'),
        abu = require('app/lib/abutils');


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
            
        var radio_modes = [ "LSB", "USB", "CW", "CW-R", "AM", "WFM", "FM", "DIG", "PKT" ];
            
        // We need to manage a command queue, because we
        // cannot tell what the data in means if we don't know
        // the command that was sent. The joys of async programming.
        var commandQueue = [],
            queue_busy = false;
            
        // Keep track of TX/RX state so that we can adjust the
        // status command
        var tx_status = false;

        /////////////
        // Private methods
        /////////////

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
                parser: Serialport.parsers.raw,
            }
        };

        // Format can act on incoming data from the radio, and then
        // forwards the data to the app through a 'data' event.
        //
        // data is an ArrayBuffer;
        var format = function (data) {
            if (commandQueue.length == 0) {
                console.error('Received data but we didn\'t send a command');
                return;
            }
            
            if (!queue_busy)
                return;
                
            // At this stage, we know we're expecting a value
            queue_busy = false;
            cmd = commandQueue.shift().command;
            var resp = {};
            
            switch (cmd) {
                case 'txrx_status':
                    if (data.length != 1) {
                        console.error('txrx_status was expecting 1 byte, got ', data.length);
                    }
                    if (tx_status) {
                        resp.pwr = data[0] & 0xf;
                        tx_status =   (data[0] & 0x80) != 0;
                        resp.ptt = tx_status;
                        resp.hi_swr = (data[0] & 0x40) != 0;
                        resp.split =  (data[0] & 0x20) != 0;
                    } else {
                        resp.smeter = data[0] & 0xf;
                        resp.squelch = (data[0] & 0x80) != 0;
                        resp.pl_code = (data[0] & 0x40) != 0;
                        resp.discr   = (data[0] & 0x20) != 0;
                    }
                    break;
                case 'get_frequency':
                    
                    break;
            }
            self.trigger('data', resp);
            processQueue();
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


        function queryRadio() {
            // TODO: follow radio state over here, so that we only query power
            // when the radio transmits, makes much more sense

            // This is queried every second - we stage our queries in order
            // to avoid overloading the radio, not sure that is totally necessary, but
            // it won't hurt
            
            // port.write('');
            // Go a Get_frequency and read VFO eeprom value to know if we are
            // on VFO A or VFO B.

        };
        
        // Process the latest command in the queue
        var processQueue = function() {
            if (queue_busy)
                return;
            queue_busy = true;
            var cmd = commandQueue[0]; // Get the oldest command
            
            // Note: UInt8Arrays are initialized at zero
            var bytes = new Uint8Array(5); // All FT817 commands are 5 bytes long
            switch(cmd.command) {
                case 'set_frequency':
                    console.warn('set_frequency, not implemented');
                    break;
                case 'get_frequency':
                    bytes[4] = 0x03;
                    commandQueue.shift(); // No response from the radio
                    queue_busy = false;
                    break;
                case 'lock':
                    bytes[4] = (cmd.arg) ? 0x00 : 0x80;
                    commandQueue.shift();
                    queue_busy = false;
                    break;
                case 'ptt':
                    bytes[4] = (cmd.arg) ? 0x08 : 0x88;
                    tx_status = cmd.arg;
                    commandQueue.shift();
                    queue_busy = false;
                    break;
                case 'clar':
                    bytes[4] = (cmd.arg) ? 0x05 : 0x85;
                    commandQueue.shift();
                    queue_busy = false;
                    break;
                case 'toggle_vfo':
                    bytes[4] = 0x81;
                    commandQueue.shift();
                    queue_busy = false;
                    break;
                case 'split':
                    bytes[4] = (cmd.arg) ? 0x02 : 0x82;
                    commandQueue.shift();
                    queue_busy = false;
                    break;
                case 'power':
                    bytes[4] = (cmd.arg) ? 0x0f : 0x8f;
                    commandQueue.shift();
                    queue_busy = false;
                    break;
                case 'txrx_status':
                    // tx_status = true if we are transmitting
                    bytes[4] = (tx_status) ? 0xf7 : 0xe7;
                    break;
            }
            port.write(bytes);
        }

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            // We now support serial over TCP/IP sockets: if we detect
            // that the port is "TCP/IP", then create the right type of
            // tcp port:
            var p = ins.get('port');
            if (p == 'TCP/IP') {
                // Note: we just use the parser info from portSettings()
                port = new tcpConnection(ins.get('tcpip'), portSettings().parser);
            } else {
                port = new serialConnection(ins.get('port'), portSettings());
            }
            port.open();
            port.on('data', format);
            port.on('status', status);

        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            port.off('data', format);
            
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
                port.write('');
            } catch (err) {
                console.log("Error on serial port while requesting  UID : " + err);
            }
        };

        // period in seconds
        this.startLiveStream = function (period) {
            var self = this;
            if (!streaming) {
                console.log("[FT817-ND] Starting live data stream");
                livePoller = setInterval(queryRadio.bind(this), (period) ? period * 1000 : 1000);
                streaming = true;
            }
        };

        this.stopLiveStream = function (args) {
            if (streaming) {
                console.log("[FT817-ND] Stopping live data stream");
                // Stop live streaming from the radio:
                port.write('');
                clearInterval(livePoller);
                streaming = false;
            }
        };

        // Outputs receives the commands from the upper level driver
        // Data should be a JSON object:
        // { command: String, args: any};
        // Command can be:
        //  get_frequency   : 
        //  set_frequency   : number
        //  lock            : boolean (on/off)
        //  ptt             : boolean (on/off)
        //  set_opmode      : String (set operating mode)
        //  clar            : boolean (on/off)
        //  set_clar_freq   : number
        //  toggle_vfo
        //  split           : boolean (on/off)
        //  rpt_offset_dir  : Number ( 1, -1 or zero)
        //  rpt_offset_freq : Number
        //  pl_mode         : String  (DCS/CTCSS mode)
        //  pl_tone         : Number
        //  dcs_code        : NUmber
        //  txrx_status
        //  power           : boolean (on/off)
        this.output = function (data) {
            commandQueue.push(data);
            processQueue();
        };

    }

    // Add event management to our parser, from the Backbone.Events class:
    _.extend(parser.prototype, Backbone.Events);

    return parser;
});