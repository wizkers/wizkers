/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 *  The Num View actually makes small graphs for Elecraft radios :)
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/ElecraftNumView.js');

    //require('bootstrap');
    require('flot');
    require('flot_time');
    require('flot_resize');

    return Backbone.View.extend({

        initialize: function () {

            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"],

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: 150, // 2.5 minutes @ 1 Hz
                plot_options: {
                    xaxes: [{
                            mode: "time",
                            show: true,
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
                        position: "ne"
                    },
                    colors: this.palette,
                }
            };

            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updateStatus, this);
        },

        render: function () {
            $(this.el).html(template());
            this.addPlot();
            return this;
        },

        addPlot: function () {
            var self = this;
            // Now initialize the plot areas:
            this.tempplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.tempplot != null) {
                $('.tempchart', this.el).append(this.tempplot.el);
                this.tempplot.render();
            }
            this.amppowerplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.amppowerplot != null) {
                $('.amppowerchart', this.el).append(this.amppowerplot.el);
                this.amppowerplot.render();
            }
            this.voltplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.voltplot != null) {
                $('.voltchart', this.el).append(this.voltplot.el);
                this.voltplot.render();
            }
        },



        onClose: function () {
            console.log("Elecraft numeric view closing...");
            linkManager.off('input', this.showInput, this);
            linkManager.off('status', this.updateStatus, this);
            // Remove the window resize bindings on our plots:
            this.tempplot.onClose();
            this.amppowerplot.onClose();
            this.voltplot.onClose();
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
            if (data.charAt(0) == '^') {
                var cmd = data.substr(1, 2);
                var val = parseInt(data.substr(3)) / 10;
                var stamp = new Date().getTime();
                if (cmd == "PI") {
                    $("#kxpa-pi").html(val);
                    this.amppowerplot.appendPoint({
                        'name': "In",
                        'value': val
                    });
                } else if (cmd == "PF") {
                    $("#kxpa-pf").html(val);
                    this.amppowerplot.appendPoint({
                        'name': "Fwd",
                        'value': val
                    });
                } else if (cmd == "PV") {
                    $("#kxpa-pv").html(val);
                    this.amppowerplot.appendPoint({
                        'name': "R",
                        'value': val
                    });
                } else if (cmd == "TM") {
                    $("#kxpa-tm").html(val);
                    this.tempplot.appendPoint({
                        'name': "PA.X",
                        'value': val
                    });
                } else if (cmd == "PC") {
                    $("#kxpa-pc").html(val);
                    this.voltplot.appendPoint({
                        'name': "A",
                        'value': val
                    });
                } else if (cmd == "SV") {
                    var val = Math.floor(val) / 100;
                    $("#kxpa-sv").html(val);
                    this.voltplot.appendPoint({
                        'name': "V",
                        'value': val
                    });
                }
            } else {
                var cmd = data.substr(0, 2);
                if (cmd == "PO") {
                    // Actual Power Outout
                    var val = parseInt(data.substr(2)) / 10;
                    this.amppowerplot.appendPoint({
                        'name': "KX3",
                        'value': val
                    });
                } else if (cmd == "DB") {
                    // We catch interesting stuff on Display B and add it to the plots
                    // dynamically
                    var cmd2 = data.substr(2, 4);
                    var val = 0;
                    switch (cmd2) {
                    case "PA.I":
                        val = parseInt(data.substr(7, 2));
                        this.tempplot.appendPoint({
                            'name': "PA.I",
                            'value': val
                        });
                        break;
                    case "OSC ":
                    case "OSC*":
                        val = parseInt(data.substr(6, 2));
                        this.tempplot.appendPoint({
                            'name': "OSC",
                            'value': val
                        });
                        break;
                    case "PA.2":
                        val = parseInt(data.substr(7, 2));
                        this.tempplot.appendPoint({
                            'name': "PA.2",
                            'value': val
                        });
                        break;
                    }
                }
            }

        },

    });
});