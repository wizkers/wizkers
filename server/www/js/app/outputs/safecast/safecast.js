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
 *
 * Send data to the Safecast API
 *
 * This plugin shall implement the following API
 *
 *  - wantOnly() : either an empty array, or string array of data types the plugin accepts
 *  - outputFields(): returns a list of all data fields the plugin wants/requires/supports
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone');

    var Safecast = function() {
        
        this.wantOnly = function() {
            return [ "radioactivity" ];
        }
        
        this.requestAllData = function() {
            return false;
        }

        this.outputFields = function() {
            return { "radiation": { "name": "Radiation Level", "required": true },
                     "unit"     : { "name": "Unit", "required": true},
                     "latitude" : { "name": "Latitude", "required": true },
                     "longitude": { "name": "Longitude", "required": true },
                     "height"   : { "name": "Height", "required": false},
                     "device_id"   : { "name": "Device Id", "required": false }
                   }
        }
        
    };

    _.extend(Safecast.prototype, Backbone.Events);
    
    return Safecast;

});