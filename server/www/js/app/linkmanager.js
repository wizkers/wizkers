/**
 * This is the link manager: it will use its low-level driver
 * for sending commands to instruments and parsing responses
 *
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

            this.connected = false;
            this.streaming = false;
            this.lastInput = 0;

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
                self.lastInput = new Date().getTime();
            };

            this.sendUniqueID = function(uid) {
                self.trigger('uniqueID', uid);
            }

            this.processStatus = function(data) {
                if (typeof(data.portopen) != 'undefined') {
                    if (data.portopen) {
                        self.connected = true;
                    } else {
                        self.connected = false;
                        if (self.driver)
                            self.driver.stopLiveStream();
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
                this.stopLiveStream();
                this.socket.emit('closeinstrument', id);
                this.connected = false;
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


            this.wdCall = function() {
                var ts = new Date().getTime();
                if ((ts-this.lastInput) > 5000)
                    this.requestStatus();
            }

            this.startLiveStream = function(arg) {
                if (!this.streaming) {
                    console.log("Start live stream");
                    this.driver.startLiveStream(arg);
                    this.streaming = true;
                }
            }

            this.stopLiveStream = function() {
                if (this.streaming) {
                    console.log("Stop live stream");
                    this.driver.stopLiveStream();
                    this.streaming = false;
                }
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
            // Start a 3-seconds interval watchdog to listen for input:
            // if no input in the last 2 seconds, then request port status
            this.watchdog = setInterval(this.wdCall.bind(this), 5000);    
        };

        // Add event management to our link manager, from the Backbone.Events class:
        _.extend(LinkManager.prototype, Backbone.Events);
    
    return LinkManager;

});