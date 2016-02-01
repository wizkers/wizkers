/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * An Elecraft XG3 RF Signal Source
 * This object implements the standard API shared by all instruments
 * objects
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {
    "use strict";
    
    var linkmanager = require('app/instruments/elecraft_xg3/linkmanager');
    
    return  function() {
        // Helper function: get driver capabilites.
        // returns a simple array of capabilities    
        this.getCaps = function() {
            return ["LiveDisplay", "NumDisplay", "DiagDisplay"];
        };

        // This is a Backbone view
        this.getLiveDisplay = function(arg, callback) {
            require(['app/instruments/elecraft_xg3/display_live'], function(view) {
                callback(new view(arg));
            });
        };

        // This is a Backbone view
        this.getNumDisplay = function(arg, callback) {
            require(['app/instruments/elecraft_xg3/display_numeric'], function(view) {
                callback( new view(arg));
            });
        };

        // A diagnostics/device setup screen
        this.getDiagDisplay = function(arg, callback) {
            require(['app/instruments/elecraft_xg3/display_diag'], function(view) {
                callback(new view(arg));
            });
        };

        // This is the front-end driver
        this.getDriver = function(arg) {
            return new linkmanager(arg);
        };
        
        // This is a browser implementation of the backend driver, when we
        // run the app fully in-browser on as a Cordova native app.
        this.getBackendDriver = function(arg, callback) {
            require(['app/instruments/elecraft_xg3/parser'], function(parser) {
                callback(new parser(arg));
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
