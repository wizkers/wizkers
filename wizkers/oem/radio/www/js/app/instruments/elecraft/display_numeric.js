/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 *  The Num View actually makes small graphs for Elecraft radios :)
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    // vars here will be common to all instances of this module
    var simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/elecraft/ElecraftNumView.js');

    return (function () {

        var tempplot, amppowerplot, voltplot;

        // vars here will be private to each instance of this module
        var palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"];
        // We will pass this when we create plots, this is the global
        // config for the look and feel of the plot
        var plotoptions = {
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
            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updateStatus, this);
        },

        render: function () {
            this.$el.html(template());
            addPlot(this);
            return this;
        },

        onClose: function () {
            console.log("Elecraft numeric view closing...");
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
                    var stamp = new Date().getTime();
                    if (cmd == "PI") {
                        $("#kxpa-pi").html(val);
                        amppowerplot.appendPoint({
                            'name': "In",
                            'value': val
                        });
                    } else if (cmd == "PF") {
                        $("#kxpa-pf").html(val);
                        amppowerplot.appendPoint({
                            'name': "Fwd",
                            'value': val
                        });
                    } else if (cmd == "PV") {
                        $("#kxpa-pv").html(val);
                        amppowerplot.appendPoint({
                            'name': "R",
                            'value': val
                        });
                    } else if (cmd == "TM") {
                        $("#kxpa-tm").html(val);
                        tempplot.appendPoint({
                            'name': "PA.X",
                            'value': val
                        });
                    } else if (cmd == "PC") {
                        $("#kxpa-pc").html(val);
                        voltplot.appendPoint({
                            'name': "A",
                            'value': val
                        });
                    } else if (cmd == "SV") {
                        var val = Math.floor(val) / 100;
                        $("#kxpa-sv").html(val);
                        voltplot.appendPoint({
                            'name': "V",
                            'value': val
                        });
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