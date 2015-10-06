/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * A Safecast Blue Onyx instrument. Only works on Chrome apps on
 * Chromebooks, and eventually on Cordova too...
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var driver_frontend = require('app/instruments/onyx/driver_frontend');
    var uploader_frontend = require('app/instruments/onyx/uploader_frontend');

    return function () {

        // Helper function: get driver capabilites for display.
        // returns a simple array of capabilities    
        this.getCaps = function () {
            return ["LiveDisplay", "NumDisplay", "LogView",
                    "LogManagementView"
                   ];
        };

        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function () {
            return ["radioactivity"];
        }

        // This has to be a backbone view
        this.getSettings = function (arg, callback) {
            require(['app/instruments/onyx/settings'], function (view) {
                callback(new view(arg));
            });
        };

        // This has to be a Backbone view
        // This is the full screen live view graph (not a small widget)
        this.getLiveDisplay = function (arg, callback) {
            require(['app/instruments/blue_onyx/display_live'], function (view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function (arg, callback) {
            require(['app/instruments/blue_onyx/display_numeric'], function (view) {
                callback(new view(arg));
            });
        };

        // A smaller widget (just a graph)
        this.getLiveWidget = function (arg, callback) {
            return null;
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function (arg, callback) {
            require(['app/instruments/onyx/display_diag'], function (view) {
                callback(new view(arg));
            });
        };

        // This has to be a link manager
        this.getDriver = function () {
            return new driver_frontend();
        };

        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser or as a Cordova native app.
        this.getBackendDriver = function (arg, callback) {
            require(['app/instruments/blue_onyx/driver_backend'], function (driver) {
                callback(new driver(arg));
            });
        };

        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function (arg, callback) {
            return null;
        };

        // Return a device log management view
        this.getLogManagementView = function (arg, callback) {
            require(['app/instruments/onyx/display_logmanager'], function (view) {
                callback(new view(arg));
            });
        }

        // Render a log (or list of logs) for the device.
        this.getLogView = function (arg, callback) {
            require(['app/instruments/onyx/display_log'], function (view) {
                callback(new view(arg));
            });
        }

        // Render a log edit table for a log collection for the device
        this.getLogEditView = function (arg, callback) {
            require(['app/instruments/onyx/display_logedit'], function (view) {
                callback(new view(arg));
            });
        }
    };
});