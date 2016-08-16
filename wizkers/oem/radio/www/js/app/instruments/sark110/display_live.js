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
 * Live view display of the output of the Sark 110
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
        smithplot = require('app/lib/smithplot'),
        template = require('js/tpl/instruments/sark110/Sark110LiveView.js');

    var gamma = function (r, x) {
        // Magnitude of the Reflection coefficient
        // gamma = Z - Zo / Z + Zo
        return Math.sqrt(Math.pow(r - 50, 2) + Math.pow(x, 2)) / Math.sqrt(Math.pow(r + 50, 2) + Math.pow(x, 2));
    }


    return Backbone.View.extend({

        initialize: function (options) {

            this.currentDevice = null;
            this.showstream = settings.get('showstream');

            this.deviceinitdone = false;

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: 256,
                vertical_stretch: true,
                multiple_yaxis: true,
                log: false,
                showtips: true,
                selectable: false,
                plot_options: {
                    xaxis: {
                        show: true,
                        tickDecimals: 6,
                        tickFormatter: function(val,axis) {
                            return (val/1e6).toFixed(axis.tickDecimals);
                        }
                    },
                    yaxes: [{
                            position: 'left'
                    },
                        {
                            position: 'right'
                    }],
                    grid: {
                        hoverable: true,
                        clickable: true
                    },
                    legend: {
                        position: "ne",
                    }
                }
            };

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {
            'shown.bs.tab a[data-toggle="tab"]': "tab_shown",
        },

        tab_shown: function (e) {
            if (e.target.innerText == 'Polar') {
                this.polarplot.autoResize();
            } else {
                this.plot.autoResize();
            }

        },


        render: function () {
            var self = this;
            console.log('Main render of Sark110 live view');
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

            // Note: SUPER IMPORTANT: not "new smithplot()(...)" but
            // "new (smithplot())(...)" . This is how we can have
            // proper private variables in our view.
            this.polarplot = new (smithplot())({
                model: this.model,
                settings: this.plotoptions
            });
            console.log(this.plot);
            if (this.polarplot != null) {
                $('.smithsweepchart', this.el).append(this.polarplot.el);
                this.polarplot.render();
            }

            // Now create the scalarplot:
            this.plot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.plot != null) {
                $('.scalarsweepchart', this.el).append(this.plot.el);
                this.plot.render();
            }
        },


        onClose: function () {
            console.log("Sark110 live view closing...");
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            if (this.polarplot)
                this.polarplot.onClose(); // Required to stop the plot from listening to window resize events
        },

        updatestatus: function (data) {
            console.log("Sark110 live display: link status update");
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

            if (data.R != undefined) {

                var Z = Math.sqrt(Math.pow(data.R, 2) + Math.pow(data.X, 2));
                var VSWR = (1 + gamma(data.R, data.X)) / (1 - gamma(data.R, data.X));
                this.plot.fastAppendPoint({
                    name: "Z",
                    value: Z,
                    timestamp: data.F
                });
                this.plot.fastAppendPoint({
                    name: "VSWR",
                    value: VSWR,
                    timestamp: data.F
                });

                var p = { R: data.R,
                          X: data.X,
                          data: { F: data.F}
                        };
                this.polarplot.appendPoint(p);
            }
            if (data.version) {
                this.plot.redraw();
            }
        },
    });

});