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
 * Live view display of the output of the Sigma 25
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/sigma25/Sigma25LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {

            this.currentDevice = null;
            this.showstream = settings.get('showstream');

            this.deviceinitdone = false;

            this.update_count = 0;

            // The Sigma25 has got 4096 channels, we keep those in an array
            this.channels = [];
            // We need to initialize it to zeroes so that we can
            // easily add to each channel later:
            for (var i=0; i < 4096; i++)
                this.channels[i] = 0;

            // Here are all the options we can define, to pass as "settings" when creating the view:
            this.plotoptions = {
                preload: 4096,
                log: false,
                showtips: true,
                selectable: false,
                vertical_stretch: true,
                multiple_yaxis: false,
                plot_options: {
                    xaxis: {
                        show: true,
                        tickDecimals: 0
                    },
                    grid: {
                        hoverable: true,
                        clickable: true
                    },
                    legend: {
                        position: "ne",
                        // container: $('#legend')
                    },
                    colors: ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"],
                },

                get: function (key) {
                    return this[key];
                },
            };

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {},

        render: function () {
            var self = this;
            console.log('Main render of Sigma25 live view');
            this.$el.html(template());

            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                $('#showstream', this.el).css('visibility', 'hidden');
            }

            linkManager.requestStatus();
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
                $('.spectrumchart', this.el).append(this.plot.el);
                this.plot.render();
            }
        },


        onClose: function () {
            console.log("Sigma25 live view closing...");
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            this.plot.onClose(); // Required to stop the plot from listening to window resize events
        },

        updatestatus: function (data) {
            console.log("Sigma25 live display: link status update");
            if (data.portopen && ! linkManager.isStreaming() ) {
                // Result will be displayed by the Numeric view
                linkManager.sendCommand('g');  // Gain
                // Live stream will be started from the NumView
            }
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;

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

            if (data.channels) {
                for (var i = 0; i < data.channels.length; i++) {
                    var ch = data.channels[i];
                    if (ch < 4095) {
                        this.channels[ch]++;
                        this.plot.fastAppendPoint({
                            name: "e",
                            value: this.channels[ch],
                            index: ch
                        });
                    }
                }
                if (! (this.update_count++ % 500))
                    this.plot.redraw();
            }
        },
    });

});