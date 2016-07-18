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
 * Controls for Sigma25
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/sigma25/Sigma25NumView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
        },

        events: {
        },

        render: function () {
            var self = this;
            console.log('Main render of Sigma25 numeric view');
            this.$el.html(template());
            return this;
        },

        onClose: function () {
            console.log("Sigma25 numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {
            if (data.channels)
                return;

            if (data.gain != undefined) {
                $('#gain', this.el).val(parseInt(data.gain,10));
                linkManager.sendCommand('b');  // Bias
            } else
            if (data.serial != undefined) {
                $('#serial', this.el).val(data.serial);
                linkManager.sendCommand('l');  // LLD Channel
            } else
            if (data.lld_channel != undefined) {
                $('#lld_channel', this.el).val(data.lld_channel);
                linkManager.startLiveStream(this.model.get('liveviewperiod'));
            } else
            if (data.bias != undefined) {
                $('#bias', this.el).val(data.bias);
                linkManager.sendCommand('n');  // Serial number
            }

        },


    });
});