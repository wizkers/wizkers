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
        var streaming = false;
        var livePoller = null; // Reference to the timer for live streaming


        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.getBackendDriverName = function() {
            return 'onyx';
        }
                
        //////
        // End of standard API
        //////


        // All commands below are fully free and depend on
        // the instrument's capabilities

        this.ping = function() {
                lm.sendCommand('HELLO');
        };

        this.getCPM = function() {
                lm.sendCommand('GETCPM');
        };

        this.getlog = function() {
                lm.sendCommand('LOGPAUSE');
                setTimeout(function() {
                    lm.sendCommand('LOGXFER');
                    // Note: looking @ the firmware, the Onyx does the "log resume"
                    // by itself after transfer (as well as the log pause before, actually);
                },1000);
        };

        this.help = function() {
                lm.sendCommand('HELP');
        };

        this.version = function() {
                lm.sendCommand('{"get": "version"}');
        };

        this.guid = function() {
                lm.sendCommand('{ "get": "guid" }');
        };

        this.logstatus = function() {
            lm.sendCommand('{ "get": "logstatus" }');
        };

        this.devicetag = function() {
                lm.sendCommand('{ "get": "devicetag" }');
        };

        this.setdevicetag = function(tag) {
            console.log('Device tag: ' + tag);
            lm.sendCommand('{ "set": { "devicetag": "' + tag + '"}}');
        };

        this.displaytest = function() {
            lm.sendCommand('DISPLAYTEST');
        };

        this.settime = function() {
                var unixTime = Math.round((new Date()).getTime() / 1000);
                console.log('Unix time: ' + unixTime);
                lm.sendCommand('{ "set": { "rtc": ' + unixTime + ' }}');
        };


        console.log('Started Onyx link manager driver..');
    }

});