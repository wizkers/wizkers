/**
 * "instruments" 
 *
 */

define(function(require) {
    
    "use strict";
    
    var $   = require('jquery'),
        Backbone = require('backbone'),
        Devicelog = require('app/models/devicelog');

    if (vizapp.type == "cordova" || vizapp.type == "chrome") {
        Backbone.LocalStorage = require('localstorage');
    }
    
    var Instrument = Backbone.Model.extend({

            type: null,
            idAttribute: "_id",

            initialize: function () {
                this.validators = {};
                this.validators.name = function (value) {
                    return value.length > 0 ? {isValid: true} : {isValid: false, message: "You must enter a name"};
                };
                
                // Create a reference to my logs:
                this.logs = new Devicelog.Logs();

                /**
                 * Depending on runmode, we are either defining a URL or
                 * relying on backbone localstorage
                 */
                if (vizapp.type == "cordova") {
                    this.localStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Instrument"); // Unique name within your app.
                } else if (vizapp.type == "chrome") {
                    this.chromeStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Instrument");
                } else {
                    this.urlRoot = "/instruments";
                    this.logs.url = "/instruments/" + this.id + "/logs";
                }

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
                name: "Friendly name",             // Used for display
                type: "onyx",                      // Corresponds to parsers known on the server side as well
                tag: "",                           // Asset tag for the instrument (if supported)
                uuid: "",                          // Serial number or unique ID (if supported)
                port: "/dev/tty.usb1234",          // Name of the port on server side
                comment: "enter your notes here",  // Simple comments
                icon: "",                          // TbD: either user-selectable, or served by server-side (linked to type)
                liveviewspan: 600,                 // Width of live view in seconds
                liveviewperiod: 1,                 // Period of polling if supported
                liveviewlogscale: false,           // Should live view display as a log scale by default ?
                metadata: {},                      // Freeform metadata
            }
        }),

        InstrumentCollection = Backbone.Collection.extend({

            model: Instrument,
            
            initialize: function() {
                if (vizapp.type == "cordova") {
                    this.localStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Instrument"); // Unique name within your app.
                } else if (vizapp.type =="chrome") {
                    this.chromeStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Instrument"); // Unique name within your app.
                } else {
                    this.url = "/instruments";
                }
            }

        });
    
    return {
        Instrument: Instrument,
        InstrumentCollection: InstrumentCollection
    };
});
