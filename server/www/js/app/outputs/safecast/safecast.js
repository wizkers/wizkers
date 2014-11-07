/**
 *
 * Send data to the Safecast API
 *
 * This plugin shall implement the following API
 *
 *  - wantOnly() : either an empty array, or string array of data types the plugin accepts
 *  - outputFields(): returns a list of all data fields the plugin wants/requires/supports
 *
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone');

    var Safecast = function() {
        
        this.wantOnly = function() {
            return [ "radioactivity" ];
        }
        
        this.requestAllData = function() {
            return false;
        }

        this.outputFields = function() {
            return { "radiation": { "name": "Radiation Level", "required": true },
                     "unit"     : { "name": "Unit", "required": true},
                     "latitude" : { "name": "Latitude", "required": true },
                     "longitude": { "name": "Longitude", "required": true },
                     "height"   : { "name": "Height", "required": false},
                     "device_id"   : { "name": "Device Id", "required": false }
                   }
        }
        
    };

    _.extend(Safecast.prototype, Backbone.Events);
    
    return Safecast;

});