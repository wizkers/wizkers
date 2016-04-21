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
        Rigctld = require('app/outputs/fldigi/tcp_server');

   require('jquery_xmlrpc'); // Load the Xmlrpc jQuery plugin

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
        var radio_mode = "RTTY";
        var xmit = 0;     // 0 is RX, 1 is TX

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
            rigserver = new Rigctld.server(settings.ipaddress);
            rigserver.start(onRequestCallback);

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
        this.sendData = function (data) {
            if (typeof data != "string")
                return;
            var cmd = data.substr(0, 2);
            switch (cmd) {
            case "FA":
                vfoa_frequency = parseInt(data.substr(2));
                break;
            case "FB":
                vfob_frequency = parseInt(data.substr(2));
                break;
            case "BW":
                vfoa_bandwidth = parseInt(data.substr(2));
                break;
            }
        };

        //////////////////
        // Private methods
        /////////////////

        var onRequestCallback = function (tcpConnection, socketInfo) {
            var info = "[" + socketInfo.peerAddress + ":" + socketInfo.peerPort + "] Connection accepted!";

            console.log(info);
            // We are going to use a small line parser
            var parserCreator = function (callback) {
                var delimiter = "\n";
                var encoding = "utf8";
                // Delimiter buffer saved in closure
                var data = "";
                // Buffer is a string
                return function (buffer) {
                    callback(buffer, tcpConnection);
                };
            };
            var parser = parserCreator(xmlParser).bind(this);

            tcpConnection.addDataReceivedListener(function (data) {
                parser(data);
            });
        };
        
        var xmlParser = function(buffer, c) {
            var idx = buffer.indexOf('<?xml version="1.0"?>');
            var sxml = '';
            if (idx == -1) {
                // Some clients don't wrap their calls in XML headers:
                idx = buffer.indexOf('<method');
                sxml = buffer.substr(idx);
                if (idx > -1) {
                    sxml = '<?xml version="1.0"?>' + sxml + '</xml>';
                }
            } else {
               sxml = buffer.substr(idx);
            }
            
                var xml = new DOMParser().parseFromString(sxml, "text/xml");
                var json = $.xmlrpc.parseCall(xml);
                if (json.methodName) {
                    console.log("Calling:", json.methodName);
                    switch (json.methodName) {
                        case "system.listMethods":
                            listMethods(c);
                            break;
                        case "rig.get_xcvr":
                            getXcvr(c);
                            break;
                        case "rig.get_modes":
                            getModes(c);
                            break;
                        case "rig.get_bws":
                            getBws(c);
                            break;
                        case "rig.get_bw":
                            getBw(c);
                            break;
                        case "rig.get_mode":
                            getMode(c);
                            break;
                        case "rig.get_sideband":
                            getSideband(c);
                            break;
                        case "rig.set_ptt":
                            setPtt(json.params[0], c);
                            break;
                        case "rig.get_ptt":
                            getPtt(c);
                            break;
                        case "rig.get_vfo":
                            getVfo(c);
                            break;
                        case "rig.set_vfo":
                            setVfo(json.params, c);
                            break;
                        case "rig.get_notch":
                            getNotch(c);
                            break;
                        case "rig.get_smeter":
                            getSMeter(c);
                            break;
                        default:
                            console.log('Unsupported method:', json.methodName);
                            break; 
                    }
                }
            
        };
        
        var sendResponse = function (json, c) {
            var xml = $.xmlrpc.response( json );
            var body = new window.XMLSerializer().serializeToString(xml);
            // Send the body with the right headers:
            c.sendMessage('HTTP/1.1 200 OK\n');
            c.sendMessage('WizkersXmlRpc 1.0\n');
            c.sendMessage('Content-Type: text/xml\n');
            c.sendMessage('Content-length: ' + body.length + '\n\n');
            c.sendMessage(body);
            // c.sendMessage('\');            
        }
                
        var listMethods = function(c) {
            var arr = [];
            for (var cmd in commands) {
                arr.push(cmd);
            }

            sendResponse([arr], c);
        };

        var commands = {
            	"rig.get_AB": ["s:n", "returns vfo in use A or B" ],
	            "rig.get_bw": [ "s:n", "return BW of current VFO" ],
	            "rig.get_bws": [ "s:n", "return table of BW values" ],
	            "rig.get_info": [ "s:n", "return an info string" ],
	            "rig.get_mode": [ "s:n", "return MODE of current VFO" ],
	            "rig.get_modes": [ "s:n", "return table of MODE values" ],
	            "rig.get_sideband": [ "s:n", "return sideband (U/L)" ],
	            "rig.get_notch": [ "s:n", "return notch value" ],
	            "rig.get_ptt": [ "s:n", "return PTT state" ],
	            "rig.get_pwrmeter": [ "s:n", "return PWR out" ],
	            "rig.get_smeter": [  "s:n", "return Smeter" ],
	            "rig.get_update": [ "s:n", "return update to info" ],
	            "rig.get_vfo": [ "s:n", "return current VFO in Hz" ],
                "rig.get_xcvr": [ "s:n", "returns name of transceiver" ],
	            "rig.set_AB": [ "s:s", "set VFO A/B" ],
	            "rig.set_bw": [ "i:i", "set BW iaw BW table" ],
	            "rig.set_BW": [ "i:i", "set L/U pair" ],
	            "rig.set_mode": [ "i:i", "set MODE iaw MODE table" ],
	            "rig.set_notch": [ "d:d", "set NOTCH value in Hz" ],
	            "rig.set_ptt": [  "i:i", "set PTT 1/0 (on/off)" ],
	            "rig.set_vfo": [ "d:d", "set current VFO in Hz" ]
        };
        
        
        // Reguest Transceiver name
        var getXcvr = function(c) {
            sendResponse(["NONE"],c);
        }
        
        // Request Transceiver supported modes
        // Hardcoded for now, but could query the instrument to get more details
        var getModes = function(c) {
            var modes = [ "LSB", "USB", "CW", "FM", "AM", "DATA", "CW-R", 'DATA-R'];
            sendResponse([modes], c);
        }

        var getBws = function(c) {
            var bws = [ "Bandwidth"];
            for (var i = 50 ; i <= 1000; i += 50)
                bws.push(i);
            for (var i = 1100 ; i <= 2000; i += 100)
                bws.push(i);
            for (var i = 2200 ; i <= 4000; i += 200)
                bws.push(i);
                
            sendResponse([[bws]], c);
        }

        var getBw = function(c) {
            var bw = [ 3000, ''];
            sendResponse([bw], c);
        }
        
        // Hardcode for now, will update in a future revision
        var getMode = function(c) {
            var mode = [ 'DATA'];
            sendResponse(mode, c);
        }
        
        // Hardcode for now
        var getSideband = function(c) {
            var mode = [ 'U'];
            sendResponse(mode, c);
        }

        var setPtt = function( state, c) {
            if (state) {
                linkManager.sendCommand('TX;');
                    xmit = 1;
            } else {
                linkManager.sendCommand("RX;");
                xmit = 0;
            }
            
            sendResponse( [xmit], c);            
        }
        
        var getPtt = function (c) {
            sendResponse( [xmit], c);
        }
        
        var getVfo = function (c) {
            sendResponse( [ (vfoa_frequency).toString() ], c);
        }
        
        var setVfo = function(params, c) {
            var freq = ("00000000000" + params[0]).slice(-11); // Make sure we have the right number of zeroes
            console.log("Rigctld emulation: set frequency to " + freq);
            linkManager.sendCommand("FA" + freq + ";");
            sendResponse(params, c);
        }
        
        var getNotch = function(c) {
            sendResponse( [ 0], c);
        }
        
        // Not supported, but fldigi always asks for it (even if we don't
        // say we support it)
        var getSMeter = function(c) {
            var forced = $.xmlrpc.force('i4', 0);
            sendResponse( [forced], c);
        }


    }

    _.extend(Output.prototype, Backbone.Events);

    return Output;

});