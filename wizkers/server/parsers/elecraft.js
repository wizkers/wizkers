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
 * Parser for Elecraft radios
 *
 * This parser implements elecraft serial commands for:
 *    - KXPA100
 *    - KX3
 *
 * At this stage, I am not recording anything on those instruments, but I still
 * need to implement the API.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */
var serialport = require('serialport'),
    readline = require('readline'),
    events = require('events'),
    net = require('net'),
    dbs = require('../pouch-config'),
    debug = require('debug')('wizkers:parsers:elecraft'),
    serialconnection = require('../connections/serial');


var Elecraft = function() {

    // Init the EventEmitter
    events.EventEmitter.call(this);

    /////////
    // Public variables
    /////////

    this.name = "elecraft";

    /////////
    // Private variables
    /////////

    var uidrequested = false,
        port = null,
        isopen = false,
        instrumentid = null,
        port_close_requested = false,
        self = this,
        streaming = false,
        previouscmd = '',
        livePoller = null;

    // A few driver variables: we keep track of a few things
    // here for our bare-bones rigctld implementation.
    //
    // Note: we do not poll for those values ourselves, we
    // count on the UI to do this - to be reviewed later if
    // necessary...
    var vfoa_frequency = 0,
        vfob_frequency = 0,
        vfoa_bandwidth = 0;

    // Do we have a TCP client connected ?
    var server = null;
    var serverconnected = false;

    /////////
    // Private methods
    /////////

    var status = function(stat) {
        debug('[elecraft] Port status change', stat);
        isopen = stat.portopen;

        if (isopen) {
            // Should run any "onOpen" initialization routine here if
            // necessary.
        } else {
            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                port.removeListener('status', status);
                port_close_requested = false;
            }
        }
    };

    var queryRadio = function() {
        // TODO: follow radio state over here, so that we only query power
        // when the radio transmits, makes much more sense

        // This is queried every second - we stage our queries in order
        // to avoid overloading the radio, not sure that is totally necessary, but
        // it won't hurt

        // Query displays and band (does not update by itself)
        port.write('DB;DS;BN;'); // Query VFO B and VFOA Display

        // Then ask the radio for current figures:
        port.write('PO;'); // Query actual power output

        // And if we have an amp, then we can get a lot more data:
        port.write('^PI;^PF;^PV;^TM;');
        port.write('^PC;^SV;'); // Query voltage & current
    };

    // Format returns an ASCII string - or a buffer ? Radio replies with
    // non-ASCII values on some important commands (VFO A text, Icons, etc)
    var format = function(data, recording) {

        if (uidrequested && data.substr(0,5) == "DS@@@") {
            // We have a Unique ID
            debug("Sending uniqueID message");
            self.emit('data',{uniqueID: data.substr(5,5)});
            uidrequested = false;
            return;
        }

        var cmd = data.substr(0,2);
        switch(cmd) {
                case "FA":
                    vfoa_frequency = parseInt(data.substr(2));
                    break;
                case "BW":
                    vfoa_bandwidth = parseInt(data.substr(2));
                    break;
        }
        var lcmd = data.substr(0,3);
        if (cmd != "DB" && cmd != "DS" && cmd != "PO" && lcmd != "^PI" && lcmd != "^PF" && lcmd != "^TM" &&
            lcmd != "^PV" && lcmd != "^PC" && lcmd != "^SV"  && cmd != "BN" ) {
            // Additional output besides regular polling, print it
            debug("******  " + data);
        }

        self.emit('data',data);
    };

    // How the device is connected on the serial port.
    // This HAS to be a function that returns a new port settings objet, and not
    // a static object, otherwise multiple port open/close will fail because the portSettings
    // object is changed by SerialPort and its reference become obsolete when closing/reopening...
    var portSettings =  function() {
        return  {
            baudRate: 38400,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            // We get non-printable characters on some outputs, so
            // we have to make sure we use "binary" encoding below,
            // otherwise the parser will assume Unicode and mess up the
            // values.
            parser: serialport.parsers.readline(';','binary'),
        }
    };


    /////////
    // Public API
    // Implemented on all instrument parsers
    /////////

    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    this.openPort = function(id) {
        instrumentid = id;
        dbs.instruments.get(id, function(err,item) {
            port = new serialconnection(item.port, portSettings());
            port.on('data', format);
            port.on('status', status);
        });
    }

    this.closePort = function(data) {
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        port.removeListener('data', format);
        port_close_requested = true;
        port.close();
    }

    this.isOpen = function() {
        return isopen;
    }

    this.setInstrumentRef = function(i) {
    };

    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    //
    // Returns the Radio serial number.
    this.sendUniqueID = function() {
        uidrequested = true;
        try {
            port.write("MN026;ds;MN255;");
        } catch (err) {
            debug("Error on serial port while requesting Elecraft UID : " + err);
        }
    };

    this.isStreaming = function() {
        return streaming;
    };

    // period is in seconds
    this.startLiveStream = function(period) {
        debug("[Elecraft] Starting live data stream");
        // The radio can do live streaming to an extent, so we definitely will
        // take advantage:
        // K31 enables extended values such as proper BPF reporting
        // AI2 does not send an initial report, so we ask for the initial data
        // before...
        port.write('K31;IF;FA;FB;RG;FW;MG;IS;BN;MD;AI2;');
        if (!streaming) {
            livePoller = setInterval(queryRadio.bind(this), (period) ? period*1000: 1000);
            streaming = true;
        }
    };

    this.stopLiveStream = function(period) {
        if (streaming) {
            debug("[Elecraft] Stopping live data stream");
            // Stop live streaming from the radio:
            port.write('AI0;');
            clearInterval(livePoller);
            streaming = false;
        }
    };


    // output does whatever formatting is needed on the data
    // (none for this driver) and sends it onwards to the
    // port
    this.output = function(data) {
        port.write(data);
    };

    // Status returns an object that is concatenated with the
    // global server status
    this.status = function() {
        return { tcpserverconnect: this.serverconnected };
    };

    // We serve rigctld commands through a TCP socket too:
    this.onOpen = function(success) {

        var driver_ref = this;
        debug("Elecraft Driver: got a port open signal");
        if (server == null) {
            server = net.createServer(function(c) { //'connection' listener
                debug('server connected');
//                if (self.socket)
//                    self.socket.emit('status',{ tcpserverconnect: true });
                serverconnected = true;

                c.on('end', function() {
                    debug('Server disconnected');
//                    if (self.socket)
//                        self.socket.emit('status',{ tcpserverconnect: false });
                    serverconnected = false;
                });
                var rl = readline.createInterface(c,c);
                rl.on('line', function(data) {
                    rigctl_command(data,c);
                });
            });
        }
        server.listen(4532, function() { //'listening' listener
            debug('Rigctld emulation server started');
        });
    },

    this.onClose = function(success) {
        debug("Closing TCP rigctld emulation server");
        if (server)
            server.close();
    };

    // RIGCTLD Emulation - super light, but does the trick for fldigi...
    var rigctl_command = function(data,c) {
        // debug(data);
        var cmd = (data.substr(0,1) == "\\") ? data.substr(0,2) : data.substr(0,1);
        if (cmd == previouscmd)
            return;
        previouscmd = cmd;
        switch (cmd) {
                case "\\d": // "mp_state":
                    // No f**king idea what this means, but it makes hamlib happy.
                    c.write(hamlib_init);
                    break;
                case "f":
                    c.write(vfoa_frequency + "\n");
                    break;
                case "F": // Set Frequency (VFOA):  F 14069582.000000
                    var freq = ("00000000000" + parseFloat(data.substr(2)).toString()).slice(-11); // Nifty, eh ?

                    debug("Rigctld emulation: set frequency to " + freq);
                    if (port != null)
                        port.write("FA" + freq + ";");
                    c.write("RPRT 0\n");
                    break;
                case "m":
                     c.write("PKTUSB\n");
                     c.write(vfoa_bandwidth + "\n");
                    break;
                case "q":
                    // TODO: we should close the socket here ?
                    debug("Rigctld emulation: quit");
                    break;
                case "v": // Which VFO ?
                    c.write("VFOA\n");
                    break;
                case "T":
                    if (data.substr(2) == "1") {
                        if (port != null)
                            port.write('TX;');
                        // The radio does not echo this command, so we do it
                        // ourselves, so that the UI reacts
                        driver_ref.emit('data','TX;');

                    } else {
                        if (port != null)
                            port.write("RX;");
                        driver_ref.emit('data','RX;');
                    }
                    c.write("RPRT 0\n");
                    break;
                default:
                    debug("Unknown command: " + data);

        }

    };

    var hamlib_init =    "0\n" +
                    "2\n" +
                    "2\n" +
                    "150000.000000 30000000.000000  0x900af -1 -1 0x10 000003 0x3\n" +
                    "0 0 0 0 0 0 0\n" +
                    "150000.000000 30000000.000000  0x900af -1 -1 0x10 000003 0x3\n" +
                    "0 0 0 0 0 0 0\n" +
                    "0 0\n" +
                    "0 0\n" +
                    "0\n" +
                    "0\n" +
                    "0\n" +
                    "0\n" +
                    "\n" +
                    "\n" +
                    "0x0\n" +
                    "0x0\n" +
                    "0x0\n" +
                    "0x0\n" +
                    "0x0\n" +
                    "0\n";

}

Elecraft.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Elecraft;