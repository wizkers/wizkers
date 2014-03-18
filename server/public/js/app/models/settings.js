/**
 * Where we define the settings. Note that we always use the
 * localstorage mechanism to store settings locally.
 */

define(function(require) {
    
    "use strict";
    
    var $   = require('jquery'),
        Backbone = require('backbone');
    
    Backbone.LocalStorage = require('localstorage');

    return Backbone.Model.extend({

        localStorage: new Backbone.LocalStorage("org.aerodynes.vizapp.Settings"), // Unique name within your app.

        initialize: function () {
        },

        defaults: {
            serialPort: null,
            timezone: "browser",
            cpmcolor: 0,
            cpmscale: "linear",
            itemsperpage: 10,
            currentInstrument: null,
        }
    });    
    
});
