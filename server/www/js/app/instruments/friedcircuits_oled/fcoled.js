/**
 * A FriedCirctuits OLED Backpack instrument
 */

define(function(require) {
    "use strict";

    var linkmanager = require('app/instruments/friedcircuits_oled/linkmanager');

    return function() {
    
        // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay",  "NumDisplay", ];
        };

        // This has to be a backbone view
        this.getSettings = function(arg, callback) {
            require(['app/instruments/friedcircuits_oled/settings'], function(view) {
                callback(new view(arg));
            });
        };

        // This has to be a Backbone view
        // This is the full screen live view (not a small widget)
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/friedcircuits_oled/display_live'], function(view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/friedcircuits_oled/display_numeric'], function(view) {
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
        this.getDriver = function(arg) {
            return new linkmanager(arg);
        };
        
        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function(arg, callback) {
            require(['app/instruments/friedcircuits_oled/parser'], function(parser) {
                callback(new parser(arg));
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
            require(['app/instruments/friedcircuits_oled/display_log'], function(view) {
                callback(new view(arg));
            });
        }

    };
});