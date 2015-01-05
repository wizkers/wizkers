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
 *
 * Send data through RESTful calls
 *
 * This plugin shall implement the following API
 *
 *  - wantOnly() : either an empty array, or string array of data types the plugin accepts
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone');

    var Rest = function() {
        
        this.wantOnly = function() {
            return [];
        }
        
        this.requestAllData = function() {
            return false;
        }
        
        // We do not enforce a strict number of fields.
        this.outputFields = function() {
            return "variable";
            /*
            return { "field1": { "name": "Field 1", "required": true },
                     "field2" : { "name": "Field 2", "required": false},
                     "field3" : { "name": "Field 3", "required": false },
                     "field4" : { "name": "Field 4", "required": false },
                     "field5" : { "name": "Field 5", "required": false },
                     "field6" : { "name": "Field 6", "required": false },
                   }
             */
        }
    };

    _.extend(Rest.prototype, Backbone.Events);
    
    return Rest;

});