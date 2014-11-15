/**
 * "instruments" 
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var $   = require('jquery'),
        Backbone = require('backbone'),
        Devicelog = require('app/models/devicelog'),
        Output = require('app/models/output');

    if (vizapp.type == "cordova" || vizapp.type == "chrome") {
        Backbone.LocalStorage = require('localstorage');
    }
    
        var logs_database = {
        id: "wizkers-logs",
        description: "Wizkers device logs",
        migrations: [{
            version: 1,
            migrate: function (transaction, next) {
                var store = transaction.db.createObjectStore("logs");
                store = transaction.db.createObjectStore("entries");
                next();
            }
        }]
    };

    
    var Instrument = Backbone.Model.extend({

            type: null,
            idAttribute: "_id",

            initialize: function () {
                this.validators = {};
                this.validators.name = function (value) {
                    return value.length > 0 ? {isValid: true} : {isValid: false, message: "You must enter a name"};
                };
                
                // Create a reference to my logs and my outputs (outputs are
                // output plugins defined to send data to other systems)
                this.logs = new Devicelog.Logs();
                this.outputs = new Output.Outputs();

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
                }

                this.updateChildrenURL();
                // When we create a model, this.id is undefined: because of this, we listen to
                // the "sync" event, and update the entries' URL upon it (sync is fired when the model is
                // saved, therefore the ID is updated
                this.listenTo(this, "sync", this.updateChildrenURL);
                
                // Make sure that whenever we add an output or a log to the Instrument, we
                // set its instrumentid reference
                this.listenTo(this.outputs, "add", this.setInstrumentId);
                this.listenTo(this.logs, "add", this.setInstrumentId);
               
            },
        
            setInstrumentId: function(model) {
                model.set("instrumentid", this.id);
            },
        
            updateChildrenURL: function() {
                /**
                 * Depending on runmode, we are either defining a URL or
                 * relying on backbone localstorage
                 */
                console.log("[Instrument.js] The ID for this instrument is " + this.id);
                
                if (vizapp.type == "cordova") {
                    this.logs.localStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Logs-" + this.id);
                    this.outputs.localStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Outputs-" + this.id);
                } else if (vizapp.type == "chrome") {
                    this.outputs.chromeStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Outputs-" + this.id);
                    //this.logs.chromeStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Logs-" + this.id);
                    this.logs.database = logs_database;
                    this.logs.storeName = "logs";
                    // Also set the instrumentid property of the logs
                    if (this.id != undefined) 
                        this.logs.instrumentid = this.id;
                } else {
                    this.logs.url = "/instruments/" + this.id + "/logs/";
                    this.outputs.url = "/instruments/" + this.id + "/outputs/";
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
