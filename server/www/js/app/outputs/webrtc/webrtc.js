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
 * Send data through a WebRTC connection.
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

    var WebRTC = function() {
        
        this.wantOnly = function() {
            return [];
        }
        
        this.requestAllData = function() {
            return true;
        }
        
        // We do not support the concept of configurable output fields
        // with this plugin.
        this.outputFields = function() {
            return "none";
        }
    };

    _.extend(WebRTC.prototype, Backbone.Events);
    
    return WebRTC;

});