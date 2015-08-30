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
 * "Outputs"
 *
 * Holds the settings of the various output plugins that are enabled
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    
    "use strict";
    
    var $   = require('jquery'),
        Backbone = require('backbone');
    
    var Output = Backbone.Model.extend({

            type: null,
            idAttribute: "_id",

            initialize: function () {
                this.validators = {};
                this.validators.name = function (value) {
                    return value.length > 0 ? {isValid: true} : {isValid: false, message: "You must enter a name"};
                };

            },
        
            defaults: {
                instrumentid: 0,                // Instrument for this log (not the instrument's serial number, but the ID in MongoDB)
                name: "REST call",                 // Used for display
                type: "rest",                      // The output type to know what output plugin to load
                comment: "enter your notes here",  // Simple comments
                enabled: false,                    // Whether the plugin is active
                mappings: {},                    // Data fields we want to send
                metadata: {},                      // Freeform metadata
                wantsalldata: false,              // Output requests all data (overrides alarm and frequency settings)
                alarm1: { field: "", comparator: "moreeq", level: 0 },
                alarm2: { field: "", comparator: "less", level: 100 },
                alrmbool: "or",
                frequency: 0,       // Output frequency under normal conditions
                alrmfrequency: 0,  // Output frequency when in alarm condition
                lastsuccess: 0,  // When data was last sent with success
                last: 0,         // When data was last sent
                lastmessage: "", // Reply or error when data was last sent
                
            }
        }),

        Outputs = Backbone.Collection.extend({

            model: Output,
            
            initialize: function() {
            }

        });
    
    return {
        Output: Output,
        Outputs: Outputs
    };
});
