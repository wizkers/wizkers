/**
 * An Elecraft radio This
 * object implements the standard API shared by all instruments
 * objects
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    "use strict";
    
    var frontend_driver = require('app/instruments/elecraft/driver_frontend');
    
    return  function() {
        // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay", "NumDisplay", "DiagDisplay"];
        };
        
        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function() {
                    return [ "amateur radio" ];
        }


        // This is a Backbone view
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/elecraft/display_live'], function(view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/elecraft/display_numeric'], function(view) {
                callback( new view(arg));
            });
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg, callback) {
            require(['app/instruments/elecraft/display_diag'], function(view) {
                callback(new view(arg));
            });
        };

        // This is the front-end driver
        this.getDriver = function(arg) {
            return new frontend_driver(arg);
        };
        
        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function(arg, callback) {
            require(['app/instruments/elecraft/driver_backend'], function(driver) {
                callback(new driver(arg));
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
