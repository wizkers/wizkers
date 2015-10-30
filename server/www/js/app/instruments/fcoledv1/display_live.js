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

/*
 * Live view for the Fried Circuits OLED backpack
 *
 * Our model is the settings object.
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
        template = require('js/tpl/instruments/FCOledLiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {

            this.currentDevice = null;

            this.deviceinitdone = false;

            this.livepoints = 300; // 5 minutes @ 1 Hz
            this.livevolt = [];
            this.livevolt_min = [];
            this.livevolt_max = [];
            this.liveamp = [];
            this.liveamp_min = [];
            this.liveamp_max = [];

            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: 256,
                vertical_stretch_parent: true,
                log: false,
                showtips: true,
                selectable: false,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%H:%M:%S",
                        timezone: settings.get("timezone")
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

            };

            this.prevStamp = 0;

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);
        },

        render: function () {
            var self = this;
            console.log('Main render of OLED Backpack live view');
            this.$el.html(template());
            linkManager.requestStatus();

            this.color = 1;

            this.addPlot();

            return this;
        },

        addPlot: function () {
            var self = this;
            // Now initialize the plot area:

            this.voltplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.voltplot != null) {
                $('.datachart', this.el).append(this.voltplot.el);
                this.voltplot.render();
            }

            this.ampplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.ampplot != null) {
                $('.datachart2', this.el).append(this.ampplot.el);
                this.ampplot.render();
            }

            // Now make the two plot areas autostretch:

            var self = this;
            var rsc = function () {
                var chartheight = window.innerHeight / 2 - $(self.el).offset().top + 10;
                $('.datachart', self.el).css('height', chartheight + 'px');
                $('.datachart2', self.el).css('height', chartheight + 'px');
                // Then tell the charts to resize themselves since we changed
                // their parent's size
                if (self.voltplot)
                    self.voltplot.rsc();
                if (self.ampplot)
                    self.ampplot.rsc();
            }
            this.rsc = rsc;
            $(window).on('resize', this.rsc);
            rsc();
        },

        onClose: function () {
            console.log("OLED Backpack view closing...");

            linkManager.off('status', this.updatestatus, this);
            linkManager.off('input', this.showInput, this);

            $(window).off('resize', this.rsc);
            this.voltplot.onClose();
            this.ampplot.onClose();

        },


        updatestatus: function (data) {
            console.log("OLED live display: serial status update");
        },

        clear: function () {
            $('.datachart', this.el).empty();
            $('.datachart2', this.el).empty();
            this.addPlot();
            this.suspendGraph = true;
        },

        disp_va: function (data, ts) {
            if (data.v != undefined && data.a != undefined) {
                var v = parseFloat(data.v.avg);
                var v_min = parseFloat(data.v.min);
                var v_max = parseFloat(data.v.max);
                var a = parseFloat(data.a.avg);
                var a_min = parseFloat(data.a.min);
                var a_max = parseFloat(data.a.max);

                this.voltplot.fastAppendPoint({
                    name: "V",
                    value: v,
                    timestamp: ts
                }).fastAppendPoint({
                    name: "Vmin",
                    timestamp: ts,
                    value: v_min,
                    options: {
                        id: "vmin"
                    }
                }).appendPoint({
                    name: "Vmax",
                    value: v_max,
                    timestamp: ts,
                    options: {
                        lines: {
                            show: true,
                            fill: true
                        },
                        fillBetween: "vmin"
                    }
                });

                this.ampplot.fastAppendPoint({
                    name: "mA",
                    value: a,
                    timestamp: ts
                }).fastAppendPoint({
                    name: "Amin",
                    value: a_min,
                    timestamp: ts,
                    options: {
                        id: "amin"
                    }

                }).appendPoint({
                    name: "Amax",
                    value: a_max,
                    timestamp: ts,
                    options: {
                        lines: {
                            show: true,
                            fill: true
                        },
                        fillBetween: "amin"
                    }
                });
            }
        },


        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;

            if (data.replay_ts != undefined) {
                this.suspend_graph = false;
                this.disp_va(data.data, data.replay_ts);
                return;
            }

            // We're waiting for a data replay
            if (this.suspend_graph)
                return;

            this.disp_va(data);

        },
    });

});