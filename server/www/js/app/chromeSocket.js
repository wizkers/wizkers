/** (c) 2015 Edouard Lafargue, ed@lafargue.name
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
 * This chromeSocket file simulates the behaviour of socket.io API
 * in the case of a Chrome packaged application.
 *
 * Essentially, it has the same role as "server.js" in the Node version
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function (require) {

    "use strict";

    var Backbone = require('backbone'),
        ConnectionManager = require('app/connections/connectionmanager');

    var socketImpl = function () {

        var connectionmanager = new ConnectionManager(this);

        // The driver of the current instrument. We only support
        // one open instrument at a time in Chrome mode.
        var self = this,
            driver = null,
            currentInstrumentid = null,
            uploader_mode = false; // Will be true when we have loaded the special uploader driver.

        // Public methods

        // Same API as for the socket object... pretty basic implementation, I know
        this.emit = function (cmd, args) {
            switch (cmd) {
            case 'portstatus':
                portStatus(args);
                break;
            case 'uniqueID':
                uniqueID(args);
                break;
            case 'openinstrument':
                openInstrument(args);
                break;
            case 'closeinstrument':
                closeInstrument(args);
                break;
            case 'controllerCommand':
                controllerCommand(args, false);
                break;
            case 'rawCommand':
                controllerCommand(args, true);
            case 'ports':
                getPorts(args);
                break;
            case 'driver':
                setDriver(args);
                break;
            case 'uploader': // Alternative driver type for firmware updates
                setUploader(args);
            case 'outputs':
                setOutputs(args);
                break;
            case 'startrecording':
                startRecording(args);
                break;
            case 'stoprecording':
                stopRecording(args);
                break;
            case 'startlivestream':
                startLiveStream(args);
                break;
            case 'stoplivestream':
                stopLiveStream(args);
                break;
            default:
                break;
            }
        };

        // Trick: 
        this.connect = function () {
            return this;
        };


        ////////
        //  Private methods
        ////////

        var portStatus = function (insid) {
            if (insid)
                console.log('portStatus', insid);
            var s = {
                portopen: (driver) ? driver.isOpen() : false,
                recording: false,
                streaming: (driver) ? driver.isStreaming() : false,
                uploader: uploader_mode
            };
            self.trigger('status', s);
        }


        var openInstrument = function (insid) {
            connectionmanager.openInstrument(insid, function (d) {
                driver = d;
                currentInstrumentid = insid;
                // Listen for data coming in from our driver
                driver.on('data', sendDataToFrontEnd);
                // Reconnect the outputs for the instrument
                // outputmanager.enableOutputs(insid, driver);
            });
        }

        var closeInstrument = function (insid) {
            if (insid != currentInstrumentid) {
                console.log("**** ERROR, the socket asked to close an instrument that is not the current instrument on this socket.", insid);
                return;
            }

            console.log('Instrument close request for instrument ID ' + insid);
            if (driver)
                driver.off('data', sendDataToFrontEnd);
            //recorder.stopRecording(insid);
            //outputmanager.disconnectOutputs(insid);
            connectionmanager.closeInstrument(insid);
            currentInstrumentid = null;


        }

        var controllerCommand = function (data) {
            console.log('controllerCommand');
        }

        var startRecording = function (logid) {
            console.log('startRecording');
        }

        var stopRecording = function () {
            console.log('stopRecording');
        }

        var startLiveStream = function (data) {
            console.log('startLiveStream');
        }

        var stopLiveStream = function () {
            console.log('stopLiveStream');
        }

        var uniqueID = function () {
            if (driver)
                driver.sendUniqueID();
        }

        var getPorts = function () {
            console.log('ports');
            chrome.serial.getDevices(onGetDevices);
        }

        var setOutputs = function (insid) {
            console.log('setOutputs');
        }

        var setUploader = function (insid) {
            console.log('setUploader');
        }

        ///////////
        // Callbacks
        ///////////

        // We want to listen for data coming in from drivers:
        var sendDataToFrontEnd = function (data) {
            if (data === undefined) {
                debug('Warning, we were just asked to send empty data to the front-end');
                return;
            }
            // Temporary: detect "uniqueID" key and send as 'uniqueID' message
            if (data.uniqueID) {
                self.trigger('uniqueID', data.uniqueID);
                return;
            }
            self.trigger('serialEvent', data);
        }

        function onGetDevices(ports) {
            var portlist = [];
            for (var i = 0; i < ports.length; i++) {
                portlist.push(ports[i].path);
            }
            self.trigger('ports', portlist);
        }



    }


    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(socketImpl.prototype, Backbone.Events);
    return new socketImpl;
});