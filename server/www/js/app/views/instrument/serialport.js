/*
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    "use strict";
    
    var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('tpl/connections/serialport');

    return Backbone.View.extend({
        
        initialize: function(options) {
            console.log(options);
            this.ports = options.ports;
        },

        render:function () {
            $(this.el).html(template(_.extend(this.model.toJSON(), {ports: this.ports})));
            return this;
        }

    });
});