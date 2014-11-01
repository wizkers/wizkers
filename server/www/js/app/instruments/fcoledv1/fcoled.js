/**
 * A FriedCirctuits OLED Backpack instrument
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";

    var driver_frontend = require('app/instruments/fcoledv1/driver_frontend');

    return function() {
    
        // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay",  "NumDisplay", ];
        };
                    
        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function() {
                    return [ "voltage", "current", "power", "energy" ];
        }


        // This has to be a backbone view
        this.getSettings = function(arg, callback) {
            require(['app/instruments/fcoledv1/settings'], function(view) {
                callback(new view(arg));
            });
        };

        // This has to be a Backbone view
        // This is the full screen live view (not a small widget)
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/fcoledv1/display_live'], function(view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/fcoledv1/display_numeric'], function(view) {
                callback(new view(arg));
            });
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg, callback) {
            return null;
        };

        // A smaller widget (just a graph)
        this.getLiveWidget = function(arg, callback) {
            return null;
        };

        // The instrument driver (browser-side)
        this.getDriver = function() {
            return new driver_frontend();
        };
        
        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function(arg, callback) {
            require(['app/instruments/fcoledv1/driver_backend'], function(driver) {
                callback(new driver(arg));
            });
        };

        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function(arg) {
            return null;
        };

        // Return a device log management view
        this.getLogManagementView = function(arg) {
            return null;
        }

        // Render a log (or list of logs) for the device.
        this.getLogView = function(arg, callback) {
            require(['app/instruments/fcoledv1/display_log'], function(view) {
                callback(new view(arg));
            });
        }

    };
});