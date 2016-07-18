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
 * Display output of power logger in numeric format
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/powerlog_1/NumView.js');


    return Backbone.View.extend({

        initialize: function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            linkManager.on('input', this.showInput, this);
        },

        events: {},

        render: function () {
            var self = this;
            console.log('Main render of Powerlog numeric view');
            this.$el.html(template());
            return this;
        },

        onClose: function () {
            console.log("Powerlog numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {

            // We don't want to do anything on replays, it just
            // eats CPU cycles.
            if (data.replay_ts != undefined)
                return;

            if (typeof (data.power) == 'undefined')
                return;
            var pwr = parseFloat(data.power);
            $('#livepower', this.el).html(pwr.toFixed(0));

            // Update statistics:
            var sessionDuration = (new Date().getTime() - this.sessionStartStamp) / 1000;
            $('#sessionlength', this.el).html(utils.hms(sessionDuration));

            if (pwr > this.maxreading) {
                this.maxreading = pwr;
                $('#maxreading', this.el).html(pwr);
            }
            if (pwr < this.minreading || this.minreading == -1) {
                this.minreading = pwr;
                $('#minreading', this.el).html(pwr);
            }

        },


    });
});