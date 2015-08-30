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
 * Live view display of the output of Hawk Nest devices. We can have a number of
 * devices
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
        template = require('js/tpl/instruments/HawkNestLiveView.js');

    require('bootstrap');
    
    return Backbone.View.extend({

        initialize: function (options) {

            this.showstream = settings.get('showstream');
            this.plotavg = false;

            // Keep track of the probes we detected, and keep a reference to the
            // plots where they are displayed.
            this.probes = {};

            // Get frequency and span if specified:
            var span = this.model.get('liveviewspan'); // In seconds
            var period = this.model.get('liveviewperiod'); // Polling frequency

            var livepoints = 300; // 5 minutes @ 1 Hz
            if (span && period) {
                livepoints = span / period;
            }

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: livepoints,
                vertical_stretch: true,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%Y.%m.%d<br>%H:%M",
                        timezone: settings.get("timezone")
                    },
                    grid: {
                        hoverable: true
                    },
                    legend: {
                        position: "ne"
                    }
                }
            };

            // Keep an array for moving average over the last X samples
            // In Live view, we fix this at 1 minute. In log management, we will
            // make this configurable
            this.movingAvgPoints = 60;
            this.movingAvgData = []; // Note: used for the graph, this stores the result of the moving average
            this.movingAvgData2 = []; // Note: used for the graph, this stores the result of the moving average

            this.prevStamp = 0;
            linkManager.on('input', this.showInput, this);
        },

        events: {
            "click .probe-tab": "selectProbe"
        },

        render: function () {
            var self = this;
            console.log('Main render of Hawk Nest live view');
            $(this.el).html(template());

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

            this.probes['All'] = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.probes['All'] != null) {
                $('.geigerchart', this.el).append(this.probes['All'].el);
                this.probes['All'].render();
            }
        },

        onClose: function () {
            console.log("Hawk Nest live view closing...");
            linkManager.off('input', this.showInput);
            // Dispose of all simpleplots nicely (see onClose in flotplot.js for explanations)
            for (var pl in this.probes) {
                this.probes[pl].onClose();
            }
        },

        selectProbe: function (evt) {
            var pid = evt.target.firstChild.nodeValue;
            // We need to tell the num view we got a new probe ID:
            instrumentManager.numViewRef().selectProbe(pid);
        },

        movingAverager: function (newpoint, buffer) {

            buffer.push(newpoint);
            // Keep our data to the length we want
            if (buffer.length >= this.movingAvgPoints)
                buffer = buffer.slice(1);

            // Now compute the average
            var avg = 0;
            for (var i = 0; i < buffer.length; i++) {
                avg += buffer[i];
            }
            return avg / buffer.length;

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

            if (data.probeid != undefined &&
                !this.probes.hasOwnProperty(data.probeid)) {
                // Detected a new probe on the network: configure the plot
                this.probes[data.probeid] = new simpleplot({
                    model: this.model,
                    settings: this.plotoptions
                });
                $('#probes-select', this.el).append('<li role="presentation" class="probe-tab" ><a data-toggle="tab" href="#probes-' + data.probeid + '">' + data.probeid + '</a></li>');
                $('#probes-content', this.el).append('<div class="tab-pane" id="probes-' + data.probeid + '"><div class="thumbnail">' +
                    '<div class="chart" id="chart-' + data.probeid + '"></div></div></div>');
                // Need to activate the tab before adding the plot, otherwise we get a "invalid plot dimensions" error
                // when rendering the plot
                $('#probes-select a:last', this.el).tab('show');
                $('#chart-' + data.probeid, this.el).append(this.probes[data.probeid].el);
                this.probes[data.probeid].render();
                instrumentManager.numViewRef().selectProbe(data.probeid);
            }

            if (data.cpm != undefined) {
                var cpm = parseFloat(data.cpm.value);
                var datapoint = {
                    'name': "CPM-" + data.probeid,
                    'value': cpm,
                    'timestamp': data.devicestamp
                };
                this.probes['All'].appendPoint(datapoint);
                this.probes[data.probeid].appendPoint(datapoint);
            }
            if (data.cpm2 != undefined) {
                var cpm2 = parseFloat(data.cpm2.value);
                var datapoint = {
                    'name': "CPM2-" + data.probeid,
                    'value': cpm2,
                    'timestamp': data.devicestamp
                };
                this.probes['All'].appendPoint(datapoint);
                this.probes[data.probeid].appendPoint(datapoint);

            }
        },
    });

});