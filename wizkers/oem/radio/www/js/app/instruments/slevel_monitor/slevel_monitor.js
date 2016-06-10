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
