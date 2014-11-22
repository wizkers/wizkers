/**
 * A Medcom USB Geiger instrument
 *
 * This shares a lot with the Onyx visualization plugin, in a way it is
 * a "child" plugin.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";
    
    var driver_frontend = require('app/instruments/usbgeiger/driver_frontend');
    var uploader_frontend = require('app/instruments/usbgeiger/uploader_frontend');
    
    return  function() {

        // Helper function: get driver capabilites for display.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay", "NumDisplay", "DiagDisplay", "LogView",
                    "LogManagementView", "Upgrader"
                   ];
        };
        
        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function() {
                    return [ "radioactivity" ];
        }
        
        this.getUpgrader = function(arg,callback) {
            require(['app/instruments/usbgeiger/upgrader'], function(view) {
                callback(new view(arg));
            });
        };

        // This has to be a backbone view
        this.getSettings = function(arg, callback) {
            require(['app/instruments/usbgeiger/settings'], function(view) {
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
            require(['app/instruments/usbgeiger/display_numeric'], function(view) {
                callback(new view(arg));
            });
        };

        // A smaller widget (just a graph)
        this.getLiveWidget = function(arg, callback) {
            return null;
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg, callback) {
            require(['app/instruments/usbgeiger/display_diag'], function(view) {
                callback(new view(arg));
            });
        };

        // This has to be a link manager
        this.getDriver = function() {
            return new driver_frontend();
        };
        
        this.getUploader = function() {
            return new uploader_frontend();
        };
        
        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function(arg, callback) {
            require(['app/instruments/usbgeiger/driver_backend'], function(driver) {
                callback(new driver(arg));
            });
        };

        this.getBackendUploaderDriver = function(arg, callback) {
            require(['app/instruments/usbgeiger/uploader_backend'], function(driver) {
                callback(new driver(arg));
            });
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