
define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/HeaderView.html'),
        
        template = _.template(tpl);

    return Backbone.View.extend({

        initialize: function () {
            this.render();
        },

        render: function () {
            $(this.el).html(template());
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