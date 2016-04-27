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
 * Rigctld emulation for Ham radio software
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
    
    var Rigctld = {
        
        wantOnly: function() {
            return ['transceiver'];
        },
        
        // We want all data, override the "When to send it" tab
        requestAllData: function() {
            return true;
        },
        
        // We do not enforce a strict number of fields.
        outputFields: function() {
            return 'none';
        }
    };

    return Rigctld;

});