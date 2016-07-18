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
        template = require('js/tpl/instruments/elecraft_siggen/NumView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
        },

        events: {
            "click #cmd_sweep": "freq_sweep",
//            "change #startfreq": "change_start",
//            "change #endfreq": "change_end",
//            "change #step": "change_step"
        },

        render: function () {
            var self = this;
            console.log('Main render of KX3 AN numeric view');
            this.$el.html(template());
            $('#startfreq', this.el).val(14.0);
            $('#endfreq', this.el).val(14.3);
            $('#step', this.el).val(0.1);
            return this;
        },

        freq_sweep: function () {
            if (this.sweeping) {
                // OK, the user wants to cancel the sweep
                this.$('#cmd_sweep').html("Sweep").removeClass('btn-danger');
                  this.$('.disable-sweep').attr('disabled',false);
                  this.sweeping = false;
                  linkManager.driver.tune(false);

            } else {
                this.freq = parseFloat($('#startfreq', this.el).val())*1e6;
                this.freq_max = parseFloat($('#endfreq', this.el).val())*1e6;
                this.step = parseFloat($('#step', this.el).val())*1e6;
                this.sweeping = true;

                this.$('#cmd_sweep').html("Stop").addClass('btn-danger');
                this.$('.disable-sweep').attr('disabled',true);

                // Reset the plot:
                instrumentManager.liveViewRef().plot.clearData();

                this.setVFO(this.freq);
                // Start tuning
                linkManager.driver.tune(true);
            }
        },

        setVFO: function(f) {
            var freq = ("00000000000" + f).slice(-11); // Nifty, eh ?
            linkManager.sendCommand('FA' + freq + ';FA;');
        },

        onClose: function () {
            console.log("KX3 AN numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {
            if (!this.sweeping)
                return;
            var cmd = data.raw.substr(0,2);

            if (cmd == 'MP') {
                console.info('Tuner power:', data);
                return;
            }

            if (cmd == 'FA') {
                this.freq = parseInt(data.raw.substr(2));
                // Now read main display for SWR
                linkManager.sendCommand('DS;');
            } else if (cmd == 'DS') {
                var val = data.raw.substr(2);
                var txt = "";
                for (var i = 0; i < 8; i++) {
                    if (val.charCodeAt(i) & 0x80) // Dot on the left side of the character
                        txt += ".";
                    var val2 = val.charCodeAt(i) & 0x7F;
                    // Do replacements:
                    if (val2 == 0x40)
                        val2 = 0x20;
                    txt += String.fromCharCode(val2);
                }
                var swr = parseFloat(txt.substr(0,txt.length-2)) || 1.0;
                console.info(this.freq, swr);
                instrumentManager.liveViewRef().reading(this.freq,swr);
                if (this.freq < this.freq_max) {
                    this.freq += this.step;
                    this.setVFO(this.freq);
                } else {
                    console.info('Done sweeping');
                    this.sweeping = false;
                    this.$('#cmd_sweep').html("Sweep").removeClass('btn-danger');
                    this.$('.disable-sweep').attr('disabled',false);
                    linkManager.driver.tune(false);
                }
            }
        },
    });
});