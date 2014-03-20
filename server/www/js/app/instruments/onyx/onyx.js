/**
 * A Safecast Onyx instrument
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";
    
    var linkmanager = require('app/instruments/onyx/linkmanager');
    
    return  function() {

            // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay", "NumDisplay", "DiagDisplay", "LogView",
                    "LogManagementView",
                   ];
        };

        // This has to be a backbone view
        this.getSettings = function(arg, callback) {
            require(['app/instruments/onyx/settings'], function(view) {
                callback(new view(arg));
            });
        };

        // This has to be a Backbone view
        // This is the full screen live view graph (not a small widget)
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/onyx/display_live'], function(view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/onyx/display_numeric'], function(view) {
                callback(new view(arg));
            });
        };

        // A smaller widget (just a graph)
        this.getLiveWidget = function(arg, callback) {
            return null;
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg, callback) {
            require(['app/instruments/onyx/display_diag'], function(view) {
                callback(new view(arg));
            });
        };

        // This has to be a link manager
        this.getLinkManager = function(arg) {
            return new linkmanager(arg);
        };

        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function(arg, callback) {
            return null;
        };

        // Return a device log management view
        this.getLogManagementView = function(arg, callback) {
            require(['app/instruments/onyx/display_logmanager'], function(view) {
                callback(new view(arg));
            });
        }

        // Render a log (or list of logs) for the device.
        this.getLogView = function(arg, callback) {
            require(['app/instruments/onyx/display_log'], function(view) {
                callback(new view(arg));
            });
        }

        // Render a log edit table for a log collection for the device
        this.getLogEditView = function(arg, callback) {
            require(['app/instruments/onyx/display_logedit'], function(view) {
                callback(new view(arg));
            });
        }
    };
});