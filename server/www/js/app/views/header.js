/*
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/HeaderView.html'),
        template = require('js/tpl/HeaderView.js');

    return Backbone.View.extend({

        initialize: function () {
            this.render();
        },

        render: function () {
            $(this.el).html(template());
            if (vizapp.type == 'server') {
                // If we're running with a backend server, we need to hide some elements
                // in case we are only a 'viewer'. This is not relevant if we're running as an app,
                // since we're always an admin there
                if (settings.get('currentUserRole') == 'viewer') {
                    $('.instrument-menu', this.el).hide();
                    $('.settings-menu', this.el).hide();
                }
            }
            return this;
        },

        selectMenuItem: function (menuItem) {
            $('.nav li').removeClass('active');
            $('.nav .add-option').hide();
            if (menuItem) {
                $('.' + menuItem).addClass('active');
                $('.' + menuItem + '-add').show();
            }
        }
    });
    
});