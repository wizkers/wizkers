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
 * A utility to control a Lander Cairn XL "smart" lamp. Can be used for building
 * a new app with a nicer GUI
 *
 * @author Edouard Lafargue, ed@wizkers.io
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
            return ["lighting"];
        }

        // This has to be a Backbone view
        // This is the full screen live view graph (not a small widget)
        this.getLiveDisplay = function (arg, callback) {
            require(['app/instruments/cairnxl/display_live'], function (view) {
                current_liveview = new view(arg);
                callback(current_liveview);
            });
        };

        // A smaller widget (just a graph)
        this.getLiveWidget = function (arg, callback) {
            return null;
        };

        // This is the front-end driver
        this.getDriver = function(callback) {
             require(['app/instruments/cairnxl/driver_frontend'], function(d) {
                callback(new d());
             });
        };

        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser or as a Cordova native app.
        this.getBackendDriver = function (arg, callback) {
            this.getBackendDriverFor('cairnxl', arg, callback);
        };

    };
});