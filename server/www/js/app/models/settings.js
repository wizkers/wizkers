/**
 * Where we define the settings. Note that we always use the
 * localstorage mechanism to store settings locally.
 */

define(function(require) {
    
    "use strict";
    
    var $   = require('jquery'),
        Backbone = require('backbone');
    
        // Backbone.LocalStorage = require('localstorage');

    return Backbone.Model.extend({


        initialize: function () {
            if (vizapp.type == "chrome") {
                    this.chromeStorage =  new Backbone.LocalStorage("org.aerodynes.vizapp.Settings");
            } else if (vizapp.type == "cordova") {
                this.localStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.Settings");
            } else {
                this.url = "/settings";
            }
        },

        defaults: {
            serialPort: null,
            timezone: "browser",
            cpmcolor: 0,
            cpmscale: "linear",
            itemsperpage: 10,
            currentInstrument: null,
            token: null,
        }
    });    
    
});
