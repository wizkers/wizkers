/**
 * This is the link manager: it will use its low-level driver
 * for sending commands to instruments and parsing responses
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone'),
        io = require('socketio'),

        LinkManager = function() {

            
            // Private variables:
            var self = this;
            var socket = io.connect('', {
                query: 'token=' + settings.get('token')
            }); // (we connect on same host, we don't need a URL)

            var connected = false;
            var streaming = false;
            var recording = false;

            
            // Public variables and methodfs:
            
            // Driver is public because our views want to talk to it directly
            // to use all the non-standard APIs
            this.driver = null;

            // Set the front-end instrument driver, and load the back-end instrument driver
            // This is called whenever we switch instrument
            this.setDriver = function(driver) {
                this.driver = driver;
                socket.emit('driver', this.driver.getBackendDriverName());
                socket.emit('ports','');
                console.log('Link manager: updated link manager driver for current instrument');
            };

            this.setUploader = function(driver) {
                this.driver = driver;
                socket.emit('uploader', this.driver.getBackendDriverName());
                console.log('Link manager: updated link manager uploader driver for current instrument');
            };

            /**
             * Tells our backend to refresh the outputs for an instrument
             */
            this.setOutputs = function(instrumentId) {
                socket.emit('outputs', instrumentId);
            }
    
            this.isRecording = function() {
                return recording;
            }
            
            this.isStreaming = function() {
                return streaming;
            }

            this.isConnected = function() {
                return connected;
            }


            this.controllerCommandResponse = function() {
            }

            this.requestStatus = function(data) {
                socket.emit('portstatus','');
            }


            this.getPorts = function() {
                socket.emit('ports','');        
            }

            this.openInstrument = function(id) {
                socket.emit('openinstrument', id);
            }

            this.closeInstrument = function(id) {
                // Note: this will also close recording and streaming
                // on the backend.
                socket.emit('closeinstrument', id);
            }

            // This needs to return some sort of unique identifier for the device,
            // if supported. Device type + this uniqueID are used to uniquely identify
            // instruments in the application.
            //
            // Implementation mainly occurs at the backend driver level, which is required
            // to emit a "uniqueID" message when this method is called:
            this.getUniqueID = function() {
                socket.emit('uniqueID');
            }


            this.startLiveStream = function(period) {
                console.log("[Link Manager] Starting live data stream");
                // We have moved polled live streaming to server-side so that
                // recording still works when we are not on the home screen
                socket.emit('startlivestream', (period) ? period: 1);
            }

            this.stopLiveStream = function() {
                console.log("[Link Manager] Stopping live data stream");
                socket.emit('stoplivestream');
            }
            
            // id is the Log session ID we are recording into.
            this.startRecording = function(id) {
                socket.emit('startrecording', id);
            }

            this.stopRecording = function() {
                socket.emit('stoprecording');
            }

            this.sendCommand = function(cmd) {
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
                if (typeof(data.portopen) != 'undefined') {
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
            
            function processInput(data) {
                self.trigger('input', data);
            };

            // Called to restore the state of the backend when the frontend
            // connects to it (make sure the backend driver matches the frontend instrument)
            function initConnection() {
                if (typeof(this.driver) != undefined) {
                    this.driver.setBackendDriver();
                }
            };
            
            function processPorts(data) {
                self.trigger('ports',data);
            }

            function sendUniqueID(uid) {
                self.trigger('uniqueID', uid);
            }

            // Initialization code:

            // Whenever data arrives on the backend serial port (the instrument, in other words)
            socket.on('serialEvent', processInput);
            // Updates from the backend on port (serial, server, other) status
            socket.on('status', processStatus);
            socket.on('connection', initConnection);
            socket.on('ports', processPorts);
            socket.on('uniqueID', sendUniqueID);
            // Initialize connexion status on the remote controller
            socket.emit('portstatus','');
            // Start a 3-seconds interval watchdog to listen for input
            // and request regular back-end status
            var watchdog = setInterval(wdCall.bind(this), 3000);    
        };

        // Add event management to our link manager, from the Backbone.Events class:
        _.extend(LinkManager.prototype, Backbone.Events);
    
    return LinkManager;

});