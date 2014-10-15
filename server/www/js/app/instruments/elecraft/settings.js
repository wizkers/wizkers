/*
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    "use strict";
    
     var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/ElecraftSettingsView.js');

    return Backbone.View.extend({

        render:function () {
            $(this.el).html(template());
            return this;
        }

    });
});