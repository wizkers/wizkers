/**
 * An Elecraft radio This
 * object implements the standard API shared by all instruments
 * objects:
 */


define(function(require) {
    "use strict";
    
    var linkmanager = require('app/instruments/elecraft/linkmanager');
    
    return  function() {
        // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay", "NumDisplay", "DiagDisplay"];
        };

        // This has to be a Backbone view
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/elecraft/display_live'], function(view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/elecraft/display_numeric'], function(view) {
                callback( new view(arg));
            });
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg) {
            return new ElecraftDiagView(arg);
        };

        // This has to be a link manager
        this.getLinkManager = function(arg) {
            return new linkmanager(arg);
        };

        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function(arg) {
            return null;
        };

        // Render a log (or list of logs) for the device.
        this.getLogView = function(arg) {
            return new ElecraftLogView(arg);
        }

    };
    
});
