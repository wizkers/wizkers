/**
 *
 * Rigctld emulation for Ham radio software
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
            return ['transceiver'];
        }
        
        // We want all data, override the "When to send it" tab
        this.requestAllData = function() {
            return true;
        }

        
        // We do not enforce a strict number of fields.
        this.outputFields = function() {
            return "none";
        }
    };

    _.extend(Rest.prototype, Backbone.Events);
    
    return Rest;

});