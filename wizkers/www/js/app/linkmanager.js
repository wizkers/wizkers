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
 * This is the link manager: it will use its low-level driver
 * for sending commands to instruments and parsing responses
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {

    "use strict";

    var _ = require('underscore'),
        Backbone = require('backbone'),
        io = require('socketio'),

        LinkManager = function () {


            // Private variables:
            var self = this;
            var socket = io.connect('', {
                query: 'token=' + settings.get('token')
            }); // (we connect on same host, we don't need a URL)

            var connected = false;
            var streaming = false;
            var recording = false;

            // Public variables and methods:

            // Driver is public because our views want to talk to it directly
            // to use all the non-standard APIs
            this.driver = null;

            // Set the front-end instrument driver, and load the back-end instrument driver
            // This is called whenever we switch instrument
            this.setDriver = function (driver) {
                this.driver = driver;

                // This is legacy, should not be called anymore
                // socket.emit('driver', this.driver.getBackendDriverName());
                // socket.emit('ports', '');
                console.log('Link manager: updated link manager driver for current instrument');
            };

            this.setUploader = function (driver) {
                this.driver = driver;
                socket.emit('uploader', this.driver.getBackendDriverName());
                console.log('Link manager: updated link manager uploader driver for current instrument');
            };

            /**
             * Tells our backend to refresh the outputs for an instrument
             */
            this.setOutputs = function (instrumentId) {
                socket.emit('outputs', instrumentId);
            }

            this.isRecording = function () {
                return recording;
            }

            this.isStreaming = function () {
                return streaming;
            }

            this.isConnected = function () {
                return connected;
            }

            this.requestReplay = function() {
                socket.emit('replaydata', 0);
            }

            this.controllerCommandResponse = function () {}

            // data will usually be empty/undefined, but
            // if it contains an instrumentID, the server
            // will check that specific instrument.
            this.requestStatus = function (data) {
                socket.emit('portstatus', data);
            }

            this.getPorts = function (insType) {
                socket.emit('ports', insType);
            }

            this.openInstrument = function (id) {
                stats.instrumentEvent('openinstrument', '');
                socket.emit('openinstrument', id);
            }

            this.openBootloader = function (id) {
                stats.instrumentEvent('openbootloader', '');
                socket.emit('openbootloader', id);
            }

            /**
             * Returns the open/closed state of a given instrument. Mostly makes sense
             * in server mode where we can have multiple open instruments.
             * @param {String} id Instrument ID
             */
            this.isInstrumentOpen = function (id) {
                socket.emit('isinstrumentopen', id);
            }

            this.closeInstrument = function (id) {
                if (id == undefined && instrumentManager.getInstrument())
                    id = instrumentManager.getInstrument().id;
                // Note: this will also close recording and streaming
                // on the backend.
                stats.instrumentEvent('closeinstrument', '');
                socket.emit('closeinstrument', id);
            }

            // This needs to return some sort of unique identifier for the device,
            // if supported. Device type + this uniqueID are used to uniquely identify
            // instruments in the application.
            //
            // Implementation mainly occurs at the backend driver level, which is required
            // to emit a "uniqueID" message when this method is called:
            this.getUniqueID = function () {
                socket.emit('uniqueID');
            }

            this.startLiveStream = function (period) {
                console.log("[Link Manager] Starting live data stream");
                // We have moved polled live streaming to server-side so that
                // recording still works when we are not on the home screen
                socket.emit('startlivestream', (period) ? period : 1);
            }

            this.stopLiveStream = function () {
                console.log("[Link Manager] Stopping live data stream");
                socket.emit('stoplivestream');
            }

            // id is the Log session ID we are recording into.
            this.startRecording = function (id) {
                stats.instrumentEvent('startrecording', '');
                socket.emit('startrecording', id);
            }

            this.stopRecording = function () {
                stats.instrumentEvent('stoprecording', '');
                socket.emit('stoprecording');
            }

            this.sendCommand = function (cmd) {
                socket.emit('controllerCommand', cmd);
            }

            ///////////////////////
            // Private methods
            ///////////////////////

            // Request regular port status updates
            function wdCall() {
                this.requestStatus();
            }

            // status contains:
            // - Port open: portopen
            // - Recording: recording
            // - Streaming: streaming
            function processStatus(data) {
                if (typeof (data.portopen) != 'undefined') {
                    if (data.portopen) {
                        connected = true;
                        streaming = data.streaming;
                        recording = data.recording;
                    } else {
                        connected = false;
                        streaming = data.streaming;
                        recording = data.recording;
                    }
                }
                // Tell anyone who would be listening that status is updated
                self.trigger('status', data);
            }

            /**
             * This is there the instrument data arrives into the front-end.
             * We are going to keep a ring buffer of the last 500 events in the
             * link manager, so that this ring buffer can be replayed on demand to
             * catch up on live instrument data after switching screens
              * @param {Object} data data is normally a string, can be an
             */
            function processInput(data) {
                self.trigger('input', data);
            };

            // Called to restore the state of the backend when the frontend
            // connects to it (make sure the backend driver matches the frontend instrument)
            function initConnection() {
                if (typeof (this.driver) != undefined) {
                    this.driver.setBackendDriver();
                }
            };

            function processPorts(data) {
                self.trigger('ports', data);
            }

            function sendUniqueID(uid) {
                self.trigger('uniqueID', uid);
            }

            function processInstrumentStatus(status) {
                self.trigger('instrumentStatus', status);
            }

            // Initialization code:

            // Whenever data arrives on the backend serial port (the instrument, in other words)
            socket.on('serialEvent', processInput);
            // Updates from the backend on port (serial, server, other) status
            socket.on('status', processStatus);
            socket.on('connection', initConnection);
            socket.on('ports', processPorts);
            socket.on('uniqueID', sendUniqueID);
            socket.on('instrumentStatus', processInstrumentStatus);
            // Initialize connexion status on the remote controller
            socket.emit('portstatus', '');
            // Start a 3-seconds interval watchdog to listen for input
            // and request regular back-end status
            var watchdog = setInterval(wdCall.bind(this), 3000);
        };

    // Add event management to our link manager, from the Backbone.Events class:
    _.extend(LinkManager.prototype, Backbone.Events);

    return LinkManager;

});