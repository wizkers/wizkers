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

/**
 *
 * In-Browser implementation for Chrome and Cordova runmodes
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 *
 *  Exposes three methods:
 *
 *  - setup
 *  - sendData
 *  - resolveMapping
 */

define(function (require) {

    "use strict";

    var _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        Rigctld = require('app/lib/tcp_server');

    var Output = function () {

        var mappings = null;
        var settings = null;
        var output_ref = null;
        var rigserver = null;
        var previouscmd = '';

        // A few driver variables: we keep track of a few things
        // here for our bare-bones rigctld implementation.
        //
        // Note: we do not poll for those values ourselves, we
        // count on the UI to do this - to be reviewed later if
        // necessary...
        var vfoa_frequency = 0;
        var vfob_frequency = 0;
        var vfoa_bandwidth = 0;
        var pwr_level_kxpa = 0;
        var pwr_level_kx3 = 0;
        var radio_mode = "RTTY";
        var xmit = 0;     // 0 is RX, 1 is TX
        var radio_modes = ["LSB", "USB", "CW", "FM", "AM", "DATA", "CW-REV", 0, "DATA-REV"];

        // Load the settings for this plugin
        this.setup = function (output) {

            console.log("[Rigctld Output plugin] Setup a new instance");
            output_ref = output;
            mappings = output.get('mappings');
            settings = output.get('metadata');

            // Query the radio for basic frequency info, so that
            // we populate our frequency variables:
            linkManager.sendCommand('FA;FB;BW;'); // Query VFO B and VFOA Display


            // Create a rigserver:
            if (rigserver) {
                rigserver.disconnect();
            }
            rigserver = new Rigctld.server(settings.ipaddress, 4532);
            rigserver.start(onAcceptCallback, onErrorCallback);

        };

        this.onClose = function () {
            if (rigserver) {
                console.log('[Rigctld] Closing existing server');
                rigserver.disconnect();
            }
        }

        // The output manager needs access to this to compute alarm conditions
        // -> not relevant for this plugin.
        this.resolveMapping = function (key, data) {
            return null;
        };


        // In this plugin, we just keep track of the incoming data and
        // only send data upon request on the TCP server interface
        this.sendData = function (data, isAlarm) {
            if (typeof data != 'object')
                return;

            if (data.vfoa) {
                vfoa_frequency = data.vfoa;
                return;
              } else if (data.vfob) {
                vfob_frequency = data.vfob;
                return;
            }

            if (data.raw == undefined)
                return;

            if (data[0] == '^') {
                var cmd = data.raw.substr(1,2);
                switch (cmd) {
                    case "PF":
                        pwr_level_kxpa = Math.ceil(parseInt(data.raw.substr(3))/10);
                        break;
                }
            } else {
                switch (data.raw.substr(0, 2)) {
                case "BW":
                case "FW":
                    vfoa_bandwidth = parseInt(data.raw.substr(2))*10;
                    break;
                case "PO": // KX3 power level
                    pwr_level_kx3 = Math.ceil(parseInt(data.raw.substr(2))/10);
                    break;
                case "IF":
                    radio_mode = radio_modes[parseInt(data.raw.substr(29,1))-1];
                    break;
                }
            }
        };

        //////////////////
        // Private methods
        /////////////////

        var onAcceptCallback = function (tcpConnection, socketInfo) {
            var info = "[" + socketInfo.peerAddress + ":" + socketInfo.peerPort + "] Connection accepted!";

            console.log(info);
            // We are going to use a small line parser
            var parserCreator = function (callback) {
                var delimiter = "\n";
                var encoding = "utf8";
                // Delimiter buffer saved in closure
                var data = "";
                return function (buffer) {
                    // Collect data
                    data += buffer;
                    // Split collected data by delimiter
                    var parts = data.split(delimiter);
                    data = parts.pop();
                    if (parts.length)
                        parts.forEach(function (part, i, array) {
                            callback(part, tcpConnection);
                        });
                };
            };
            var parser = parserCreator(rigctl_command).bind(this);

            var onError = function(info) {
                // Act if we receive an error (not needed, because the socket
                // will automatically close and we will be de-referenced)
            };

            tcpConnection.addDataReceivedListener(function (data) {
                parser(data);
            }, onError);
        };

        /**
         * Called when we get an error on the socket - usually a disconnect for some reason.
         */
        var onErrorCallback = function() {

        };

        // RIGCTLD Emulation - super light, but does the trick for fldigi...
        var rigctl_command = function (data, c) {
            //console.log("[rig cmd] " + data);
            var tmpstr = [];
            var cmd = (data.substr(0, 1) == "\\") ? data.substr(0, 2) : data.substr(0, 1);
            // makes communication more reliable if we start missing data,
            // but sometimes, software sends "T" commands twice in a row, hence the
            // test below:
            // if (cmd == previouscmd && cmd != "T")
            //    return;
            previouscmd = cmd;
            switch (cmd) {
            case "\\d": // "mp_state":
                // No f**king idea what this means, but it makes hamlib happy.
                c.sendMessage(hamlib_init);
                break;
            case "f":
                c.sendMessage(vfoa_frequency + "\n");
                break;
            case "F": // Set Frequency (VFOA):  F 14069582.000000
                var freq = ("00000000000" + parseFloat(data.substr(2)).toString()).slice(-11); // Nifty, eh ?
                console.log("Rigctld emulation: set frequency to " + freq);
                linkManager.driver.setVFO(freq, 'a');
                c.sendMessage("RPRT 0\n");
                break;
            case "m":
                c.sendMessage("USB\n500");
                break;
            case "M": // Set mode
                // Not implemented yet
                tmpstr = data.split(' ');
                radio_mode = tmpstr[1];
                c.sendMessage("RPRT 0\n");
                break;
            case "q":
                // TODO: we should close the socket here ?
                console.log("Rigctld emulation: quit");
                c.close();
                break;
            case "v": // Which VFO ?
                c.sendMessage("VFOA\n");
                break;
            case "s": // "Get Split VFO" -> VFOB
                c.sendMessage("0\nVFOA\n");
                break;
            case 't':
                c.sendMessage("" + xmit + "\n");
                break;
            case "T":
                if (data.substr(2) == "1") {
                    linkManager.driver.ptt(true);
                     xmit = 1;
                } else {
                    linkManager.driver.ptt(false);
                    xmit = 0;
                }
                c.sendMessage("RPRT 0\n");
                break;
            default:
                console.log("Unknown command: " + data);

            }

        };

        var hamlib_init = "0\n" +
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
        var hamlib_init_2 = "0\n" +
            "229\n" +
            "2\n" +
            "500000.000000 30000000.000000 0x1bf -1 -1 0x3 0x3\n" +
            "48000000.000000 54000000.000000 0x1bf -1 -1 0x3 0x3\n" +
            "0 0 0 0 0 0 0\n" +
            "1800000.000000 2000000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "3500000.000000 4000000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "7000000.000000 7300000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "10100000.000000 10150000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "14000000.000000 14350000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "18068000.000000 18168000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "21000000.000000 21450000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "24890000.000000 24990000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "28000000.000000 29700000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "50000000.000000 54000000.000000 0x1bf 10 10000 0x3 0x3\n" +
            "0 0 0 0 0 0 0\n" +
            "0x1bf 1\n" +
            "0 0\n" +
            "0xc 2500\n" +
            "0x82 500\n" +
            "0x110 500\n" +
            "0x1 6000\n" +
            "0x20 6000\n" +
            "0 0\n" +
            "9990\n" +
            "9990\n" +
            "0\n" +
            "0\n" +
            "14 \n" +
            "10 \n" +
            "0x10002\n" +
            "0x10002\n" +
            "0x4002703b\n" +
            "0x2703b\n" +
            "0x0\n" +
            "0x0";




    }

    _.extend(Output.prototype, Backbone.Events);

    return Output;

});