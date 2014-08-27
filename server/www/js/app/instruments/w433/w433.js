/**
 * An  W433 custom weather receiver This
 * object implements a standard API shared by all instruments
 * objects
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    "use strict";
    
    var driver_frontend = require('app/instruments/w433/driver_frontend');
    
    return function() {

        // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay", "NumDisplay", "LogView"];
        };

        // This has to be a Backbone view
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/w433/display_live'], function(view) {
                callback(new view(arg));
            });
        };

            // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/w433/display_numeric'], function(view) {
                callback(new view(arg));
            });
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg, callback) {
            return null;
        };

        // The browser-side instrument driver
        this.getDriver = function(arg) {
            return new driver_frontend(arg);
        };

        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function(arg, callback) {
            return null;
        };

        // Render a log (or list of logs) for the device.
        this.getLogView = function(arg, callback) {
            require(['app/instruments/w433/display_log'], function(view) {
                callback(new view(arg));
            });
        }

    };

});