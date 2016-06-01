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
        TCPServer = require('app/lib/tcp_server');

   require('jquery_xmlrpc'); // Load the Xmlrpc jQuery plugin

    var Output = function () {

        var mappings = null;
        var settings = null;
        var output_ref = null;
        var rigserver = null;
        var previouscmd = '';

        // A few driver variables: we keep track of a few things
        // here
        
        var radio_modes = [];
        
        var bws_list = [ $.xmlrpc.force('none', 'Bandwidth')];
            for (var i = 50 ; i <= 1000; i += 50)
                bws_list.push($.xmlrpc.force('none', i));
            for (var i = 1100 ; i <= 2000; i += 100)
                bws_list.push($.xmlrpc.force('none', i));
            for (var i = 2200 ; i <= 4000; i += 200)
                bws_list.push($.xmlrpc.force('none', i));
                
         // Cache a couple of references to save CPU
         var domParser = new DOMParser();
        
        // Note: we do not poll for those values ourselves, we
        // count on the UI to do this - to be reviewed later if
        // necessary...
        var vfoa_frequency = 0;
        var vfob_frequency = 0;
        var vfoa_bandwidth = 0;
        var pwr_level_kx3 = 0;
        var pwr_level_kxpa = 0;
        var radio_mode = "DATA";
        var xmit = 0;     // 0 is RX, 1 is TX

        // Load the settings for this plugin
        this.setup = function (output) {

            console.log("[XMLRPC Output plugin] Setup a new instance");
            output_ref = output;
            mappings = output.get('mappings');
            settings = output.get('metadata');

            // Query the radio for basic frequency info, so that
            // we populate our frequency variables:
            linkManager.sendCommand('FA;FB;BW;'); // Query VFO B and VFOA Display
            
            // Query our driver for all supported modes:
            radio_modes = linkManager.driver.getModes();
            

            // Create a rigserver:
            if (rigserver) {
                rigserver.disconnect();
            }
            rigserver = new TCPServer.server(settings.ipaddress, 12345);
            rigserver.start(onRequestCallback);

        };

        this.onClose = function () {
            if (rigserver) {
                console.log('[xmlrpc] Closing existing server');
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
        // The data is the raw stream from the radio, we just pick what
        // we want there. 
        //
        // TODO: refactor to get the processed stream from the radio, so that
        // we can support any type of transceiver, and not rely on Kenwood/Elecraft
        // vocabulary.
        this.sendData = function (data) {
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
                
            // All the commands below are Kenwood style:
            if (data.raw[0] == '^') {
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

        var onRequestCallback = function (tcpConnection, socketInfo) {
            var info = "[" + socketInfo.peerAddress + ":" + socketInfo.peerPort + "] Connection accepted!";
            console.info(info);

            var onError = function(info) {
                // Destroy our parser.
            };

            tcpConnection.addDataReceivedListener(function (data) {
                xmlParser(data, tcpConnection);
            }, onError);
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
            
            var xml = domParser.parseFromString(sxml, "text/xml");
            var json = $.xmlrpc.parseCall(xml);
            if (json.methodName) {
                //console.log("Calling:", json.methodName);
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
                    case "rig.set_mode":
                        setMode(json.params, c);
                        break;
                    case "rig.get_bws":
                        getBws(c);
                        break;
                    case "rig.get_bw":
                        getBw(c);
                        break;
                    case "rig.set_bw":
                        setBw(json.params[0], c);
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
                    case "rig.get_pwrmeter":
                        getPowerMeter(c);
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
            sendResponse(["KX3"],c);
        }
        
        // Request Transceiver supported modes
        // Hardcoded for now, but could query the instrument to get more details
        var getModes = function(c) {
            sendResponse([radio_modes], c);
        }
        
        var setMode = function(params, c) {
            console.log(params);
            sendResponse([], c);
        }

        // Note: we force the response type to 'none' which removes
        // the type of the <value> tag, as expected by fldigi (XMLRPC spec says
        // that no type is equivalent to a String.)
        var getBws = function(c) {                
            sendResponse([[bws_list]], c);
        }

        var getBw = function(c) {
            var bw = [ $.xmlrpc.force('none', vfoa_bandwidth), ''];
            sendResponse([bw], c);
        }
        
        var setBw = function(params, c) {
            console.log(params);
            sendResponse( [], c);
        }
        
        var getMode = function(c) {
            var mode = [ radio_mode ];
            sendResponse(mode, c);
        }
        
        // Hardcode for now
        var getSideband = function(c) {
            var mode = [ 'U'];
            sendResponse(mode, c);
        }

        var setPtt = function( state, c) {
            linkManager.driver.ptt(state);
            xmit = state;            
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
            linkManager.driver.setVFO(freq, 'a');
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

        // Not supported, but fldigi always asks for it (even if we don't
        // say we support it)
        var getPowerMeter = function(c) {
            var pwr = Math.max(pwr_level_kx3, pwr_level_kxpa);
            // var forced = $.xmlrpc.force('i4', 0);
            sendResponse( [pwr], c);
        }


    }

    _.extend(Output.prototype, Backbone.Events);

    return Output;

});