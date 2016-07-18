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
 * Display output of Geiger counter in numeric format
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/slevel_monitor/NumView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updatestatus, this);
            this.deviceInitDone = false;
        },

        events: {
            "click #qsy": "qsy",
        },

        render: function () {
            var self = this;
            console.log('Main render of S Level numeric view');
            this.$el.html(template());
            return this;
        },

        updatestatus: function(data) {
            if (data.portopen && !this.deviceinitdone) {
            linkManager.driver.getVFO('a');
                this.deviceinitdone = true;
            }
        },

        qsy: function () {
            this.freq = parseFloat($('#vfoa', this.el).val())*1e6;
            this.setVFO(this.freq);
        },

        setVFO: function(f) {
            var freq = ("00000000000" + f).slice(-11); // Nifty, eh ?
            linkManager.sendCommand('FA' + freq + ';FA;');
        },

        onClose: function () {
            console.log("SLevelnumeric view closing...");
            linkManager.off('input', this.showInput, this);
            linkManager.off('status', this.updatestatus, this);
        },

        showInput: function (data) {
            if (data.vfoa) {
                this.$('#vfoa').val(data.vfoa/1e6);
            }
        },
    });
});