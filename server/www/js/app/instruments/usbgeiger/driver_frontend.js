/**
 * The controller communication manager:
 *  - manages the socket.io link
 *  - provides API to the backend device to use by views
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    "use strict";

    // linkManager is a reference to the parent link manager
    return function(linkManager) {

        var self = this;
        var lm = linkManager;
        this.socket = lm.socket;
        var streaming = true;

        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.setBackendDriver = function() {
            lm.socket.emit('driver','usbgeiger');
        }
                
        //////
        // End of standard API
        //////


        // All commands below are fully free and depend on
        // the instrument's capabilities

        this.ping = function() {
        };

        this.getCPM = function() {
            // The USB dongle always streams
        };
        
        this.devicetag = function() {
            // The Onyx live view calls this method
        };

        this.version = function() {
                self.socket.emit('controllerCommand', 'v:');
        };

        this.dump_settings = function() {
                self.socket.emit('controllerCommand', 'p:');
        };

        this.cpm_output = function(enable) {
                self.socket.emit('controllerCommand', 'M:' + (enable ? '1' : '0') );
        };

        this.pulse_enable = function(enable) {
                self.socket.emit('controllerCommand', 'P:' + (enable ? '1' : '0') );
        };
        this.count_enable = function(enable) {
                self.socket.emit('controllerCommand', 'T:' + (enable ? '1' : '0') );
        };

        console.log('Started USB Geiger link manager front end driver..');
    }

});