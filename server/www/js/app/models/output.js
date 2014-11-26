/**
 * "Outputs"
 *
 * Holds the settings of the various output plugins that are enabled
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var $   = require('jquery'),
        Backbone = require('backbone');

    if (vizapp.type == "cordova" || vizapp.type == "chrome") {
        require(['localstorage'], function(loc) {
            Backbone.LocalStorage = loc; });
    }
    
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
