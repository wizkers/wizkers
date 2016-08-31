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
        template = require('js/tpl/instruments/sark110/Sark110NumView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updatestatus, this);
        },

        events: {
            "click #cmd_sweep": "freq_sweep",
            "change #spanfreq": "change_span",
            "change #centerfreq": "change_center",
            "change #startfreq": "change_start",
            "change #endfreq": "change_end",
            "change #vswr_circle": "redraw_plot"
        },

        render: function () {
            var self = this;
            console.log('Main render of Sark110 numeric view');
            this.$el.html(template());
            $('#startfreq', this.el).val(12000000);
            $('#endfreq', this.el).val(16000000);
            $('#centerfreq', this.el).val(14000000);
            $('#spanfreq', this.el).val(4000000);
            return this;
        },

        change_span: function () {
            var min = parseInt($('#startfreq', this.el).val());
            var max = parseInt($('#endfreq', this.el).val());
            var diff = parseInt($('#spanfreq', this.el).val()) - (max - min);
            $('#startfreq', this.el).val(min - diff / 2);
            $('#endfreq', this.el).val(max + diff / 2);
        },

        change_center: function () {
            var span = parseInt($('#spanfreq', this.el).val());
            var center = parseInt($('#centerfreq', this.el).val());
            $('#startfreq', this.el).val(center - span / 2);
            $('#endfreq', this.el).val(center + span / 2);
        },

        change_start: function () {
            var min = parseInt($('#startfreq', this.el).val());
            var span = parseInt($('#spanfreq', this.el).val());
            $('#endfreq', this.el).val(min + span);
            $('#centerfreq', this.el).val(min + span / 2);
        },

        change_end: function () {
            var max = parseInt($('#endfreq', this.el).val());
            var span = parseInt($('#spanfreq', this.el).val());
            $('#minfreq', this.el).val(max - span);
            $('#centerfreq', this.el).val(max - span / 2);
        },

        freq_sweep: function () {
            var min = parseInt($('#startfreq', this.el).val());
            var max = parseInt($('#endfreq', this.el).val());
            var step = (max - min) / 256;

            this.$('#cmd_sweep').html('Wait...').addClass('btn-warning').attr('disabled',true);

            // Reset the plot:
            instrumentManager.liveViewRef().plot.clearData();
            instrumentManager.liveViewRef().polarplot.clearData();

            for (var i = min; i < max; i += step) {
                linkManager.driver.rx(i);
            }
            linkManager.driver.version();

        },

        redraw_plot: function(e) {
            instrumentManager.liveViewRef().polarplot.setSWRCircle($(e.target).val());
        },

        onClose: function () {
            console.log("Sark110 numeric view closing...");
            linkManager.off('input', this.showInput, this);
            linkManager.off('status', this.updatestatus);
        },

        updateStatus: function(data) {
            if (data.portopen) {
              this.$('#cmd_sweep').attr('disabled',!data.portopen);
            }
        },

        showInput: function (data) {
            if (data.version) {
                this.$('#cmd_sweep').html('Sweep').removeClass('btn-warning').attr('disabled',false);
            }
        },


    });
});