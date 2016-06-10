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
        template = require('js/tpl/instruments/slevel_monitor/LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {

            this.deviceinitdone = false;
            this.poller = null;
            this.s30avg = 0;
            this.s60avg = 0;
            this.s30cnt = 0;
            this.s60cnt = 0;

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot

            // The minute plot holds 120 points at 2Hz
            this.minuteplotoptions = {
                points: 120,
                vertical_stretch_parent: true,
                multiple_yaxis: true,
                log: false,
                showtips: true,
                selectable: false,
                plot_options: {
                    xaxis: {
                        mode: 'time',
                        show: true,
                        timeformat: "%H:%M:%S",
                        ticks: 6,
                        timezone: settings.get("timezone")
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

            // The hour plot hold 1 hour with 10s granularity
            this.hourplotoptions = {
                points: 60*6,
                vertical_stretch_parent: true,
                multiple_yaxis: true,
                log: false,
                showtips: true,
                selectable: false,
                plot_options: {
                    xaxis: {
                        mode: 'time',
                        show: true,
                        timeformat: "%H:%M",
                        ticks: 6,
                        timezone: settings.get("timezone")
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

            // The day plot hold 24 hour with 1m granularity
            this.dayplotoptions = {
                points: 24*60,
                vertical_stretch_parent: true,
                multiple_yaxis: true,
                log: false,
                showtips: true,
                selectable: false,
                plot_options: {
                    xaxis: {
                        mode: 'time',
                        show: true,
                        timeformat: "%H:%M",
                        ticks: 24,
                        timezone: settings.get("timezone")
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
            linkManager.on('status', this.updateStatus, this);

        },


        events: {},

        render: function () {
            var self = this;
            console.log('Main render of S-Level monitor live view');
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

            this.minuteplot = new simpleplot({
                model: this.model,
                settings: this.minuteplotoptions
            });
            if (this.minuteplot != null) {
                this.$('.minutechart').append(this.minuteplot.el);
                this.minuteplot.render();
            }
            this.hourplot = new simpleplot({
                model: this.model,
                settings: this.hourplotoptions
            });
            if (this.hourplot != null) {
                this.$('.hourchart').append(this.hourplot.el);
                this.hourplot.render();
            }

            this.dayplot = new simpleplot({
                model: this.model,
                settings: this.dayplotoptions
            });
            if (this.dayplot != null) {
                this.$('.daychart').append(this.dayplot.el);
                this.dayplot.render();
            }


            // Autostretch 50/50
            var self = this;
            var rsc = function () {
                var chartheight = window.innerHeight / 2 - $(self.el).offset().top + 10;
                self.$('.minutechart').css('height', chartheight + 'px');
                self.$('.hourchart').css('height', chartheight + 'px');
                self.$('.daychart').css('height', chartheight + 'px');
                // Then tell the charts to resize themselves since we changed
                // their parent's size
                if (self.minuteplot)
                    self.minuteplot.rsc();
                if (self.hourplot)
                    self.hourplot.rsc();
                if (self.dayplot)
                    self.dayplot.rsc();
            }
            this.rsc = rsc;
            $(window).on('resize', this.rsc);
            rsc();

        },

        /**
         * TODO: our driver architecture does not allow us to create
         * custom pollers, so we have to poll from the front-end. Can be
         * considered in a future improvement ?
         */
        pollRadio: function() {
            linkManager.driver.getSmeter();
        },
        
         updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                this.poller = setInterval(this.pollRadio, 500);
                this.deviceinitdone = true;
            } else if (!data.portopen) {
                clearInterval(this.poller);
                this.deviceinitdone = false;
            }
        },

       reading: function(smeter) {
            this.minuteplot.appendPoint({
                name: "S",
                value: smeter
            });
        },

        onClose: function () {
            console.log("S-Level monitor live view closing...");
            clearInterval(this.poller);
            linkManager.off('input', this.showInput);
            linkManager.off('status', this.updatestatus, this);
            this.minuteplot.onClose(); // Required to stop the plot from listening to window resize events
            this.hourplot.onClose();
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            if (data.smeter != undefined) {

                this.reading(data.smeter);
                this.s30avg = ((this.s30avg*this.s30cnt++) + data.smeter)/this.s30cnt;
                this.s60avg = ((this.s60avg*this.s60cnt++) + data.smeter)/this.s60cnt;
                if (this.s30cnt == 60) { // 30 seconds
                    this.hourplot.appendPoint({
                        name: 'S',
                        value: this.s30avg
                    });
                    this.s30cnt = 0;
                    this.s30avg = data.smeter;
                }
                if (this.s60cnt == 120) { // 1 minute
                    this.dayplot.appendPoint({
                        name: 'S',
                        value: this.s60avg
                    });
                    this.s60cnt = 0;
                    this.s60avg = data.smeter;
                }
            }
        },
    });

});