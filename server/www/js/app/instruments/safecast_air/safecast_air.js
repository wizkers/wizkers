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
 * A Safecast Air - aka bGassy - instrument, over a Bluetooth link (only Chrome and
 * Cordova mode for the moment)
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var driver_frontend = require('app/instruments/onyx/driver_frontend');

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
            return ['LiveDisplay', 'NumDisplay', 'LogView', 'WizkersSettings',
                    'WantReplay'
                   ];
        };

        // Return the type of data reading that this instrument generates. Can be used
        // by output plugins to accept data from this instrument or not.
        this.getDataType = function () {
            return ["gas"];
        }

        // This has to be a Backbone view
        // This is the full screen live view graph (not a small widget)
        this.getLiveDisplay = function (arg, callback) {
            require(['app/instruments/safecast_air/display_live'], function (view) {
                current_liveview = new view(arg);
                callback(current_liveview);
            });
        };

        // This is a Backbone view
        // This is a numeric display
        this.getNumDisplay = function (arg, callback) {
            require(['app/instruments/safecast_air/display_numeric'], function (view) {
                current_numview = new view(arg);
                callback(current_numview);
            });
        };

        // A smaller widget (just a graph)
        this.getLiveWidget = function (arg, callback) {
            return null;
        };

        // This has to be a link manager
        this.getDriver = function () {
            return new driver_frontend();
        };
        
        /**
         * This is the upgrader view
         */
        this.getUpgrader = function (arg, callback) {
            require(['app/instruments/bluegiga/upgrader'], function (view) {
                callback(new view(arg));
            });
        };


        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser or as a Cordova native app.
        this.getBackendDriver = function (arg, callback) {
            require(['app/instruments/safecast_air/driver_backend'], function (driver) {
                callback(new driver(arg));
            });
        };
        
        // Return a Backbone view which is a mini graph
        this.getMiniLogview = function (arg, callback) {
            return null;
        };

        // Render a log (or list of logs) for the device.
        this.getLogView = function (arg, callback) {
            require(['app/instruments/safecast_air/display_log'], function (view) {
                callback(new view(arg));
            });
        }

        // The screen for the "Settings" top level menu. This covers settings
        // for the Wizkers app, not the instrument itself (those are done on the DiagDisplay
        // screen).
        this.getWizkersSettings = function(arg, callback) {
            require(['app/instruments/safecast_air/settings_wizkers'], function(view) {
                callback(new view(arg));
            });
        };

    };
});