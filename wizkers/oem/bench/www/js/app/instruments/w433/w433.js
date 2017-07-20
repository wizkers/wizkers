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
 * An  W433 custom weather receiver This
 * object implements a standard API shared by all instruments
 * objects
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {
    "use strict";

    // Convenient function when views want to talk to each other: keep a central
    // reference to those here
    var current_liveview = null;
    var current_numview = null;

    return function() {



        this.liveViewRef = function () {
            return current_liveview;
        };

        this.numViewRef = function () {
            return current_numview;
        };

        // Helper function: get driver capabilites.
        // returns a simple array of capabilities
        this.getCaps = function() {
            return ["LiveDisplay", "NumDisplay", "LogView"];
        };

        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function() {
                    return [ "temperature", "humidity", "rainfall", "wind" ];
        }

        // This has to be a Backbone view
        // This is the full screen live view graph (not a small widget)
        this.getLiveDisplay = function (arg, callback) {
            require(['app/instruments/w433/display_live'], function (view) {
                current_liveview = new view(arg);
                callback(current_liveview);
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function (arg, callback) {
            require(['app/instruments/w433/display_numeric'], function (view) {
                current_numview = new view(arg);
                callback(current_numview);
            });
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg, callback) {
            return null;
        };

        // The browser-side instrument driver
        // This is the front-end driver
        this.getDriver = function(callback) {
             require(['app/instruments/w433/driver_frontend'], function(d) {
                callback(new d());
             });
        }

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