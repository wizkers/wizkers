/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 * The main screen of our app.
 *
 * Our model is the settings object.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";

    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        template = require('js/tpl/instruments/fcoled/FCOledNumView.js');

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
            this.$el.html(template());
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