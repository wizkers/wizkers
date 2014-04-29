// The main screen of our app.
// 
// Our model is the settings object.
//
// (c) 2014 Edouard Lafargue, ed@lafargue.name
//

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        tpl     = require('text!tpl/instruments/FCOledNumView.html'),
        template = null;
                
        try {
            template =  _.template(tpl);
            console.log("Loaded direct template");
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            try {
                console.log("Trying compiled template");
                template = require('js/tpl/FCOledNumView.js', function(){} , function(err) {
                            console.log("Preloading error callback from header.js");
                        });
            } catch (e) {
            console.log(e);
            }
        }
    
    return Backbone.View.extend({

        initialize:function (options) {
            this.settings = this.model;

            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;

            linkManager.on('input', this.showInput, this);

        },

        events: {
            "click #screen": "clickScreen",
            "click #refresh-btn": "clickRefresh",
            "click #raz": "clickRaz",
            "click #alarm-btn": "clickAlarm",
        },

        clickScreen: function(event) {
            var screen = event.target.innerHTML;
            if (screen != undefined) {
                linkManager.driver.screen(screen);
            }
        },

        clickRefresh: function(event) {
            var rate = $("#refresh",this.el).val();
            if (rate < 150) {
                rate = 150;
                $("#refresh",this.el).val(150)
            }
            linkManager.driver.rate(rate);
        },

        clickAlarm: function(event) {
            var rate = $("#alarm",this.el).val();
            if (alarm > 2000) {
                rate = 2000;
                $("#alarm",this.el).val(2000)
            }
            linkManager.driver.alarm(rate);
        },


        clickRaz: function() {
            linkManager.driver.reset();
        },

        render:function () {
            var self = this;
            console.log('Main render of FC Oled Backpack numeric view');
            $(this.el).html(template());
            return this;
        },

        onClose: function() {
            console.log("FC Oled Backpack numeric view closing...");
            linkManager.off('input', this.showInput,this);
        },

        showInput: function(data) {
            if (typeof(data.v) == 'undefined')
                return;
            var v = parseFloat(data.v.avg);
            var a = parseFloat(data.a.avg);
            $('#livev', this.el).html(v.toFixed(3) + "&nbsp;V");
            $('#livea', this.el).html(a.toFixed(3) + "&nbsp;mA");
            $('#mwh',this.el).html(data.mwh);
            $('#mah',this.el).html(data.mah);

            // Update statistics:
            var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
            $('#sessionlength',this.el).html(utils.hms(sessionDuration));

        },


    });
});