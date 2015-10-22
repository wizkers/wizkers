/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * This chromeSocket file simulates the behaviour of socket.io API
 * in the case of a Chrome packaged application, or a Cordova app too.
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
            currentLog = null,
            openPending = false,
            recording = false,
            uploader_mode = false; // Will be true when we have loaded the special uploader driver.

        // We keep a buffer of the last 500 events
        var data_buffer = [];
        var data_buffer_max = 500;
        var suspend_data = false;

        ////////////////////
        // Public methods
        // Same API as for the socket object on server.js (Node application)
        //////////////////// 
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
                controllerCommand(args);
                break;
            case 'rawCommand':
                console.log("Legacy call to 'rawCommand'");
                break;
            case 'ports':
                getPorts(args);
                break;
            case 'driver':
            case 'uploader':
                console.log("Legacy call to 'driver' or 'uploader'");
                break;
            case 'openbootloader': // Alternative driver type for firmware updates
                openBootloader(args);
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
            case 'replaydata':
                replayData(args);
                break;
            case 'isinstrumentopen':
                console.log('Call to isintrumentopen in Chrome/Cordova mode, ignoring');
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

        // Implementation of recording is kept here because we only
        // have one instrument open at a time, so no need for the more
        // complex implementation of the node.js version:
        var record = function (data) {
            // console.log("Recording " + data);
            currentLog.entries.create({
                timestamp: new Date().getTime(),
                logsessionid: currentLog.id,
                data: data
            });
        }

        var portStatus = function (insid) {
            if (insid)
                console.log('portStatus', insid);
            if (openPending || ((driver) && driver.isOpenPending()))
                return; // We don't update status until the instrument is open (or failed to open)
            var s = {
                portopen: (driver) ? driver.isOpen() : false,
                recording: recording,
                streaming: (driver) ? driver.isStreaming() : false,
                uploader: uploader_mode
            };
            self.trigger('status', s);
        }

        var openInstrument = function (insid) {
            openPending = true;
            connectionmanager.openInstrument(insid, function (d) {
                openPending = false;
                driver = d;
                currentInstrumentid = insid;
                // Listen for data coming in from our driver
                driver.on('data', sendDataToFrontEnd);
                outputManager.enableOutputs(insid, driver);
            }, false);
        }

        var closeInstrument = function (insid) {
            /**
              Remove this in Chrome mode, since we only have one open intrument open at a time
            if (insid != currentInstrumentid) {
                console.log(
                    "**** ERROR, the socket asked to close an instrument that is not the current instrument on this socket.",
                    insid);
                return;
            }
            */

            console.log('Instrument close request for instrument ID ' + insid);
            if (driver)
                driver.off('data', sendDataToFrontEnd);
            //recorder.stopRecording(insid);
            //outputmanager.disconnectOutputs(insid);
            connectionmanager.closeInstrument(insid);
            currentInstrumentid = null;


        }

        var controllerCommand = function (data) {
            driver.output(data);
        }

        var startRecording = function (logid) {
            console.log("[chromeSocket] In-browser implementation of start recording");
            currentLog = instrumentManager.getInstrument().logs.get(logid);
            currentLog.fetch({
                success: function () {
                    currentLog.save({
                        isrecording: true
                    });
                    recording = true;
                }
            });
        }

        var stopRecording = function () {
            console.log("[chromeSocket] In-browser implementation of stop recording");
            if (currentLog) {
                currentLog.save({
                    isrecording: false
                });
                currentLog = null;
            }
            recording = false;
        }

        var startLiveStream = function (data) {
            if (driver)
                driver.startLiveStream(data);
        }

        var stopLiveStream = function () {
            if (driver)
                driver.stopLiveStream();
        }

        var uniqueID = function () {
            if (driver)
                driver.sendUniqueID();
        }

        /**
         * Ask for a list of ports. This depends on the instrument type.
         * @param {String} insType Instrument type (serial, HID etc)
         */
        var getPorts = function (insType) {
            console.log('ports');
            // I'm sure this could be a lot more elegant, but at least it avoids
            // complicated patterns and it can support various port types:
            var ct = instrumentManager.getConnectionTypeFor(insType);
            if (ct == 'app/views/instrument/serialport') {
                switch (vizapp.type) {
                case 'chrome':
                    chrome.serial.getDevices(onGetDevices);
                    break;
                case 'cordova':
                    self.trigger('ports', ["OTG Serial"]);
                    break;
                }
            } else if (ct == 'app/views/instrument/bluetooth') {
                switch (vizapp.type) {
                case 'chrome':
                    discoverBluetooth();
                    break;
                case 'cordova':
                    cordovaDiscoverBluetooth();
                    break;
                }
            } else {
                self.trigger('ports', ["Not available"]);
            }
        }

        /**
         * Only in Cordova mode, that's pretty obvious
         */
        var cordovaDiscoverBluetooth = function () {

            var device_names = {};
            // OK, we have Bluetooth, let's do the discovery now
            function startScanSuccess(status) {
                // Stop discovery after 30 seconds.
                if (status.status == 'scanStarted') {
                    setTimeout(function () {
                        bluetoothle.stopScan(function () {
                            console.log('Stopped scan');
                        }, function () {});
                    }, 30000);
                }
                if (status.address) {
                    device_names[status.address] = {
                        name: status.name || status.address,
                        address: status.address
                    };
                    console.log('New BT Device', status);
                    self.trigger('ports', device_names);
                }
            }

            function startScanError(status) {
                console.log(status);
            }

            function success(status) {
                if (status.status == 'enabled') {
                    bluetoothle.startScan(startScanSuccess, startScanError, {
                        "serviceUuids": [],
                        allowDuplicates: true
                    });
                } else {
                    // The user didn't enable BT... error ?
                }
            };

            function error(err) {};

            bluetoothle.initialize(success, error, {
                request: true,
                statusReceiver: false
            });
        }

        var discoverBluetooth = function () {
            var device_names = {};

            var updateDeviceName = function (device) {
                device_names[device.address] = {
                    name: device.name,
                    address: device.address
                };
                console.log('New BT Device', device);
                self.trigger('ports', device_names);
            };
            var removeDeviceName = function (device) {
                delete device_names[device.address];
                self.trigger('ports', device_names);
            };
            // Add listeners to receive newly found devices and updates
            // to the previously known devices.
            chrome.bluetooth.onDeviceAdded.addListener(updateDeviceName);
            chrome.bluetooth.onDeviceChanged.addListener(updateDeviceName);
            chrome.bluetooth.onDeviceRemoved.addListener(removeDeviceName);

            // With the listeners in place, get the list of devices found in
            // previous discovery sessions, or any currently active ones,
            // along with paired devices.
            chrome.bluetooth.getDevices(function (devices) {
                for (var i = 0; i < devices.length; i++) {
                    updateDeviceName(devices[i]);
                }
            });

            // Now begin the discovery process.
            chrome.bluetooth.startDiscovery(function () {
                // Stop discovery after 30 seconds.
                setTimeout(function () {
                    chrome.bluetooth.stopDiscovery(function () {});
                }, 30000);
            });
        }

        var setOutputs = function (insid) {
            console.log('setOutputs');
            if (driver) {
                outputManager.enableOutputs(insid, driver);
            } else {
                console.log("Skipped updating outputs because we have no driver (instrument is closed?)");
            }
        }

        var openBootloader = function (insid) {
            // Open the instrument with uploader driver, not regular ('true' as 3rd arg)
            connectionmanager.openInstrument(insid, function (d) {
                driver = d;
                currentInstrumentid = insid;
                // Listen for data coming in from our driver
                driver.on('data', sendDataToFrontEnd);
            }, true);
        }

        /**
         * Resend the contents of the data buffer all at once.
         * Note: we send the data points as an object with the
         *       time stamp embedded for accurate replay.
         * @param {Number} l Number of points to resend (not used)
         */
        var replayData = function (l) {
            suspend_data = true;
            for (var i = 0; i < data_buffer.length; i++) {
                self.trigger('serialEvent', data_buffer[i]);
            }
            suspend_data = false;
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
            if (data.uniqueID != undefined) {
                self.trigger('uniqueID', data.uniqueID);
                return;
            }
            if (recording)
                record(data);
            outputManager.output(data);

            // Now also keep the data in our data buffer:
            var stamp = (data.timestamp) ? new Date(data.timestamp).getTime() : new Date().getTime();
            data_buffer.push({
                replay_ts: stamp,
                data: data
            });
            if (data_buffer.length > data_buffer_max)
                data_buffer.shift();
            if (!suspend_data)
                self.trigger('serialEvent', data);
        }

        function onGetDevices(ports) {
            var portlist = [];
            for (var i = 0; i < ports.length; i++) {
                portlist.push(ports[i].path);
            }
            portlist.push('TCP/IP');
            self.trigger('ports', portlist);
        }



    }

    // Add event management to our the Chrome socket, from the Backbone.Events class:
    _.extend(socketImpl.prototype, Backbone.Events);
    return new socketImpl;
});