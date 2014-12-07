/*
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    "use strict";
    
    var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('tpl/connections/helium');

    return Backbone.View.extend({
        
        initialize: function(options) {
            // Initialize Helium-specific attributes:
            if (this.model.get('helium') == undefined) {
                this.model.set('helium', { mac: '00ff00ff00ff',
                                          token: 'XXXXX==' });
            }
        },

        render:function () {
            $(this.el).html(template(this.model.toJSON()));
            return this;
        }

    });
});