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
        template = require('js/tpl/instruments/elecraft_siggen/LiveView.js');

    var gamma = function (r, x) {
        // Reflection coefficient
        return Math.sqrt(Math.pow(r - 50, 2) + Math.pow(x, 2)) / Math.sqrt(Math.pow(r + 50, 2) + Math.pow(x, 2));
    }


    return Backbone.View.extend({

        initialize: function (options) {

            this.currentDevice = null;
            this.deviceinitdone = false;

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: 1000,
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

            linkManager.on('input', this.showInput, this);

        },


        events: {},

        render: function () {
            var self = this;
            console.log('Main render of KX3 AN live view');
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
                $('.sweepchart', this.el).append(this.plot.el);
                this.plot.render();
            }
        },

        reading: function(f,swr) {
            this.plot.appendPoint({
                name: "VSWR",
                value: swr,
                xval: f
            });
        },

        onClose: function () {
            console.log("Elecraft KX3 live view closing...");
            linkManager.off('input', this.showInput);
            this.plot.onClose(); // Required to stop the plot from listening to window resize events
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {

        },
    });

});