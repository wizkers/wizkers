/**
 * An Elecraft XG3 RF Signal Source
 * This object implements the standard API shared by all instruments
 * objects
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    "use strict";
    
    var linkmanager = require('app/instruments/elecraft_xg3/linkmanager');
    
    return  function() {
        // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay", "NumDisplay", "DiagDisplay"];
        };

        // This is a Backbone view
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/elecraft_xg3/display_live'], function(view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/elecraft_xg3/display_numeric'], function(view) {
                callback( new view(arg));
            });
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg, callback) {
            require(['app/instruments/elecraft_xg3/display_diag'], function(view) {
                callback(new view(arg));
            });
        };

        // This is the front-end driver
        this.getDriver = function(arg) {
            return new linkmanager(arg);
        };
        
        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function(arg, callback) {
            require(['app/instruments/elecraft_xg3/parser'], function(parser) {
                callback(new parser(arg));
            });
        };

        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function(arg) {
            return null;
        };

        // Render a log (or list of logs) for the device.
        this.getLogView = function(arg) {
            return null;
        }

    };
    
});
