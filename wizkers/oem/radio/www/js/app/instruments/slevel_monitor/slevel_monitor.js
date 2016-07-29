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
 * Graph S-Level on a frequency for a long time.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {
    'use strict';

    var frontend_driver = require('app/instruments/elecraft/driver_frontend');

    return  function() {

        var current_liveview = null;
        var current_numview = null;


        this.liveViewRef = function() {
            return current_liveview;
        };

        this.numViewRef = function() {
            return current_numview;
        };

        // Helper function: get driver capabilites.
        // returns a simple array of capabilities
        this.getCaps = function() {
            return ['LiveDisplay', 'NumDisplay', 'Recording'];
        };

        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function() {
                    return [ '' ];
        }


        // This is a Backbone view
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/slevel_monitor/display_live'], function(view) {
                current_liveview = new view(arg);
                callback(current_liveview);
            });
        };

        // This is a Backbone view
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/slevel_monitor/display_numeric'], function(view) {
                current_numview = new view(arg);
                callback(current_numview);
            });
        };

        // This is the front-end driver
        this.getDriver = function(callback) {
            // This is a meta instrument: depending on the settings, we will create
            // different kinds of drivers;
            var it = instrumentManager.getInstrument().get('radio_type');
            // CAREFUL: we are relying on the consistent naming conventions
            // in our drivers, in particular 'driver_frontend' and 'driver_backend'
             require(['app/instruments/' + it + '/driver_frontend'], function(d) {
                callback(new d());
             });
        };

        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function(arg, callback) {
            // See comment on getDriver above
            var it = instrumentManager.getInstrument().get('radio_type');
            require(['app/instruments/' + it + '/driver_backend'], function(driver) {
                callback(new driver(arg));
            });
        };

        // Render a log (or list of logs) for the device.
        this.getLogView = function(arg) {
            return null;
        }
    };

});