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

            var self = this;
            this.socket = io.connect('', {
                query: 'token=' + settings.get('token')
            }); // (we connect on same host, we don't need a URL)

            var connected = false;
            var streaming = false;
            var recording = false;

            this.driver = null;

            this.setDriver = function(driver) {
                this.driver = driver;
                this.driver.setBackendDriver();
                this.socket.emit('ports','');
                console.log('Link manager: updated link manager driver for current instrument');
            };
    
            this.initConnection = function() {
                if (typeof(this.driver) != undefined) {
                    this.driver.setBackendDriver();
                }
            };

            // Careful: in those functions, "this" is the socket.io context,
            // hence the use of self.
            this.processInput = function(data) {
                self.trigger('input', data);
            };

            this.sendUniqueID = function(uid) {
                self.trigger('uniqueID', uid);
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

            // status contains:
            // - Port open: portopen
            // - Recording: recording
            // - Streaming: streaming
            this.processStatus = function(data) {
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

            this.processPorts = function(data) {
                self.trigger('ports',data);
            }

            this.controllerCommandResponse = function() {
            }

            this.requestStatus = function(data) {
                this.socket.emit('portstatus','');
            }


            this.getPorts = function() {
                this.socket.emit('ports','');        
            }

            this.openInstrument = function(id) {
                this.socket.emit('openinstrument', id);
            }

            this.closeInstrument = function(id) {
                // Note: this will also close recording and streaming
                // on the backend.
                this.socket.emit('closeinstrument', id);
            }

            // This needs to return some sort of unique identifier for the device,
            // if supported. Device type + this uniqueID are used to uniquely identify
            // instruments in the application.
            //
            // Implementation mainly occurs at the backend driver level, which is required
            // to emit a "uniqueID" message when this method is called:
            this.getUniqueID = function() {
                self.socket.emit('uniqueID');
            }

            // Request regular port status updates
            this.wdCall = function() {
                this.requestStatus();
            }

            this.startLiveStream = function(period) {
                console.log("Start live stream");
                console.log("[Link Manager] Starting live data stream");
                // We have moved polled live streaming to server-side so that
                // recording still works when we are not on the home screen
                this.socket.emit('startlivestream', (period) ? period: 1);
            }

            this.stopLiveStream = function() {
                console.log("[Link Manager] Stopping live data stream");
                this.socket.emit('stoplivestream');
            }
            
            // id is the Log session ID we are recording into.
            this.startRecording = function(id) {
                this.socket.emit('startrecording', id);
            }

            this.stopRecording = function() {
                this.socket.emit('stoprecording');
            }

            this.manualCommand = function(cmd) {
                this.socket.emit('controllerCommand', cmd);
            }

            // Initialization code:

            // Whenever data arrives on the backend serial port (the instrument, in other words)
            this.socket.on('serialEvent', this.processInput);

            // Updates from the backend on port (serial, server, other) status
            this.socket.on('status', this.processStatus);
            this.socket.on('connection', this.initConnection);
            this.socket.on('ports', this.processPorts);
            this.socket.on('uniqueID', this.sendUniqueID);
            // Initialize connexion status on the remote controller
            this.socket.emit('portstatus','');
            // Start a 3-seconds interval watchdog to listen for input
            // and request regular back-end status
            this.watchdog = setInterval(this.wdCall.bind(this), 3000);    
        };

        // Add event management to our link manager, from the Backbone.Events class:
        _.extend(LinkManager.prototype, Backbone.Events);
    
    return LinkManager;

});