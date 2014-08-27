/**
 *
 * Send data to the Safecast API
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone');

    var Safecast = function() {        
        
    };

    _.extend(Safecast.prototype, Backbone.Events);
    
    return Safecast;

});