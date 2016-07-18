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

/**
 *  The Num View actually makes small graphs for THE FT-817
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/yaesu_817nd/NumView.js');

    return Backbone.View.extend({

        initialize: function () {

            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"];

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: 150, // 2.5 minutes @ 1 Hz
                log: false,
                vertical_stretch_parent: true,
                plot_options: {
                    xaxes: [{
                            mode: "time",
                            show: true,
                            timeformat: "%H:%M",
                            ticks: 5,
                            timezone: settings.get("timezone")
                        },
                       ],
                    yaxis: {
                        min: 0
                    },
                    grid: {
                        hoverable: true,
                        clickable: true
                    },
                    legend: {
                        position: "nw"
                    },
                    colors: this.palette,
                }
            };

            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updateStatus, this);
        },

        render: function () {
            this.$el.html(template());
            this.addPlot();
            return this;
        },

        addPlot: function () {
            var self = this;
            // Now initialize the plot areas:
            this.powerplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.powerplot != null) {
                $('.powerchart', this.el).append(this.powerplot.el);
                this.powerplot.render();
            }
            this.smeterplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.smeterplot != null) {
                $('.smeterchart', this.el).append(this.smeterplot.el);
                this.smeterplot.render();
            }
        },

        onClose: function () {
            console.log("FT-817ND numeric view closing...");
            linkManager.off('input', this.showInput, this);
            linkManager.off('status', this.updateStatus, this);
            // Remove the window resize bindings on our plots:
            this.powerplot.onClose();
            this.smeterplot.onClose();
        },

        updateStatus: function (data) {
            //console.log("TCP Server Connect: " + data.tcpserverconnect);
            if (typeof (data.tcpserverconnect) != 'undefined') {
                if (data.tcpserverconnect) {
                    $('.tcp-server', this.el).html("Client connected");
                    $('.tcp-server').addClass('btn-success').removeClass('btn-danger');
                } else {
                    $('.tcp-server', this.el).html("No TCP Client");
                    $('.tcp-server').addClass('btn-danger').removeClass('btn-success');

                }
            }
        },

        showInput: function (data) {
            var drawPwr = false;
            var drawTemp = false;
            var drawVolt = false;
            // Now update our display depending on the data we received:

            if (data.smeter) {
                this.smeterplot.appendPoint({
                    'name': "S",
                    'value': data.smeter
                });
            } else if (data.pwr) {
                this.powerplot.appendPoint({
                    'name': "Pwr",
                    'value': data.pwr
                });
            }
        }
    });
});