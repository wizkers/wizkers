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
 * A Safecast Onyx instrument
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var driver_frontend = require('app/instruments/powerlog_1/driver_frontend');

    return function () {

        // Helper function: get driver capabilites for display.
        // returns a simple array of capabilities
        this.getCaps = function () {
            return ["LiveDisplay", "NumDisplay", "LogView",
                   "WantReplay"
                   ];
        };

        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function () {
            return ['power', 'temperature'];
        }

        // This has to be a Backbone view
        // This is the full screen live view graph (not a small widget)
        this.getLiveDisplay = function (arg, callback) {
            require(['app/instruments/powerlog_1/display_live'], function (view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function (arg, callback) {
            require(['app/instruments/powerlog_1/display_numeric'], function (view) {
                callback(new view(arg));
            });
        };

        // A smaller widget (just a graph)
        this.getLiveWidget = function (arg, callback) {
            return null;
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function (arg, callback) {
            require(['app/instruments/powerlog_1/display_diag'], function (view) {
                callback(new view(arg));
            });
        };

        // This has to be a link manager
        this.getDriver = function () {
            return new driver_frontend();
        };

        this.getUploader = function () {
            return new uploader_frontend();
        };

        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser or as a Cordova native app.
        this.getBackendDriver = function (arg, callback) {
            require(['app/instruments/powerlog_1/driver_backend'], function (driver) {
                callback(new driver(arg));
            });
        };

        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function (arg, callback) {
            return null;
        };

        // Render a log (or list of logs) for the device.
        this.getLogView = function (arg, callback) {
            require(['app/instruments/powerlog_1/display_log'], function (view) {
                callback(new view(arg));
            });
        }

    };
});