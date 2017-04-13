/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2017 Edouard Lafargue, ed@wizkers.io
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
 *  The Num View actually makes small graphs for the radio :)
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    // vars here will be common to all instances of this module
    var simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/fdm_duo/NumView.js');

    return (function () {

        var tempplot, amppowerplot, voltplot;

        var lastStamp = 0;

        // vars here will be private to each instance of this module
        var palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"];
        // We will pass this when we create plots, this is the global
        // config for the look and feel of the plot
        var plotoptions = {
            duration: 240, // Maximum 240 seconds (4 minutes)
            log: false,
            vertical_stretch_parent: true,
            plot_options: {
                xaxes: [{
                        mode: "time",
                        show: true,
                        timeformat: "%H:%M",
                        ticks: 4,
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
                colors: palette,
            }
        };

        var addPlot = function (v) {
                // Now initialize the plot areas:
                tempplot = new simpleplot({
                    model: v.model,
                    settings: plotoptions
                });
                if (tempplot != null) {
                    $('.tempchart', v.el).append(tempplot.el);
                    tempplot.render();
                }
                amppowerplot = new simpleplot({
                    model: v.model,
                    settings: plotoptions
                });
                if (amppowerplot != null) {
                    $('.amppowerchart', v.el).append(amppowerplot.el);
                    amppowerplot.render();
                }
                voltplot = new simpleplot({
                    model: v.model,
                    settings: plotoptions
                });
                if (voltplot != null) {
                    $('.voltchart', v.el).append(voltplot.el);
                    voltplot.render();
                }
            }


        return Backbone.View.extend({

            initialize: function () {
                console.warn('Elecraft Init Num View');
                linkManager.on('input', this.showInput, this);
                linkManager.on('status', this.updateStatus, this);
            },

            render: function () {
                this.$el.html(template());
                addPlot(this);
                return this;
            },

            onClose: function () {
                console.log("FDM-DUO numeric view closing...");
                linkManager.off('input', this.showInput, this);
                linkManager.off('status', this.updateStatus, this);
                // Remove the window resize bindings on our plots:
                tempplot.onClose();
                amppowerplot.onClose();
                voltplot.onClose();
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
                if (data.raw == undefined)
                    return; // data is sometimes an object when we get a serial port error

                var drawPwr = false;
                var drawTemp = false;
                var drawVolt = false;
                // Now update our display depending on the data we received:
                if (data.raw.charAt(0) == '^') {
                    var cmd = data.raw.substr(1, 2);
                    var val = parseInt(data.raw.substr(3)) / 10;
                    if (cmd == "PI") {
                        $("#kxpa-pi").html(val);
                        amppowerplot.fastAppendPoint({
                            'name': "In",
                            'value': val
                        });
                    } else if (cmd == "PF") {
                        $("#kxpa-pf").html(val);
                        amppowerplot.fastAppendPoint({
                            'name': "Fwd",
                            'value': val
                        });
                    } else if (cmd == "PV") {
                        $("#kxpa-pv").html(val);
                        amppowerplot.fastAppendPoint({
                            'name': "R",
                            'value': val
                        });
                    } else if (cmd == "TM") {
                        $("#kxpa-tm").html(val);
                        tempplot.fastAppendPoint({
                            'name': "PA.X",
                            'value': val
                        });
                    } else if (cmd == "PC") {
                        $("#kxpa-pc").html(val);
                        voltplot.fastAppendPoint({
                            'name': "A",
                            'value': val
                        });
                    } else if (cmd == "SV") {
                        var val = Math.floor(val) / 100;
                        $("#kxpa-sv").html(val);
                        voltplot.fastAppendPoint({
                            'name': "V",
                            'value': val
                        });
                    }
                    // Only redraw the three graphs once per second,
                    // in order to reduce the redraws. Looks better too:
                    var stamp = new Date().getTime();
                    if (stamp - lastStamp > 1000) {
                        lastStamp = stamp;
                        tempplot.redraw();
                        amppowerplot.redraw();
                        voltplot.redraw();
                    }
                } else {
                    var cmd = data.raw.substr(0, 2);
                    if (cmd == "PO") {
                        // Actual Power Outout
                        var val = parseInt(data.raw.substr(2)) / 10;
                        amppowerplot.appendPoint({
                            'name': "KX3",
                            'value': val
                        });
                    } else if (cmd == "DB") {
                        // We catch interesting stuff on Display B and add it to the plots
                        // dynamically
                        var cmd4 = data.raw.substr(2, 4);
                        var cmd2 = data.raw.substr(2,2);
                        var val = 0;
                        switch (cmd4) {
                        case "PA.I":
                            val = parseInt(data.raw.substr(7, 2));
                            tempplot.appendPoint({
                                'name': "PA.I",
                                'value': val
                            });
                            break;
                        case "OSC ":
                        case "OSC*":
                            val = parseInt(data.raw.substr(6, 2));
                            tempplot.appendPoint({
                                'name': "OSC",
                                'value': val
                            });
                            break;
                        case "PA.2":
                            val = parseInt(data.raw.substr(7, 2));
                            tempplot.appendPoint({
                                'name': "PA.2",
                                'value': val
                            });
                            break;
                        }
                        switch (cmd2) {
                            case 'PS':
                                val = parseFloat(data.raw.substr(5,4));
                                voltplot.appendPoint({
                                    'name': 'PS',
                                    'value': val
                                });
                                break;
                            case 'BT':
                                val = parseFloat(data.raw.substr(5,4));
                                voltplot.appendPoint({
                                    'name': 'BT',
                                    'value': val
                                });
                                break;
                        }
                    }
                }
            }
        });
    })();
});