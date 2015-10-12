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
 * A FriedCirctuits OLED Backpack instrument
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var driver_frontend = require('app/instruments/fcoledv1/driver_frontend');
    var uploader_frontend = require('app/instruments/usbgeiger/uploader_frontend');

    return function () {

        // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function () {
            return ["LiveDisplay", "NumDisplay", "LogView", "Upgrader", "WantReplay"];
        };

        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function () {
            return ["voltage", "current", "power", "energy"];
        }

        this.getUpgrader = function (arg, callback) {
            require(['app/instruments/fcoledv1/upgrader'], function (view) {
                callback(new view(arg));
            });
        };

        // This has to be a Backbone view
        // This is the full screen live view (not a small widget)
        this.getLiveDisplay = function (arg, callback) {
            require(['app/instruments/fcoledv1/display_live'], function (view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function (arg, callback) {
            require(['app/instruments/fcoledv1/display_numeric'], function (view) {
                callback(new view(arg));
            });
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function (arg, callback) {
            return null;
        };

        // A smaller widget (just a graph)
        this.getLiveWidget = function (arg, callback) {
            return null;
        };

        // The instrument driver (browser-side)
        this.getDriver = function () {
            return new driver_frontend();
        };

        this.getUploader = function () {
            return new uploader_frontend();
        };

        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function (arg, callback) {
            require(['app/instruments/fcoledv1/driver_backend'], function (driver) {
                callback(new driver(arg));
            });
        };

        this.getBackendUploaderDriver = function (arg, callback) {
            require(['app/instruments/usbgeiger/uploader_backend'], function (driver) {
                callback(new driver(arg));
            });
        };

        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function (arg) {
            return null;
        };

        // Return a device log management view
        this.getLogManagementView = function (arg) {
            return null;
        }

        // Render a log (or list of logs) for the device.
        this.getLogView = function (arg, callback) {
            require(['app/instruments/fcoledv1/display_log'], function (view) {
                callback(new view(arg));
            });
        }

    };
});