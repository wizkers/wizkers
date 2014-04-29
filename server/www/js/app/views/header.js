
define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/HeaderView.html'),
        template = null;
                
        try {
            template =  _.template(tpl);
            console.log("Loaded direct template");
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            try {
                console.log("Trying compiled template");
                template = require('js/tpl/HeaderView.js', function(){} , function(err) {
                            console.log("Preloading error callback from header.js");
                        });
            } catch (e) {
            console.log(e);
            }
        }

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