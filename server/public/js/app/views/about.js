/**
 * A simple "About" static page for the application
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 */
define(function(require) {
    
    "use strict";
    
    var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/AboutView.html'),
        
        template = _.template(tpl);

    return Backbone.View.extend({

        initialize:function () {
            this.render();
        },

        render:function () {
            $(this.el).html(template());
            return this;
        }

    });
});