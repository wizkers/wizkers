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