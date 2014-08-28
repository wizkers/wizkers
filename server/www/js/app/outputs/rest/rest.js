/**
 *
 * Send data through RESTful calls
 *
 * This plugin shall implement the following API
 *
 *  - wantOnly() : either an empty array, or string array of data types the plugin accepts
 *
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone');

    var Rest = function() {
        
        this.wantOnly = function() {
            return [];
        }
        
    };

    _.extend(Rest.prototype, Backbone.Events);
    
    return Rest;

});