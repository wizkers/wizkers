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

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/sample_instrument/LiveView.js');

    return Backbone.View.extend({
        initialize:function () {

            // Get frequency and span if specified:
            var span = this.model.get('liveviewspan'); // In seconds
            var period = this.model.get('liveviewperiod'); // Polling frequency

            var livepoints = 300; // 5 minutes @ 1 Hz
            if (span && period) {
                livepoints = span / period;
            }

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: livepoints,
                vertical_stretch: true,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%H:%M",
                        timezone: settings.get("timezone")
                    },
                    grid: {
                        hoverable: true
                    },
                    legend: {
                        position: "ne"
                    }
                }
            };

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },

        render:function () {
            this.$el.html(template());
            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                $('#showstream', this.el).css('visibility', 'hidden');
            }

            this.addPlot();
            return this;
        },

        addPlot: function () {
            var self = this;
            
            this.plot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.plot != null) {
                $('.instrumentchart', this.el).append(this.plot.el);
                this.plot.render();
            }
        },

        clear: function () {
            $('.instrumentchart', this.el).empty();
            this.addPlot();
            this.suspendGraph = true;
        },

        onClose: function() {
            console.log("Instrument live view closing...");
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            if (this.plot)
                this.plot.onClose();
        },

        disp_val: function (data, ts) {
            if (data.value != undefined) {
                this.plot.appendPoint({
                    name: 'U',
                    value: data.value,
                    timestamp: ts
                });
            }
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {

            if (data.replay_ts != undefined) {
                this.suspend_graph = false;
                this.disp_val(data.data, data.replay_ts);
                return;
            }

            // We're waiting for a data replay.
            if (this.suspend_graph)
                return;

            if (this.showstream) {
                // Update our raw data monitor
                var i = $('#input', this.el);
                var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length - 50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            this.disp_val(data);
        },

    });

});

