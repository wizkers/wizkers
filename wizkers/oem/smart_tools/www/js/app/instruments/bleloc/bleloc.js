/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
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
 * BLE Locator PoC. Listens to a bunch of locator clients (RPi 0W) and
 * for each MAC, see which station the MAC is closest to.
 *
 */
define(function (require) {
    "use strict";

    // Convenient function when views want to talk to each other: keep a central
    // reference to those here
    var current_liveview = null;
    var current_numview = null;


    return function () {

        this.liveViewRef = function () {
            return current_liveview;
        };

        this.numViewRef = function () {
            return current_numview;
        };

        // Helper function: get driver capabilites for display.
        // returns a simple array of capabilities
        this.getCaps = function () {
            return ['LiveDisplay'
                   ];
        };

        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function () {
            return ["ble"];
        }

        // This has to be a Backbone view
        // This is the full screen live view graph (not a small widget)
        this.getLiveDisplay = function (arg, callback) {
            require(['app/instruments/bleloc/display_live'], function (view) {
                current_liveview = new view(arg);
                callback(current_liveview);
            });
        };

        // This is the numeric display
        this.getNumDisplay = function (arg, callback) {
            require(['app/instruments/bleloc/display_numeric'], function (view) {
                current_numview = new view(arg);
                callback(current_numview);
            });
        };

        // This is the front-end driver
        this.getDriver = function(callback) {
             require(['app/instruments/bleloc/driver_frontend'], function(d) {
                callback(new d());
             });
        };

        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser or as a Cordova native app.
        this.getBackendDriver = function (arg, callback) {
            this.getBackendDriverFor('bleloc', arg, callback);
        };

        // Render a log (or list of logs) for the device.
        this.getLogView = function (arg, callback) {
            require(['app/instruments/bleloc/display_log'], function (view) {
                callback(new view(arg));
            });
        }

        // The screen for the "Settings" top level menu. This covers settings
        // for the Wizkers app, not the instrument itself (those are done on the DiagDisplay
        // screen).
        this.getWizkersSettings = function(arg, callback) {
            require(['app/instruments/bleloc/settings_wizkers'], function(view) {
                callback(new view(arg));
            });
        };

    };
});