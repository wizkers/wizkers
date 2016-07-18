/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * An Elecraft radio This
 * object implements the standard API shared by all instruments
 * objects
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {
    'use strict';

    return  function() {
        // Helper function: get driver capabilites.
        // returns a simple array of capabilities
        this.getCaps = function() {
            return ['LiveDisplay', 'NumDisplay'];
        };

        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function() {
                    return [ 'transceiver' ];
        }


        // This is a Backbone view
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/yaesu_ft857/display_live'], function(view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/yaesu_817nd/display_numeric'], function(view) {
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
        this.getDriver = function(callback) {
             require(['app/instruments/yaesu_817nd/driver_frontend'], function(d) {
                callback(new d());
             });
        };

        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function(arg, callback) {
            require(['app/instruments/yaesu_817nd/driver_backend'], function(driver) {
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
