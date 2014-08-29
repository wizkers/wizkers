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
        Backbone.LocalStorage = require('localstorage');
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
        
            validateItem: function (key) {
                return (this.validators[key]) ? this.validators[key](this.get(key)) : {isValid: true};
            },

            // TODO: Implement Backbone's standard validate() method instead.
            validateAll: function () {

                var messages = {};

                for (var key in this.validators) {
                    if(this.validators.hasOwnProperty(key)) {
                        var check = this.validators[key](this.get(key));
                        if (check.isValid === false) {
                            messages[key] = check.message;
                        }
                    }
                }

                return _.size(messages) > 0 ? {isValid: false, messages: messages} : {isValid: true};
            },    

            defaults: {
                instrumentid: 0,                // Instrument for this log (not the instrument's serial number, but the ID in MongoDB)
                name: "REST call",                 // Used for display
                type: "rest",                      // The output type to know what output plugin to load
                comment: "enter your notes here",  // Simple comments
                enabled: false,                    // Whether the plugin is active
                datafields: [],                    // Data fields we want to send
                metadata: {},                      // Freeform metadata
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
